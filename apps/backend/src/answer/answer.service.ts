import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  LeaderboardEntry,
  QuestionType,
  TeamAnswerView,
} from '@campus-pubquiz/types';
import { splitPipeList } from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';

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

export const AUTO_GRADED_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'sort',
  'match',
];

/**
 * multiple_choice/sort are all-or-nothing (one exact-match correct value) —
 * and so is anything else that reaches here, since only multiple_choice,
 * sort, and match are ever auto-graded (AUTO_GRADED_TYPES above); the `else`
 * branch below is a catch-all for those two, not an enumerated case, so a
 * future auto-graded type would silently get exact-match grading unless
 * this function is taught about it explicitly. match instead awards partial
 * credit per correctly paired item — both `value` and `question.answer` are
 * the pipe-joined right-hand items in the question's `options` (left-hand)
 * order (see question-row.schema.ts's toCanonicalMatchAnswer and
 * AnswerForm's match UI), so comparing them positionally counts correctly
 * matched pairs directly. Points split evenly across pairs and round to the
 * nearest whole point (e.g. 4 points/4 pairs, 1 correct -> 1 point).
 * `pointsAwarded` is stored as an integer, so when `points` is smaller than
 * the pair count, distinct partial-credit levels can round to the same
 * value (e.g. 1 point/4 pairs: both 0-of-4 and 1-of-4 correct round to 0) —
 * author match questions with points >= pair count for meaningful partial
 * credit.
 */
function computeAutoGradedPoints(
  type: QuestionType,
  value: string,
  answer: string,
  points: number,
): number {
  if (type === 'match') {
    const answerPairs = splitPipeList(answer);
    const submittedPairs = splitPipeList(value);
    const correctPairs = answerPairs.filter(
      (rightItem, index) => rightItem === submittedPairs[index],
    ).length;
    return Math.round((points * correctPairs) / answerPairs.length);
  }
  return value === answer ? points : 0;
}

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
    // Multiple choice, sort, and match are all gradable without admin
    // judgement the instant they're submitted (enforced at import/save time
    // — see question-row.schema.ts and quiz-draft.schema.ts), unlike
    // free_text/audio. multiple_choice/sort are all-or-nothing; match splits
    // points per correctly paired item — see computeAutoGradedPoints.
    const isAutoGraded = AUTO_GRADED_TYPES.includes(question.type);
    const pointsAwarded = isAutoGraded
      ? computeAutoGradedPoints(
          question.type,
          value,
          question.answer,
          question.points,
        )
      : 0;

    // The admin can grade free_text/audio/youtube answers as soon as they
    // land (grade() has no status gate — see control's "Grade Questions"
    // panel), well before the block locks. A team can then revise its answer
    // (last-write-wins, allowed until lock) — if that revision changes the
    // value, any manual grade already given belongs to the *old* value and
    // must not silently carry over onto the new one.
    const existing = await this.answers.findOne(
      { gameSession: gameSessionId, question: questionId, team: teamId },
      { fields: ['value'] },
    );
    const resetsGrading =
      !isAutoGraded && existing !== null && existing.value !== value;

    // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set the
    // timestamps explicitly (see TeamService.addToRoster for the same fix).
    const now = new Date();
    const answer = await this.answers.upsert(
      {
        gameSession: gameSessionId,
        question: questionId,
        team: teamId,
        value,
        pointsAwarded,
        ...(isAutoGraded ? { gradedAt: now } : {}),
        ...(resetsGrading ? { gradedAt: null } : {}),
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields:
          isAutoGraded || resetsGrading
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
    // match is auto-graded at submit time too, but its per-pair partial credit
    // is only a starting point — the quiz master may override it here.
    // closest_guess can't be overridden: it's recomputed as a batch.
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
   * Re-scores every existing answer to an auto-graded question (see
   * AUTO_GRADED_TYPES) against a corrected answer key/points — used after a
   * live edit to an already-shown question. Deliberately overwrites any
   * manual override (e.g. adjusted match partial credit): the key it was
   * judged against just changed, and the admin can override again in break.
   * `type`/`answer`/`points` are passed in, same as applyKahootSpeedScoring.
   * `speedMultipliers` (answer id -> multiplier, as returned by
   * applyKahootSpeedScoring) re-applies a kahootMode question's speed
   * scaling; an answer missing from it keeps unscaled points.
   */
  async regradeAutoGraded(
    gameSessionId: number,
    questionId: number,
    type: QuestionType,
    answer: string,
    points: number,
    speedMultipliers: Readonly<Record<number, number>> = {},
  ): Promise<void> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      question: questionId,
    });
    if (rows.length === 0) return;

    const now = new Date();
    for (const row of rows) {
      const basePoints = computeAutoGradedPoints(
        type,
        row.value,
        answer,
        points,
      );
      row.pointsAwarded = Math.round(
        basePoints * (speedMultipliers[row.id] ?? 1),
      );
      row.gradedAt = now;
    }
    await this.answers.getEntityManager().flush();
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
   * Rescales an already-graded kahootMode question's points by answer speed,
   * using Kahoot's own scoring formula: score = round((1 - (responseTime /
   * questionTimer) / 2) * points) — a same-instant answer keeps 100% of
   * `points`, one that answers right as the timer runs out keeps a 50%
   * floor, linear in between. `questionTimer` is the session's configured
   * `kahootQuestionTimerSeconds` (the real, fixed timer), not however long
   * the question actually stayed open — so a manual early lock doesn't
   * distort the ratio the way using the actual elapsed window would. When
   * no timer is configured (unlimited), speed conveys no information, so
   * every correct answer keeps full points. Re-scores every row against
   * `answer` (so a key corrected before lock counts) — wrong answers stay at
   * 0 regardless of speed. Uses `updatedAt` (not `createdAt`) since submit()'s upsert
   * already treats updatedAt as "last resubmission time" for a team that
   * revises before lock. Idempotent/recomputable, same convention as
   * gradeClosestGuess — each call recomputes speed-scaling from the row's
   * pre-scaling auto-graded points (via computeAutoGradedPoints against the
   * stored value/answer), not from whatever pointsAwarded currently holds,
   * so a redundant re-run never compounds the scaling on top of itself. That
   * matters for `match`, whose auto-graded points are already a partial
   * fraction of `points` (see computeAutoGradedPoints) rather than always
   * the full amount. `questionType`/`answer`/`points` are passed in rather
   * than re-fetched — the caller (kahootMode's question-lock transition)
   * already has them from the seeded game's RevealQuestionView.
   *
   * Returns every answer's speed multiplier (answer id -> `1 - fraction / 2`),
   * wrong answers included, for the caller to keep: the flush below bumps
   * `updatedAt` (TimestampedEntity's onUpdate hook), so the response times
   * can't be recovered afterwards — regradeAutoGraded needs these to re-apply
   * speed scaling if the answer key is corrected later. Empty when no timer
   * is configured (speed conveys nothing, so nothing to re-apply).
   */
  async applyKahootSpeedScoring(
    gameSessionId: number,
    questionId: number,
    questionOpenedAt: number,
    questionTimerSeconds: number | null,
    questionType: QuestionType,
    answer: string,
    points: number,
  ): Promise<Record<number, number>> {
    if (questionTimerSeconds === null) return {};

    const rows = await this.answers.find({
      gameSession: gameSessionId,
      question: questionId,
    });
    if (rows.length === 0) return {};

    const questionTimerMs = questionTimerSeconds * 1000;
    const multipliers: Record<number, number> = {};
    for (const row of rows) {
      const responseTimeMs = row.updatedAt.getTime() - questionOpenedAt;
      const rawFraction = Math.min(
        Math.max(responseTimeMs / questionTimerMs, 0),
        1,
      );
      multipliers[row.id] = 1 - rawFraction / 2;
    }
    // Every row is re-scored against `answer` (not just rows already > 0):
    // the key may have been corrected by a live edit since submit() graded
    // them. A wrong answer's base is 0, so it stays 0 regardless of speed.
    for (const row of rows) {
      const basePoints = computeAutoGradedPoints(
        questionType,
        row.value,
        answer,
        points,
      );
      row.pointsAwarded = Math.round(basePoints * multipliers[row.id]);
    }
    await this.answers.getEntityManager().flush();
    return multipliers;
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
