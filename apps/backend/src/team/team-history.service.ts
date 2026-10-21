import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  type TeamDetail,
  type TeamNightDetail,
  type TeamNightQuestion,
  type TeamSessionRow,
} from '@campus-pubquiz/types';
import { Team } from '@/db/entities/team.entity';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { TeamRepository } from '@/db/repositories/team.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
import {
  summarizeTeamHistory,
  teamHistoryOf,
  type TeamHistorySession,
} from '@/team/team-history.calc';

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
    private readonly endedSessions: EndedSessionsRead,
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

    const session = await this.endedSessions.endedSession(gameSessionId);
    if (!session) return null;
    if (!(await this.standings.hasTakenPart(gameSessionId, team.id))) {
      return null;
    }

    const night = await this.endedSessions.night(gameSessionId, {
      teamId: team.id,
    });
    const answerByQuestion = new Map(
      night.answers.map((a) => [a.questionId, a]),
    );
    const rows = night.questions.map((question): TeamNightQuestion => {
      const answer = answerByQuestion.get(question.questionId);
      return {
        questionId: question.questionId,
        roundTitle: question.roundTitle,
        roundNumber: question.roundNumber,
        questionNumber: question.questionNumber,
        prompt: question.prompt,
        type: question.type,
        answerKind: question.answerKind,
        points: question.points,
        teamAnswer: answer?.answer ?? null,
        verdict: answer?.verdict ?? null,
        pointsAwarded: answer?.pointsAwarded ?? 0,
        correctAnswer: question.answer,
      };
    });
    return {
      gameSessionId,
      name: session.displayName,
      playedAt: session.playedAt.toISOString(),
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

    const participations = await this.endedSessions.participations(teamIds);
    if (participations.length === 0) return results;

    const sessionIds = [...new Set(participations.map((p) => p.gameSessionId))];
    const [sessionResults, playerCounts] = await Promise.all([
      this.standings.resultsForSessions(sessionIds),
      this.playerCountService.listForSessions(sessionIds, teamIds),
    ]);

    for (const teamId of teamIds) {
      const sessions: TeamHistorySession[] = [];
      for (const participation of participations) {
        if (participation.teamId !== teamId) continue;
        const result = sessionResults.get(participation.gameSessionId);
        if (!result) continue;
        sessions.push({
          gameSessionId: participation.gameSessionId,
          name: participation.displayName,
          playedAt: participation.playedAt.toISOString(),
          result,
          playerCount:
            playerCounts.get(participation.gameSessionId)?.get(teamId) ?? null,
        });
      }
      results.set(teamId, teamHistoryOf(teamId, sessions));
    }
    return results;
  }
}
