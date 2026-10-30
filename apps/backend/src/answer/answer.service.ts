import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  PowerUpId,
  ScoredQuestion,
  TeamAnswerView,
  Verdict,
} from '@campus-pubquiz/types';
import { verdictForManualGrade, withWiderMargin } from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import {
  canGradeByHand,
  gradeOnKeyFix,
  gradeOnSubmit,
  gradingStateOf,
  lockBatchWrites,
  speedScore,
  type GradeWrite,
  type StoredAnswerRow,
} from '@/answer/grading-policy';

export interface SubmittedAnswer {
  answerId: number;
  teamId: number;
  teamName: string;
  value: string;
  pointsAwarded: number;
  gradedAt: string | null;
  verdict: Verdict | null;
}

/** A hand grade the Grading policy turns down; its message is for the quiz master. */
export class AnswerGradeRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnswerGradeRefusedError';
  }
}

/** A question as grading sees it: the scoring inputs plus the id its answers hang off. SeededQuestion satisfies it. */
export type GradableQuestion = ScoredQuestion & { id: number };

type MergeField =
  | 'value'
  | 'updatedAt'
  | 'pointsAwarded'
  | 'gradedAt'
  | 'verdict'
  | 'responseMs';

const UNGRADED_MERGE_FIELDS: MergeField[] = [
  'value',
  'updatedAt',
  'responseMs',
];
const GRADED_MERGE_FIELDS: MergeField[] = [
  'value',
  'updatedAt',
  'pointsAwarded',
  'gradedAt',
  'verdict',
  'responseMs',
];

/** The grade columns a submit upserts, and the columns a conflict merges, for the policy's grade write. */
function upsertGradeOf(write: GradeWrite, now: Date) {
  switch (write.kind) {
    case 'set':
      return {
        values: {
          pointsAwarded: write.points,
          gradedAt: now,
          verdict: write.verdict,
        },
        mergeFields: GRADED_MERGE_FIELDS,
      };
    case 'clear':
      return {
        values: { pointsAwarded: 0, gradedAt: null, verdict: null },
        mergeFields: GRADED_MERGE_FIELDS,
      };
    case 'keep':
      return {
        values: { pointsAwarded: 0 },
        mergeFields: UNGRADED_MERGE_FIELDS,
      };
  }
}

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer) private readonly answers: AnswerRepository,
    @InjectRepository(Team) private readonly teams: TeamRepository,
  ) {}

  /** Stores a team's answer to `question` (the session's copy) and grades it as the Grading policy decides. */
  async submit(
    gameSessionId: number,
    question: GradableQuestion,
    teamId: number,
    value: string,
    responseMs: number | null = null,
  ): Promise<SubmittedAnswer> {
    const questionId = question.id;
    // Whether this submission sets, clears or keeps the stored grade is the
    // Grading policy's call. The admin can grade an answer as soon as it
    // lands, well before the block locks, and a team can then revise it
    // (last-write-wins until lock): the policy decides what survives.
    const existing = await this.answers.findOne(
      { gameSession: gameSessionId, question: questionId, team: teamId },
      { fields: ['value', 'gradedAt'] },
    );
    const write = gradeOnSubmit(
      (await this.widerMarginTeamIds(gameSessionId, questionId)).has(teamId)
        ? withWiderMargin(question)
        : question,
      value,
      existing,
    );

    // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set the
    // timestamps explicitly (see TeamService.addToRoster for the same fix).
    const now = new Date();
    const grade = upsertGradeOf(write, now);
    const answer = await this.answers.upsert(
      {
        gameSession: gameSessionId,
        question: questionId,
        team: teamId,
        value,
        responseMs,
        ...grade.values,
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields: grade.mergeFields,
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
      verdict: answer.verdict,
    };
  }

  /** The teams that bought a wider margin on the question: graded against the widened one. */
  private async widerMarginTeamIds(
    gameSessionId: number,
    questionId: number,
  ): Promise<Set<number>> {
    const rows = (await this.answers
      .getKnex()('purchases')
      .where({
        game_session_id: gameSessionId,
        question_id: questionId,
        power_up: 'wider_margin',
      })
      .select('team_id as teamId')) as { teamId: number }[];
    return new Set(rows.map(({ teamId }) => teamId));
  }

  /** The rows as the policy reads them, each flagged when its team's margin is widened. */
  private async policyRows(
    gameSessionId: number,
    questionId: number,
    rows: readonly Answer[],
  ): Promise<StoredAnswerRow[]> {
    const wider = await this.widerMarginTeamIds(gameSessionId, questionId);
    return rows.map((row) => ({
      value: row.value,
      gradedAt: row.gradedAt,
      responseMs: row.responseMs,
      verdict: row.verdict,
      pointsAwarded: row.pointsAwarded,
      hasWiderMargin: wider.has(row.team.id),
    }));
  }

  async listForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<AnswerView[]> {
    return await this.viewsOf(
      gameSessionId,
      questionId,
      await this.findForQuestion(gameSessionId, questionId),
    );
  }

  /** `rows` (a question's answers) as admin answer views, each with the power-ups its team used on the question. */
  private async viewsOf(
    gameSessionId: number,
    questionId: number,
    rows: readonly Answer[],
  ): Promise<AnswerView[]> {
    const used = (await this.answers
      .getKnex()('purchases')
      .where({ game_session_id: gameSessionId, question_id: questionId })
      .orderBy('id')
      .select('team_id as teamId', 'power_up as powerUp')) as {
      teamId: number;
      powerUp: PowerUpId;
    }[];
    return rows.map((row) =>
      toAnswerView(
        row,
        used
          .filter(({ teamId }) => teamId === row.team.id)
          .map((u) => u.powerUp),
      ),
    );
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
      verdict: row.verdict,
    }));
  }

  /** The id of the question a stored answer in this session is for; throws for an unknown answer. */
  async questionIdOf(gameSessionId: number, answerId: number): Promise<number> {
    const answer = await this.answers.findOneOrFail({
      id: answerId,
      gameSession: gameSessionId,
    });
    return answer.question.id;
  }

  /** Hand-grades a stored answer against `question`, the session's copy of the question it answers; throws if the answer is not to that question. */
  async grade(
    gameSessionId: number,
    answerId: number,
    question: GradableQuestion,
    pointsAwarded: number,
  ): Promise<void> {
    const answer = await this.answers.findOneOrFail({
      id: answerId,
      gameSession: gameSessionId,
      question: question.id,
    });
    // Whether this answer may be hand-graded yet is the Grading policy's
    // call (a batch answer only once its batch has run).
    if (!canGradeByHand(question, answer)) {
      throw new AnswerGradeRefusedError(
        `${question.type} answers can only be graded by hand once the block locks`,
      );
    }
    answer.pointsAwarded = pointsAwarded;
    answer.verdict = verdictForManualGrade(question, pointsAwarded);
    answer.gradedAt = new Date();
    await this.answers.getEntityManager().flush();
  }

  /**
   * Regrade for a key fix: re-grades the stored answers to an already-shown
   * question after a live edit corrected its key, as the Grading policy
   * decides (auto rescores every answer, kahoot speed-scaled when
   * `kahootTimerSeconds` is given; match-or-human grades new matches correct
   * and clears only automatic grades; batch re-runs only when
   * `hasBatchRun`). `previous` is the question as it stood before the edit.
   * Returns whether the question was rescored at all, and its answers.
   */
  async regradeForKeyFix(
    gameSessionId: number,
    question: GradableQuestion,
    previous: ScoredQuestion,
    kahootTimerSeconds: number | null,
    hasBatchRun: boolean,
  ): Promise<{ rescored: boolean; answers: AnswerView[] }> {
    const rows = await this.findForQuestion(gameSessionId, question.id);
    const { rescored, writes } = gradeOnKeyFix({
      question,
      previous,
      rows: await this.policyRows(gameSessionId, question.id, rows),
      kahootTimerSeconds,
      hasBatchRun,
    });
    await this.applyWrites(rows, writes);
    return {
      rescored,
      answers: await this.viewsOf(gameSessionId, question.id, rows),
    };
  }

  /** Applies the policy's grade writes (one per row), stamping one grading time per flush; keep is a no-op. */
  private async applyWrites(
    rows: readonly Answer[],
    writes: readonly GradeWrite[],
  ): Promise<void> {
    const now = new Date();
    let isChanged = false;
    rows.forEach((row, index) => {
      const write = writes[index];
      if (write === undefined || write.kind === 'keep') return;
      isChanged = true;
      if (write.kind === 'set') {
        row.pointsAwarded = write.points;
        row.verdict = write.verdict;
        row.gradedAt = now;
      } else {
        row.pointsAwarded = 0;
        row.verdict = null;
        row.gradedAt = null;
      }
    });
    if (isChanged) await this.answers.getEntityManager().flush();
  }

  /**
   * Grade at the lock: applies the Grading policy's batch for a question
   * graded when its block locks (the policy writes nothing once the stored
   * answers show the batch already ran, so a backend restart, which forgets
   * the in-memory summaries, never wipes the quiz master's overrides).
   * Returns the answers either way.
   */
  async gradeAtLock(
    gameSessionId: number,
    question: GradableQuestion,
  ): Promise<AnswerView[]> {
    const rows = await this.findForQuestion(gameSessionId, question.id);
    await this.applyWrites(rows, lockBatchWrites(question, rows));
    return await this.viewsOf(gameSessionId, question.id, rows);
  }

  /** Every answer to one question, with its team and the question (one extra query, not one per answer), ordered by team name. */
  private findForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<Answer[]> {
    return this.answers.find(
      { gameSession: gameSessionId, question: questionId },
      { populate: ['team', 'question'], orderBy: { team: { name: 'asc' } } },
    );
  }

  /**
   * Scales a kahootMode question's points by answer speed once it locks (the
   * formula lives in Scoring's speedMultiplier), reading each answer's
   * response time as stored at submit — measured from the phase start and
   * overwritten on every resubmission, so a team that revises before lock is
   * timed from its last submission. `questionTimerSeconds` is the session's
   * configured `kahootQuestionTimerSeconds` (the real, fixed timer), not
   * however long the question actually stayed open — so a manual early lock
   * doesn't distort the ratio; null (unlimited) means no scaling. Re-scores
   * every row against `question`, so a key corrected before lock counts —
   * wrong answers stay at 0 regardless of speed. Idempotent: scores are
   * recomputed from the stored value and response time, never from the
   * current pointsAwarded, so a redundant re-run can't compound the scaling.
   */
  async speedScoreAtLock(
    gameSessionId: number,
    question: GradableQuestion,
    questionTimerSeconds: number | null,
  ): Promise<void> {
    const rows = await this.findForQuestion(gameSessionId, question.id);
    await this.applyWrites(
      rows,
      speedScore(
        question,
        await this.policyRows(gameSessionId, question.id, rows),
        questionTimerSeconds,
      ),
    );
  }
}

/** An answer row as the admin's answer list shows it; the one place a stored answer becomes an admin answer view, its grading state asked of the Grading policy. */
function toAnswerView(row: Answer, powerUps: PowerUpId[]): AnswerView {
  return {
    powerUps,
    answerId: row.id,
    teamId: row.team.id,
    teamName: row.team.name,
    value: row.value,
    pointsAwarded: row.pointsAwarded,
    gradingState: gradingStateOf(row.question, row),
    gradedAt: row.gradedAt?.toISOString() ?? null,
    verdict: row.verdict,
  };
}
