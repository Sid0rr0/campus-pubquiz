import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  ScoredQuestion,
  TeamAnswerView,
  Verdict,
} from '@campus-pubquiz/types';
import { verdictForManualGrade } from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { readQuestionPayload } from '@/db/question-payload';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import {
  canGradeByHand,
  gradeAtLock,
  gradeOnKeyFix,
  gradeOnSubmit,
  speedScore,
  type GradeWrite,
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

export interface GradedAnswer {
  questionId: number;
}

/** A question as grading sees it: the scoring inputs plus the id its answers hang off. RevealQuestionView satisfies it. */
export type GradableQuestion = ScoredQuestion & { id: number };

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer) private readonly answers: AnswerRepository,
    @InjectRepository(Team) private readonly teams: TeamRepository,
    @InjectRepository(Question)
    private readonly questions: QuestionRepository,
  ) {}

  async submit(
    gameSessionId: number,
    questionId: number,
    teamId: number,
    value: string,
    responseMs: number | null = null,
  ): Promise<SubmittedAnswer> {
    const row = await this.questions.findOneOrFail(questionId, {
      fields: ['type', 'answer', 'points', 'payload'],
    });
    const payload = readQuestionPayload(row);
    const question: ScoredQuestion = {
      type: row.type,
      answer: row.answer,
      points: row.points,
      matchScoringMode: payload.matchScoringMode,
      margin: payload.margin,
    };
    // Whether this submission sets, clears or keeps the stored grade is the
    // Grading policy's call. The admin can grade an answer as soon as it
    // lands, well before the block locks, and a team can then revise it
    // (last-write-wins until lock): the policy decides what survives.
    const existing = await this.answers.findOne(
      { gameSession: gameSessionId, question: questionId, team: teamId },
      { fields: ['value', 'gradedAt'] },
    );
    const write = gradeOnSubmit(question, value, existing);
    const appliesScore = write.kind === 'set';
    const resetsGrading = write.kind === 'clear';
    const pointsAwarded = write.kind === 'set' ? write.points : 0;

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
        responseMs,
        ...(write.kind === 'set'
          ? { gradedAt: now, verdict: write.verdict }
          : {}),
        ...(resetsGrading ? { gradedAt: null, verdict: null } : {}),
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields:
          appliesScore || resetsGrading
            ? [
                'value',
                'updatedAt',
                'pointsAwarded',
                'gradedAt',
                'verdict',
                'responseMs',
              ]
            : ['value', 'updatedAt', 'responseMs'],
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

  async listForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<AnswerView[]> {
    const rows = await this.findForQuestion(gameSessionId, questionId);
    return rows.map(toAnswerView);
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

  async grade(
    gameSessionId: number,
    answerId: number,
    pointsAwarded: number,
  ): Promise<GradedAnswer> {
    const answer = await this.answers.findOneOrFail(
      { id: answerId, gameSession: gameSessionId },
      { populate: ['question'] },
    );
    // Whether this answer may be hand-graded yet is the Grading policy's
    // call (a batch answer only once its batch has run).
    if (!canGradeByHand(answer.question, answer)) {
      throw new Error(
        `${answer.question.type} answers can only be graded by hand once the block locks`,
      );
    }
    answer.pointsAwarded = pointsAwarded;
    answer.verdict = verdictForManualGrade(answer.question, pointsAwarded);
    answer.gradedAt = new Date();
    await this.answers.getEntityManager().flush();
    return { questionId: answer.question.id };
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
      rows,
      kahootTimerSeconds,
      hasBatchRun,
    });
    await this.applyWrites(rows, writes);
    return { rescored, answers: rows.map(toAnswerView) };
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
    await this.applyWrites(rows, gradeAtLock(question, rows));
    return rows.map(toAnswerView);
  }

  /** Every answer to one question, with its team, ordered by team name. */
  private findForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<Answer[]> {
    return this.answers.find(
      { gameSession: gameSessionId, question: questionId },
      { populate: ['team'], orderBy: { team: { name: 'asc' } } },
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
      speedScore(question, rows, questionTimerSeconds),
    );
  }
}

/** An answer row as the admin's answer list shows it. */
function toAnswerView(row: Answer): AnswerView {
  return {
    answerId: row.id,
    teamId: row.team.id,
    teamName: row.team.name,
    value: row.value,
    pointsAwarded: row.pointsAwarded,
    gradedAt: row.gradedAt?.toISOString() ?? null,
    verdict: row.verdict,
  };
}
