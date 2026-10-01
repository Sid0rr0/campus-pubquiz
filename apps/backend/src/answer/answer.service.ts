import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  ScoredQuestion,
  TeamAnswerView,
  Verdict,
} from '@campus-pubquiz/types';
import {
  gradeAtSubmit,
  gradeClosestGuessBatch,
  isAutoGradedType,
  isMatchOrHumanType,
  isOverridableType,
  scoreSubmission,
  verdictForManualGrade,
} from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { readQuestionPayload } from '@/db/question-payload';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';

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
    const question: ScoredQuestion = {
      type: row.type,
      answer: row.answer,
      points: row.points,
      matchScoringMode: readQuestionPayload(row).matchScoringMode,
    };
    // Whether a submission is graded the instant it lands, and how, is
    // Scoring's concern (gradeAtSubmit): auto types always, free_text/audio/
    // youtube only when it matches the key, closest_guess never. A null
    // score leaves the answer for the moderator (or the lock-time batch).
    const score = gradeAtSubmit(question, value);
    const pointsAwarded = score?.points ?? 0;

    // The admin can grade an answer as soon as it lands (grade() has no
    // status gate — see control's "Grade Questions" panel), well before the
    // block locks. A team can then revise its answer (last-write-wins,
    // allowed until lock) — if that revision changes the value, any manual
    // grade already given belongs to the *old* value and must not silently
    // carry over onto the new one, so a revision with no automatic grade
    // goes back to ungraded. Resubmitting the same value to a
    // match-or-human question leaves its grade alone, so the moderator's
    // survives.
    const existing = await this.answers.findOne(
      { gameSession: gameSessionId, question: questionId, team: teamId },
      { fields: ['value', 'gradedAt'] },
    );
    const isSameValue = existing !== null && existing.value === value;
    const keepsGrade =
      isMatchOrHumanType(question.type) &&
      isSameValue &&
      existing.gradedAt !== null;
    const appliesScore = score !== null && !keepsGrade;
    const resetsGrading = score === null && existing !== null && !isSameValue;

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
        ...(appliesScore ? { gradedAt: now, verdict: score.verdict } : {}),
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
      verdict: row.verdict,
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
    // Auto-graded types (match's per-pair partial credit, a free_text
    // synonym the exact match missed) are only a starting point — the quiz
    // master may override them here. closest_guess can't be overridden: it's
    // recomputed as a batch.
    if (!isOverridableType(answer.question.type)) {
      throw new Error(
        'closest_guess answers are graded automatically and cannot be graded manually',
      );
    }
    answer.pointsAwarded = pointsAwarded;
    answer.verdict = verdictForManualGrade(answer.question, pointsAwarded);
    answer.gradedAt = new Date();
    await this.answers.getEntityManager().flush();
    return { questionId: answer.question.id };
  }

  /**
   * Re-scores every existing answer to an auto-graded question (see
   * Scoring's AUTO_GRADED_TYPES) against the corrected `question` — used
   * after a live edit to an already-shown question. Deliberately overwrites
   * any manual override (e.g. adjusted match partial credit): the key it was
   * judged against just changed, and the admin can override again in break.
   * `kahootTimerSeconds` is the session's configured kahoot question timer
   * for a kahootMode question, null otherwise (or when unlimited): when set,
   * each answer is speed-scaled by the response time stored at submit, so a
   * regrade after a backend restart gives the same points as one without.
   */
  async regradeAutoGraded(
    gameSessionId: number,
    question: GradableQuestion,
    kahootTimerSeconds: number | null = null,
  ): Promise<void> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      question: question.id,
    });
    if (rows.length === 0) return;

    const timerMs =
      kahootTimerSeconds === null ? null : kahootTimerSeconds * 1000;
    const now = new Date();
    for (const row of rows) {
      const score = scoreSubmission(
        question,
        row.value,
        timerMs === null ? undefined : { responseMs: row.responseMs, timerMs },
      );
      row.pointsAwarded = score.points;
      row.verdict = score.verdict;
      row.gradedAt = now;
    }
    await this.answers.getEntityManager().flush();
  }

  /**
   * Re-grades every existing answer to a match-or-human question (see
   * Scoring's MATCH_OR_HUMAN_TYPES) against the corrected `question`, after a
   * live edit to an already-shown question. An answer matching the corrected
   * key is graded correct. A non-matching one keeps the moderator's grade,
   * and goes back to ungraded only if it was graded automatically — told
   * apart by re-running the submit-time grade against `previous`, the
   * question as it stood before the edit: a grade that equals what the old
   * key would have given automatically was automatic, anything else was the
   * moderator's.
   */
  async regradeMatchOrHuman(
    gameSessionId: number,
    question: GradableQuestion,
    previous: ScoredQuestion,
  ): Promise<void> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      question: question.id,
    });
    if (rows.length === 0) return;

    const now = new Date();
    for (const row of rows) {
      const score = gradeAtSubmit(question, row.value);
      if (score) {
        row.pointsAwarded = score.points;
        row.verdict = score.verdict;
        row.gradedAt = now;
        continue;
      }
      const previousScore = gradeAtSubmit(previous, row.value);
      const wasGradedAutomatically =
        previousScore !== null &&
        row.gradedAt !== null &&
        row.verdict === previousScore.verdict &&
        row.pointsAwarded === previousScore.points;
      if (wasGradedAutomatically) {
        row.pointsAwarded = 0;
        row.verdict = null;
        row.gradedAt = null;
      }
    }
    await this.answers.getEntityManager().flush();
  }

  /**
   * Batch-grades every submitted guess for a closest_guess question (see
   * Scoring's gradeClosestGuessBatch for the rule). Can only run once all
   * teams are done answering (needs every guess to know who's closest),
   * unlike the types graded at submit() time. Safe to call more than once
   * for the same question — unconditionally recomputes from the stored guesses and overwrites.
   */
  async gradeClosestGuess(
    gameSessionId: number,
    question: GradableQuestion,
  ): Promise<AnswerView[]> {
    const rows = await this.answers.find(
      { gameSession: gameSessionId, question: question.id },
      { populate: ['team'] },
    );
    if (rows.length === 0) return [];

    const results = gradeClosestGuessBatch(
      question,
      rows.map((row) => row.value),
    );
    const now = new Date();
    rows.forEach((row, index) => {
      row.pointsAwarded = results[index].points;
      row.verdict = results[index].verdict;
      row.gradedAt = now;
    });
    await this.answers.getEntityManager().flush();

    return rows
      .map((row) => ({
        answerId: row.id,
        teamId: row.team.id,
        teamName: row.team.name,
        value: row.value,
        pointsAwarded: row.pointsAwarded,
        gradedAt: row.gradedAt!.toISOString(),
        verdict: row.verdict,
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
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
  async applyKahootSpeedScoring(
    gameSessionId: number,
    question: GradableQuestion,
    questionTimerSeconds: number | null,
  ): Promise<void> {
    // Kahoot rounds only hold auto-graded types (Scoring's
    // KAHOOT_ALLOWED_TYPES); never overwrite a human or batch grade.
    if (!isAutoGradedType(question.type)) return;
    await this.regradeAutoGraded(gameSessionId, question, questionTimerSeconds);
  }
}
