import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  formatAnswer,
  resolveAnswerKind,
  type QuestionType,
  type TeamDetail,
  type TeamNightDetail,
  type TeamNightQuestion,
  type TeamSessionRow,
  type Verdict,
} from '@campus-pubquiz/types';
import { readQuestionPayload } from '@/db/question-payload';
import { Team } from '@/db/entities/team.entity';
import { TeamRepository } from '@/db/repositories/team.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
import { summarizeTeamHistory } from '@/team/team-history.calc';

interface ParticipationRow {
  gameSessionId: number;
  teamId: number;
  name: string | null;
  quizTitle: string;
  playedAt: string | Date;
}

interface NightQuestionRow {
  id: number;
  type: QuestionType;
  prompt: string;
  answer: string;
  payload: unknown;
  points: number;
  roundId: number;
  roundTitle: string;
}

interface NightAnswerRow {
  questionId: number;
  value: string;
  verdict: Verdict | null;
  pointsAwarded: string | number;
}

/** A team's session rows, with how many of those nights it won. */
interface TeamSessionResults {
  rows: TeamSessionRow[];
  nightsWon: number;
}

/**
 * Owns a team's history across ended sessions. Placings, totals, who left and
 * who won the night all come from the Session result module (via
 * {@link StandingsService.resultsForSessions}), never from SQL ranks, so a
 * team's page always agrees with each session's standings table. The teams
 * directory's average placing reuses {@link resultsForTeams} and
 * `averagePlacingOf`.
 */
@Injectable()
export class TeamHistoryService {
  constructor(
    @InjectRepository(Team) private readonly teams: TeamRepository,
    private readonly standings: StandingsService,
    private readonly playerCountService: PlayerCountService,
  ) {}

  /** One team's header, summary and sessions; null for an unknown team. */
  async detail(teamId: number): Promise<TeamDetail | null> {
    const team = await this.teams.findOne({ id: teamId });
    if (!team) return null;
    const results = (await this.resultsForTeamsWithWins([teamId])).get(teamId)!;
    return {
      id: team.id,
      name: team.name,
      summary: summarizeTeamHistory(results.rows, results.nightsWon),
      sessions: results.rows,
    };
  }

  /** The history of the team that owns a team code (any case); null when no team does. */
  async detailByCode(teamCode: string): Promise<TeamDetail | null> {
    const team = await this.teamByCode(teamCode);
    return team ? this.detail(team.id) : null;
  }

  private teamByCode(teamCode: string): Promise<Team | null> {
    return this.teams.findOne({ code: teamCode.toUpperCase() });
  }

  /**
   * One ended night as the team that owns the code saw it: every question in
   * order with the team's own answer and the key. Null for an unknown code, a
   * session that hasn't ended or one the team took no part in (kicked teams
   * did, so they still see their answers). Only this team's answers are read.
   */
  async nightByCode(
    teamCode: string,
    gameSessionId: number,
  ): Promise<TeamNightDetail | null> {
    const team = await this.teamByCode(teamCode);
    if (!team) return null;
    const knex = this.teams.getKnex();

    const session = (await knex('game_sessions as gs')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .where('gs.id', gameSessionId)
      .where('gs.status', 'ended')
      .select(
        'gs.quiz_id as quizId',
        'gs.name as name',
        'qz.title as quizTitle',
        'gs.created_at as playedAt',
      )
      .first()) as
      | {
          quizId: number;
          name: string | null;
          quizTitle: string;
          playedAt: string | Date;
        }
      | undefined;
    if (!session) return null;
    if (!(await this.standings.hasTakenPart(gameSessionId, team.id))) {
      return null;
    }

    const questions = (await knex('questions as q')
      .join('rounds as r', 'r.id', 'q.round_id')
      .where('r.quiz_id', session.quizId)
      .orderBy([
        { column: 'r.order_index', order: 'asc' },
        { column: 'q.order_index', order: 'asc' },
      ])
      .select(
        'q.id as id',
        'q.type as type',
        'q.prompt as prompt',
        'q.answer as answer',
        'q.payload as payload',
        'q.points as points',
        'r.id as roundId',
        'r.title as roundTitle',
      )) as NightQuestionRow[];
    const answers = (await knex('answers')
      .where('game_session_id', gameSessionId)
      .where('team_id', team.id)
      .select(
        'question_id as questionId',
        'value',
        'verdict',
        'points_awarded as pointsAwarded',
      )) as NightAnswerRow[];
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const roundNumberById = new Map<number, number>();
    const questionCountByRound = new Map<number, number>();
    const rows = questions.map((question): TeamNightQuestion => {
      if (!roundNumberById.has(question.roundId)) {
        roundNumberById.set(question.roundId, roundNumberById.size + 1);
      }
      const questionNumber =
        (questionCountByRound.get(question.roundId) ?? 0) + 1;
      questionCountByRound.set(question.roundId, questionNumber);

      const { options } = readQuestionPayload(question);
      const formattable = { type: question.type, options };
      const answer = answerByQuestion.get(question.id);
      return {
        questionId: question.id,
        roundTitle: question.roundTitle,
        roundNumber: roundNumberById.get(question.roundId)!,
        questionNumber,
        prompt: question.prompt,
        type: question.type,
        answerKind: resolveAnswerKind(question),
        points: question.points,
        teamAnswer: answer ? formatAnswer(answer.value, formattable) : null,
        verdict: answer?.verdict ?? null,
        pointsAwarded: answer ? Number(answer.pointsAwarded) : 0,
        correctAnswer: formatAnswer(question.answer, formattable),
      };
    });
    return {
      gameSessionId,
      name: session.name ?? session.quizTitle,
      playedAt: new Date(session.playedAt).toISOString(),
      questions: rows,
    };
  }

  /** Every ended session each team took part in, newest first. A team with none maps to an empty list. */
  async resultsForTeams(
    teamIds: readonly number[],
  ): Promise<Map<number, TeamSessionRow[]>> {
    const results = await this.resultsForTeamsWithWins(teamIds);
    return new Map(
      [...results].map(([teamId, result]) => [teamId, result.rows]),
    );
  }

  private async resultsForTeamsWithWins(
    teamIds: readonly number[],
  ): Promise<Map<number, TeamSessionResults>> {
    const results = new Map<number, TeamSessionResults>(
      teamIds.map((teamId) => [teamId, { rows: [], nightsWon: 0 }]),
    );
    if (teamIds.length === 0) return results;

    const participations = await this.loadParticipations(teamIds);
    if (participations.length === 0) return results;

    const sessionIds = [...new Set(participations.map((p) => p.gameSessionId))];
    const [sessionResults, playerCounts] = await Promise.all([
      this.standings.resultsForSessions(sessionIds),
      this.playerCountService.listForSessions(sessionIds, teamIds),
    ]);

    for (const participation of participations) {
      const session = sessionResults.get(participation.gameSessionId);
      const team = session?.teams.find(
        (t) => t.teamId === participation.teamId,
      );
      if (!session || !team) continue;
      const result = results.get(participation.teamId)!;
      result.rows.push({
        gameSessionId: participation.gameSessionId,
        name: participation.name ?? participation.quizTitle,
        playedAt: new Date(participation.playedAt).toISOString(),
        placing: team.placing,
        placingTo: team.placingTo,
        teamCount: session.participantCount,
        hasLeft: team.hasLeft,
        totalPoints: team.totalPoints,
        maxPoints: session.maxPoints,
        correctCount: team.correctCount,
        playerCount:
          playerCounts
            .get(participation.gameSessionId)
            ?.get(participation.teamId) ?? null,
      });
      if (team.wonNight) result.nightsWon += 1;
    }
    return results;
  }

  /** Ended sessions each team is on the roster of or left a mark on (answers, bonus awards), newest first. */
  private async loadParticipations(
    teamIds: readonly number[],
  ): Promise<ParticipationRow[]> {
    const knex = this.teams.getKnex();
    const ids = [...teamIds];
    const participants = knex('game_session_teams')
      .whereIn('team_id', ids)
      .select('game_session_id', 'team_id')
      .union([
        knex('answers')
          .whereIn('team_id', ids)
          .select('game_session_id', 'team_id'),
        knex('bonus_awards')
          .whereIn('team_id', ids)
          .select('game_session_id', 'team_id'),
      ]);

    return (await knex
      .from(participants.as('p'))
      .join('game_sessions as gs', 'gs.id', 'p.game_session_id')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .where('gs.status', 'ended')
      .orderBy('gs.created_at', 'desc')
      .orderBy('gs.id', 'desc')
      .select(
        'gs.id as gameSessionId',
        'p.team_id as teamId',
        'gs.name as name',
        'qz.title as quizTitle',
        'gs.created_at as playedAt',
      )) as ParticipationRow[];
  }
}
