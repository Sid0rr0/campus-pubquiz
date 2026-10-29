import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  getBreakNumber,
  getQuizStructureSummary,
  questionNotesOf,
  previewToStoredFields,
  rowToPreview,
  type ImportQuestionPreview,
  type ImportRoundPreview,
  type QuestionPayload,
  type QuizDraft,
  type QuizDraftIssue,
  type QuizDraftSaveResult,
  type QuizSummary,
} from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { readQuestionPayload } from '@/db/question-payload';
import { findForeignQuestionIds } from '@/quiz/live-edit-guard';
import { validateQuizDraft } from '@/quiz/quiz-draft.schema';

function toSummaryPayload(question: Question): QuestionPayload {
  const { options, matchTargets } = readQuestionPayload(question);
  return {
    ...(options !== undefined ? { options } : {}),
    ...(matchTargets !== undefined ? { matchTargets } : {}),
  };
}

/** A save carried the version of a copy older than the stored quiz: someone else saved since it was loaded, and this save would overwrite their work. */
export class QuizStaleSaveError extends Error {
  constructor(quizId: number) {
    super(
      `Quiz ${quizId} was changed by someone else since you opened it. Reload the page to see their changes, then make your edits again.`,
    );
    this.name = 'QuizStaleSaveError';
  }
}

export class QuizDraftInvalidError extends Error {
  constructor(public readonly issues: QuizDraftIssue[]) {
    super(
      `The quiz has ${issues.length} validation issue(s) — fix them before saving`,
    );
    this.name = 'QuizDraftInvalidError';
  }
}

export class QuizNotFoundError extends Error {
  constructor(quizId: number) {
    super(`Quiz ${quizId} does not exist`);
    this.name = 'QuizNotFoundError';
  }
}

/**
 * The state machine has no way to reveal answers otherwise, so the last
 * round's break is always forced on regardless of what was submitted —
 * mirrors `assembleImportPreview`'s forcing (which only covers the CSV/Sheets
 * preview step), but this is the one place both the manual quiz editor and
 * import-confirm ultimately save through, so it's the actual guarantee.
 */
function forceLastRoundBreak(
  rounds: ImportRoundPreview[],
): ImportRoundPreview[] {
  return rounds.map((round, index) => ({
    ...round,
    breakAfter: index === rounds.length - 1 ? true : round.breakAfter,
  }));
}

type IdKeyedQuestion = ImportQuestionPreview & { questionId: number };

/** A question without a `questionId` is slot-keyed: matched to a stored row by its (round, position) slot instead. */
function isIdKeyed(
  question: ImportQuestionPreview,
): question is IdKeyedQuestion {
  return question.questionId !== undefined;
}

interface SyncContext {
  quizId: number;
  rounds: ImportRoundPreview[];
  roundRepo: RoundRepository;
  questionRepo: QuestionRepository;
}

/** The counts a save or import confirm reports back for the rounds it wrote. */
export function toSaveResult(
  quizId: number,
  rounds: readonly ImportRoundPreview[],
  updatedAt: Date,
): QuizDraftSaveResult {
  return {
    quizId,
    updatedAt: updatedAt.toISOString(),
    roundCount: rounds.length,
    questionCount: rounds.reduce(
      (total, round) => total + round.questions.length,
      0,
    ),
  };
}

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz) private readonly quizzes: QuizRepository,
    @InjectRepository(Round) private readonly rounds: RoundRepository,
    @InjectRepository(Question) private readonly questions: QuestionRepository,
  ) {}

  async list(): Promise<QuizSummary[]> {
    const quizzes = await this.quizzes.findAllWithRoundsAndQuestions();

    return quizzes.map((quiz) => {
      const rounds = quiz.rounds.getItems();
      const structure = getQuizStructureSummary({
        rounds: rounds.map((round) => ({
          questionCount: round.questions.length,
          breakAfter: round.breakAfter,
        })),
      });
      return {
        id: quiz.id,
        title: quiz.title,
        updatedAt: quiz.updatedAt.toISOString(),
        rounds: rounds.map((round, index) => {
          const breakNumber = getBreakNumber(index, structure);
          return {
            title: round.title,
            ...(round.note ? { note: round.note } : {}),
            ...(round.category ? { category: round.category } : {}),
            ...(round.author ? { author: round.author } : {}),
            breakAfter: round.breakAfter,
            ...(breakNumber > 0
              ? {
                  breakNumber,
                  isFinalBreak: breakNumber === structure.blockCount,
                }
              : {}),
            kahootMode: round.kahootMode,
            questions: round.questions.getItems().map((question) => {
              const notes = questionNotesOf(question.notes);
              return {
                id: question.id,
                type: question.type,
                prompt: question.prompt,
                answer: question.answer,
                ...(notes !== null ? { notes } : {}),
                ...toSummaryPayload(question),
              };
            }),
          };
        }),
      };
    });
  }

  async exists(quizId: number): Promise<boolean> {
    return (await this.quizzes.count({ id: quizId })) > 0;
  }

  /** Ids of the quiz's questions that have at least one stored answer, from any session (running or ended). */
  async answeredQuestionIds(quizId: number): Promise<Set<number>> {
    const rows = (await this.quizzes
      .getKnex()('answers as a')
      .join('questions as q', 'q.id', 'a.question_id')
      .join('rounds as r', 'r.id', 'q.round_id')
      .where('r.quiz_id', quizId)
      .distinct('a.question_id')) as { question_id: number }[];
    return new Set(rows.map((row) => row.question_id));
  }

  /** Full editable quiz for the quiz editor page, or null if the id doesn't exist. */
  async findDraftById(quizId: number): Promise<QuizDraft | null> {
    const quiz = await this.quizzes.findByIdWithRoundsAndQuestions(quizId);
    if (!quiz) return null;

    return {
      id: quiz.id,
      title: quiz.title,
      updatedAt: quiz.updatedAt.toISOString(),
      rounds: quiz.rounds.getItems().map((round) => ({
        title: round.title,
        breakAfter: round.breakAfter,
        kahootMode: round.kahootMode,
        ...(round.category ? { category: round.category } : {}),
        ...(round.author ? { author: round.author } : {}),
        ...(round.note ? { note: round.note } : {}),
        ...(round.showNoteOnScreen ? { showNoteOnScreen: true } : {}),
        questions: round.questions
          .getItems()
          .map((question) =>
            rowToPreview(question, readQuestionPayload(question)),
          ),
      })),
    };
  }

  async create(
    title: string,
    rounds: ImportRoundPreview[],
  ): Promise<QuizDraftSaveResult> {
    const normalizedRounds = forceLastRoundBreak(rounds);
    // A new quiz holds no questions yet, so any id in the draft is another quiz's.
    const issues = [
      ...validateQuizDraft({ title, rounds: normalizedRounds }),
      ...findForeignQuestionIds([], normalizedRounds),
    ];
    if (issues.length > 0) throw new QuizDraftInvalidError(issues);

    const quiz = this.quizzes.create({ title: title.trim() });
    await this.quizzes.getEntityManager().persistAndFlush(quiz);
    const updatedAt = await this.syncRoundsAndQuestions(
      quiz.id,
      normalizedRounds,
    );

    return toSaveResult(quiz.id, normalizedRounds, updatedAt);
  }

  async update(
    quizId: number,
    title: string,
    rounds: ImportRoundPreview[],
  ): Promise<QuizDraftSaveResult> {
    const normalizedRounds = forceLastRoundBreak(rounds);
    const issues = validateQuizDraft({ title, rounds: normalizedRounds });
    if (issues.length > 0) throw new QuizDraftInvalidError(issues);

    const quiz = await this.quizzes.findOne({ id: quizId });
    if (!quiz) throw new QuizNotFoundError(quizId);

    quiz.title = title.trim();
    await this.quizzes.getEntityManager().persistAndFlush(quiz);
    const updatedAt = await this.syncRoundsAndQuestions(
      quizId,
      normalizedRounds,
    );

    return toSaveResult(quizId, normalizedRounds, updatedAt);
  }

  /** Deletes a quiz and, via the DB's `game_sessions.quiz_id` cascade rule, every session ever run from it. Callers must reject this while a live session is running — see QuizController.remove. */
  async remove(quizId: number): Promise<void> {
    const quiz = await this.quizzes.findOne({ id: quizId });
    if (!quiz) throw new QuizNotFoundError(quizId);
    await this.quizzes.getEntityManager().removeAndFlush(quiz);
  }

  /**
   * Upserts a quiz's rounds/questions by `orderIndex`, deleting anything
   * trimmed off the end — shared by CSV import (`ImportService.confirm`) and
   * the manual/CSV-then-edited quiz editor's Save. Questions carrying a
   * `questionId` (an existing DB row, reordered/moved by the editor) are
   * upserted keyed by `id` instead, preserving that row's identity — see
   * `parkIdKeyedQuestions` for why they're moved out of the way first.
   *
   * Runs in one transaction: the up-front delete cascades to answers, so a
   * later park/upsert failure must roll it back rather than lose the rows.
   *
   * Stamps the quiz's `updatedAt` in the same transaction and returns it: the
   * rounds and questions changed even when the title did not, which MikroORM's
   * own onUpdate hook would not notice. A save from an out-of-date copy is
   * recognised by this stamp (see LiveEditService.save), so every write of a
   * quiz's content, a CSV re-import included, has to move it.
   */
  async syncRoundsAndQuestions(
    quizId: number,
    rounds: ImportRoundPreview[],
  ): Promise<Date> {
    const updatedAt = new Date();
    // The callback's EntityManager carries the transaction; the injected
    // repositories may sit on an EntityManager that does not, so use its own.
    await this.quizzes.getEntityManager().transactional(async (em) => {
      await em
        .getRepository<Quiz, QuizRepository>(Quiz)
        .nativeUpdate({ id: quizId }, { updatedAt });
      await this.syncWithin({
        quizId,
        rounds,
        roundRepo: em.getRepository<Round, RoundRepository>(Round),
        questionRepo: em.getRepository<Question, QuestionRepository>(Question),
      });
    });
    return updatedAt;
  }

  private async syncWithin({
    quizId,
    rounds,
    roundRepo,
    questionRepo,
  }: SyncContext): Promise<void> {
    await this.deleteDroppedQuestions(questionRepo, roundRepo, quizId, rounds);
    await this.parkIdKeyedQuestions(questionRepo, rounds);

    for (const [roundIndex, round] of rounds.entries()) {
      // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set
      // timestamps explicitly (see TeamService.addToRoster for the same fix).
      const roundNow = new Date();
      const roundRow = await roundRepo.upsert(
        {
          quiz: quizId,
          title: round.title,
          orderIndex: roundIndex,
          breakAfter: round.breakAfter,
          kahootMode: round.kahootMode ?? false,
          category: round.category ?? null,
          author: round.author ?? null,
          note: round.note?.trim() || null,
          showNoteOnScreen: round.showNoteOnScreen ?? false,
          createdAt: roundNow,
          updatedAt: roundNow,
        },
        {
          onConflictFields: ['quiz', 'orderIndex'],
          onConflictAction: 'merge',
          onConflictMergeFields: [
            'title',
            'breakAfter',
            'kahootMode',
            'category',
            'author',
            'note',
            'showNoteOnScreen',
            'updatedAt',
          ],
        },
      );

      for (const [questionIndex, question] of round.questions.entries()) {
        const questionNow = new Date();
        const questionData = {
          round: roundRow.id,
          orderIndex: questionIndex,
          ...previewToStoredFields(question),
          createdAt: questionNow,
          updatedAt: questionNow,
        };

        if (isIdKeyed(question)) {
          await questionRepo.upsert(
            { id: question.questionId, ...questionData },
            {
              onConflictFields: ['id'],
              onConflictAction: 'merge',
              onConflictMergeFields: [
                'round',
                'orderIndex',
                'type',
                'prompt',
                'answer',
                'notes',
                'payload',
                'points',
                'updatedAt',
              ],
            },
          );
        } else {
          await questionRepo.upsert(questionData, {
            onConflictFields: ['round', 'orderIndex'],
            onConflictAction: 'merge',
            onConflictMergeFields: [
              'type',
              'prompt',
              'answer',
              'notes',
              'payload',
              'points',
              'updatedAt',
            ],
          });
        }
      }

      await questionRepo.nativeDelete({
        round: roundRow.id,
        orderIndex: { $gte: round.questions.length },
      });
    }

    await roundRepo.nativeDelete({
      quiz: quizId,
      orderIndex: { $gte: rounds.length },
    });
  }

  /**
   * Deletes the stored questions the draft drops, before survivors are
   * upserted. A stored row survives only if the draft keeps it by id, or a
   * slot-keyed (no `questionId`) draft question lands on its (round, position)
   * slot and merges into it. Anything else would still hold its
   * `(round, orderIndex)` slot when a survivor moves into it and trip the
   * unique constraint (e.g. Q1, Q2, Q3 saved as Q1, Q3).
   */
  private async deleteDroppedQuestions(
    questionRepo: QuestionRepository,
    roundRepo: RoundRepository,
    quizId: number,
    rounds: ImportRoundPreview[],
  ): Promise<void> {
    const keptIds = rounds.flatMap((round) =>
      round.questions.flatMap((question) =>
        isIdKeyed(question) ? [question.questionId] : [],
      ),
    );
    const storedRounds = await roundRepo.find({ quiz: quizId });

    for (const storedRound of storedRounds) {
      const draftRound = rounds[storedRound.orderIndex];
      const slotKeyedPositions = (draftRound?.questions ?? []).flatMap(
        (question, position) => (isIdKeyed(question) ? [] : [position]),
      );
      await questionRepo.nativeDelete({
        round: storedRound.id,
        id: { $nin: keptIds },
        orderIndex: { $nin: slotKeyedPositions },
      });
    }
  }

  /**
   * Moves every id-keyed question to a temporary, collision-free
   * `orderIndex` before the main sync loop repositions it. Without this, two
   * existing questions swapping places (or one moving into a slot another
   * still occupies) would upsert straight into a `(round, orderIndex)` pair
   * still held by a different row and trip the unique constraint —
   * content-only upserts never had this problem since they always rewrote
   * the row already anchored to that exact grid cell.
   */
  private async parkIdKeyedQuestions(
    questionRepo: QuestionRepository,
    rounds: ImportRoundPreview[],
  ): Promise<void> {
    let tempOrderIndex = -1;
    for (const round of rounds) {
      for (const question of round.questions) {
        if (!isIdKeyed(question)) continue;
        await questionRepo.nativeUpdate(
          { id: question.questionId },
          { orderIndex: tempOrderIndex },
        );
        tempOrderIndex -= 1;
      }
    }
  }
}
