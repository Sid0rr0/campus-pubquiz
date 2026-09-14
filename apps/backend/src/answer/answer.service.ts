import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  LeaderboardEntry,
  QuestionType,
  TeamAnswerView,
} from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';

/** Floor on a correct kahootMode answer's score, regardless of how late it was submitted — the slowest correct answer still keeps half its points. */
const KAHOOT_MIN_SCORE_FRACTION = 0.5;
/** Share of a correct kahootMode answer's points that scales with speed, on top of KAHOOT_MIN_SCORE_FRACTION — the two must sum to 1 so a same-instant answer scores full points. */
const KAHOOT_SPEED_SCORE_FRACTION = 0.5;

export interface SubmittedAnswer {
  answerId: number;
  teamId: number;
  teamName: string;
  value: string;
  pointsAwarded: number;
  gradedAt: string | null;
}

export interface GradedAnswer {
  questionId: number;
}

interface LeaderboardRow {
  teamId: number;
  teamName: string;
  quizPoints: string | number;
  bonusPoints: string | number;
  positiveBonusPoints: string | number;
  negativeBonusPoints: string | number;
}

interface RoundRow {
  roundId: number;
  roundTitle: string;
}

interface RoundTotalRow {
  roundId: number;
  teamId: number;
  total: string | number;
}

const AUTO_GRADED_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'sort',
  'match',
];

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer) private readonly answers: AnswerRepository,
    @InjectRepository(Team) private readonly teams: TeamRepository,
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
    @InjectRepository(Question)
    private readonly questions: QuestionRepository,
  ) {}

  async submit(
    gameSessionId: number,
    questionId: number,
    teamId: number,
    value: string,
  ): Promise<SubmittedAnswer> {
    const question = await this.questions.findOneOrFail(questionId, {
      fields: ['type', 'answer', 'points'],
    });
    // Multiple choice, sort, and match all have one exact-match correct
    // value (enforced at import/save time — see question-row.schema.ts and
    // quiz-draft.schema.ts), so they can be graded the instant they're
    // submitted — no admin judgement call needed like free_text/audio
    // require.
    const isAutoGraded = AUTO_GRADED_TYPES.includes(question.type);
    const isCorrect = isAutoGraded && value === question.answer;

    // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set the
    // timestamps explicitly (see TeamService.addToRoster for the same fix).
    const now = new Date();
    const answer = await this.answers.upsert(
      {
        gameSession: gameSessionId,
        question: questionId,
        team: teamId,
        value,
        pointsAwarded: isCorrect ? question.points : 0,
        ...(isAutoGraded ? { gradedAt: now } : {}),
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields: isAutoGraded
          ? ['value', 'updatedAt', 'pointsAwarded', 'gradedAt']
          : ['value', 'updatedAt'],
      },
    );

    const team = await this.teams.findOneOrFail(teamId, { fields: ['name'] });

    return {
      answerId: answer.id,
      teamId,
      teamName: team.name,
      value: answer.value,
      pointsAwarded: answer.pointsAwarded,
      gradedAt: answer.gradedAt?.toISOString() ?? null,
    };
  }

  async listForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<AnswerView[]> {
    const rows = await this.answers.find(
      { gameSession: gameSessionId, question: questionId },
      { populate: ['team'], orderBy: { team: { name: 'asc' } } },
    );
    return rows.map((row) => ({
      answerId: row.id,
      teamId: row.team.id,
      teamName: row.team.name,
      value: row.value,
      pointsAwarded: row.pointsAwarded,
      gradedAt: row.gradedAt?.toISOString() ?? null,
    }));
  }

  /**
   * IDs among `questionIds` that have at least one submitted answer still
   * missing `gradedAt` — the source of truth behind the "not yet graded"
   * gate/dot. `questionIds` is expected to already exclude closest_guess
   * questions (they grade themselves automatically); this method doesn't
   * care about type, it just reports what's ungraded.
   */
  async listUngradedQuestionIds(
    gameSessionId: number,
    questionIds: number[],
  ): Promise<number[]> {
    if (questionIds.length === 0) return [];
    const knex = this.answers.getKnex();
    const rows = (await knex('answers')
      .where('game_session_id', gameSessionId)
      .whereIn('question_id', questionIds)
      .whereNull('graded_at')
      .distinct('question_id')) as { question_id: number }[];
    return rows.map((row) => row.question_id);
  }

  async listForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamAnswerView[]> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      team: teamId,
    });
    return rows.map((row) => ({
      questionId: row.question.id,
      value: row.value,
      pointsAwarded: row.pointsAwarded,
      gradedAt: row.gradedAt?.toISOString() ?? null,
    }));
  }

  async grade(
    gameSessionId: number,
    answerId: number,
    pointsAwarded: number,
  ): Promise<GradedAnswer> {
    const answer = await this.answers.findOneOrFail(
      { id: answerId, gameSession: gameSessionId },
      { populate: ['question'] },
    );
    if (answer.question.type === 'closest_guess') {
      throw new Error(
        'closest_guess answers are graded automatically and cannot be graded manually',
      );
    }
    answer.pointsAwarded = pointsAwarded;
    answer.gradedAt = new Date();
    await this.answers.getEntityManager().flush();
    return { questionId: answer.question.id };
  }

  /**
   * Batch-grades every submitted guess for a closest_guess question against
   * the correct numeric answer: every team tied for the smallest distance
   * gets full question points (no splitting), everyone else gets zero. Can
   * only run once all teams are done answering (needs every guess to know
   * who's closest), unlike the exact-match types graded at submit() time.
   * Safe to call more than once for the same question — unconditionally
   * recomputes and overwrites, same "recompute is idempotent" convention as
   * computeLeaderboard.
   */
  async gradeClosestGuess(
    gameSessionId: number,
    questionId: number,
    correctAnswer: string,
    questionPoints: number,
  ): Promise<AnswerView[]> {
    const rows = await this.answers.find(
      { gameSession: gameSessionId, question: questionId },
      { populate: ['team'] },
    );
    if (rows.length === 0) return [];

    const target = Number(correctAnswer);
    const distances = rows.map((row) => {
      const parsed = Number(row.value);
      return {
        row,
        distance: Number.isFinite(parsed)
          ? Math.abs(parsed - target)
          : Infinity,
      };
    });
    const minDistance = Math.min(...distances.map((d) => d.distance));

    const now = new Date();
    for (const { row, distance } of distances) {
      row.pointsAwarded =
        Number.isFinite(distance) && distance === minDistance
          ? questionPoints
          : 0;
      row.gradedAt = now;
    }
    await this.answers.getEntityManager().flush();

    return rows
      .map((row) => ({
        answerId: row.id,
        teamId: row.team.id,
        teamName: row.team.name,
        value: row.value,
        pointsAwarded: row.pointsAwarded,
        gradedAt: row.gradedAt!.toISOString(),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  /**
   * Rescales an already-graded kahootMode question's points by answer speed:
   * a team that answered the instant the question opened keeps 100% of
   * `points`, one that answered right as it locked keeps a 50% floor, linear
   * in between. Only touches rows already correct (pointsAwarded > 0) —
   * wrong answers stay at 0 regardless of speed. Uses `updatedAt` (not
   * `createdAt`) since submit()'s upsert already treats updatedAt as "last
   * resubmission time" for a team that revises before lock. Idempotent/
   * recomputable, same convention as gradeClosestGuess.
   */
  async applyKahootSpeedScoring(
    gameSessionId: number,
    questionId: number,
    questionOpenedAt: number,
    lockedAt: number,
    points: number,
  ): Promise<void> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      question: questionId,
      pointsAwarded: { $gt: 0 },
    });
    if (rows.length === 0) return;

    const totalWindowMs = lockedAt - questionOpenedAt;
    for (const row of rows) {
      const elapsedMs = row.updatedAt.getTime() - questionOpenedAt;
      const rawFraction = totalWindowMs > 0 ? elapsedMs / totalWindowMs : 0;
      const fraction = 1 - Math.min(Math.max(rawFraction, 0), 1);
      row.pointsAwarded = Math.round(
        points *
          (KAHOOT_MIN_SCORE_FRACTION + KAHOOT_SPEED_SCORE_FRACTION * fraction),
      );
    }
    await this.answers.getEntityManager().flush();
  }

  async computeLeaderboard(gameSessionId: number): Promise<LeaderboardEntry[]> {
    const knex = this.gameSessionTeams.getKnex();
    // Pre-aggregated as subqueries (rather than two leftJoins straight off
    // "t") so a team with several answers *and* several bonus awards doesn't
    // fan out into a cross product that inflates both sums.
    const answerTotals = knex('answers')
      .where('game_session_id', gameSessionId)
      .groupBy('team_id')
      .select('team_id')
      .select(knex.raw('sum(points_awarded) as total'));
    const bonusTotals = knex('bonus_awards')
      .where('game_session_id', gameSessionId)
      .groupBy('team_id')
      .select('team_id')
      .select(knex.raw('sum(points) as total'))
      .select(
        knex.raw(
          'sum(case when points > 0 then points else 0 end) as positive_total',
        ),
      )
      .select(
        knex.raw(
          'sum(case when points < 0 then points else 0 end) as negative_total',
        ),
      );

    const rows = (await knex('game_session_teams as gst')
      .join('teams as t', 't.id', 'gst.team_id')
      .leftJoin(answerTotals.as('ans'), 'ans.team_id', 't.id')
      .leftJoin(bonusTotals.as('bonus'), 'bonus.team_id', 't.id')
      .where('gst.game_session_id', gameSessionId)
      .select('t.id as teamId', 't.name as teamName')
      .select(knex.raw('coalesce(ans.total, 0) as "quizPoints"'))
      .select(knex.raw('coalesce(bonus.total, 0) as "bonusPoints"'))
      .select(
        knex.raw('coalesce(bonus.positive_total, 0) as "positiveBonusPoints"'),
      )
      .select(
        knex.raw('coalesce(bonus.negative_total, 0) as "negativeBonusPoints"'),
      )
      .orderBy([
        {
          column: knex.raw('coalesce(ans.total, 0) + coalesce(bonus.total, 0)'),
          order: 'desc',
        },
        { column: 't.name', order: 'asc' },
      ])) as LeaderboardRow[];

    // Rounds belong to the session's *current* quiz, not necessarily the one
    // any given answer was graded under (a mid-game re-import can swap it).
    const rounds = (await knex('rounds as r')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .where('gs.id', gameSessionId)
      .orderBy('r.order_index', 'asc')
      .select('r.id as roundId', 'r.title as roundTitle')) as RoundRow[];

    const roundTotals = (await knex('answers as a')
      .join('questions as q', 'q.id', 'a.question_id')
      .where('a.game_session_id', gameSessionId)
      .groupBy('q.round_id', 'a.team_id')
      .select('q.round_id as roundId', 'a.team_id as teamId')
      .select(knex.raw('sum(a.points_awarded) as total'))) as RoundTotalRow[];

    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      totalPoints: Number(row.quizPoints) + Number(row.bonusPoints),
      bonusPoints: Number(row.bonusPoints),
      positiveBonusPoints: Number(row.positiveBonusPoints),
      negativeBonusPoints: Number(row.negativeBonusPoints),
      roundPoints: rounds.map((round) => ({
        roundTitle: round.roundTitle,
        points: Number(
          roundTotals.find(
            (total) =>
              total.roundId === round.roundId && total.teamId === row.teamId,
          )?.total ?? 0,
        ),
      })),
    }));
  }
}
