import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  extractYoutubeVideoId,
  parseYoutubeClipFromNotes,
  type ImportQuestionPreview,
  type ImportRoundPreview,
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
import { validateQuizDraft } from '@/quiz/quiz-draft.schema';

interface QuestionPayload {
  options?: string[];
  mediaUrl?: string;
  answerMediaUrl?: string;
}

function toSummaryPayload(payload: unknown): QuestionPayload {
  const { options } = payload as QuestionPayload;
  return {
    ...(options !== undefined ? { options } : {}),
  };
}

function toQuestionPreview(question: Question): ImportQuestionPreview {
  const payload = question.payload as QuestionPayload;
  return {
    type: question.type,
    prompt: question.prompt,
    answer: question.answer,
    points: question.points,
    ...(question.notes ? { notes: question.notes } : {}),
    ...(payload.options ? { options: payload.options } : {}),
    ...(payload.mediaUrl ? { mediaUrl: payload.mediaUrl } : {}),
    ...(payload.answerMediaUrl
      ? { answerMediaUrl: payload.answerMediaUrl }
      : {}),
  };
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

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz) private readonly quizzes: QuizRepository,
    @InjectRepository(Round) private readonly rounds: RoundRepository,
    @InjectRepository(Question) private readonly questions: QuestionRepository,
  ) {}

  /** Titles for the given quiz ids, for the session picker — GameStateService knows quizId but not quiz metadata. */
  async findTitles(quizIds: number[]): Promise<Map<number, string>> {
    if (quizIds.length === 0) return new Map();
    const quizzes = await this.quizzes.find({ id: { $in: quizIds } });
    return new Map(quizzes.map((quiz) => [quiz.id, quiz.title]));
  }

  async list(): Promise<QuizSummary[]> {
    const quizzes = await this.quizzes.findAllWithRoundsAndQuestions();

    return quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      rounds: quiz.rounds.getItems().map((round) => ({
        title: round.title,
        breakAfter: round.breakAfter,
        questions: round.questions.getItems().map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          answer: question.answer,
          ...toSummaryPayload(question.payload),
        })),
      })),
    }));
  }

  /** Full editable quiz for the quiz editor page, or null if the id doesn't exist. */
  async findDraftById(quizId: number): Promise<QuizDraft | null> {
    const quiz = await this.quizzes.findByIdWithRoundsAndQuestions(quizId);
    if (!quiz) return null;

    return {
      id: quiz.id,
      title: quiz.title,
      rounds: quiz.rounds.getItems().map((round) => ({
        title: round.title,
        breakAfter: round.breakAfter,
        questions: round.questions.getItems().map(toQuestionPreview),
      })),
    };
  }

  async create(
    title: string,
    rounds: ImportRoundPreview[],
  ): Promise<QuizDraftSaveResult> {
    const issues = validateQuizDraft({ title, rounds });
    if (issues.length > 0) throw new QuizDraftInvalidError(issues);

    const quiz = this.quizzes.create({ title: title.trim() });
    await this.quizzes.getEntityManager().persistAndFlush(quiz);
    await this.syncRoundsAndQuestions(quiz.id, rounds);

    return this.toSaveResult(quiz.id, rounds);
  }

  async update(
    quizId: number,
    title: string,
    rounds: ImportRoundPreview[],
  ): Promise<QuizDraftSaveResult> {
    const issues = validateQuizDraft({ title, rounds });
    if (issues.length > 0) throw new QuizDraftInvalidError(issues);

    const quiz = await this.quizzes.findOne({ id: quizId });
    if (!quiz) throw new QuizNotFoundError(quizId);

    quiz.title = title.trim();
    await this.quizzes.getEntityManager().persistAndFlush(quiz);
    await this.syncRoundsAndQuestions(quizId, rounds);

    return this.toSaveResult(quizId, rounds);
  }

  private toSaveResult(
    quizId: number,
    rounds: ImportRoundPreview[],
  ): QuizDraftSaveResult {
    return {
      quizId,
      roundCount: rounds.length,
      questionCount: rounds.reduce(
        (total, round) => total + round.questions.length,
        0,
      ),
    };
  }

  /**
   * Upserts a quiz's rounds/questions by `orderIndex`, deleting anything
   * trimmed off the end — shared by CSV import (`ImportService.confirm`) and
   * the manual/CSV-then-edited quiz editor's Save.
   */
  async syncRoundsAndQuestions(
    quizId: number,
    rounds: ImportRoundPreview[],
  ): Promise<void> {
    for (const [roundIndex, round] of rounds.entries()) {
      // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set
      // timestamps explicitly (see TeamService.addToRoster for the same fix).
      const roundNow = new Date();
      const roundRow = await this.rounds.upsert(
        {
          quiz: quizId,
          title: round.title,
          orderIndex: roundIndex,
          breakAfter: round.breakAfter,
          createdAt: roundNow,
          updatedAt: roundNow,
        },
        {
          onConflictFields: ['quiz', 'orderIndex'],
          onConflictAction: 'merge',
          onConflictMergeFields: ['title', 'breakAfter', 'updatedAt'],
        },
      );

      for (const [questionIndex, question] of round.questions.entries()) {
        const youtubeClip =
          question.mediaUrl && extractYoutubeVideoId(question.mediaUrl)
            ? parseYoutubeClipFromNotes(question.notes)
            : undefined;
        const payload = {
          ...(question.options ? { options: question.options } : {}),
          ...(question.mediaUrl ? { mediaUrl: question.mediaUrl } : {}),
          ...(question.answerMediaUrl
            ? { answerMediaUrl: question.answerMediaUrl }
            : {}),
          ...(youtubeClip?.startSeconds !== undefined
            ? { mediaStartSeconds: youtubeClip.startSeconds }
            : {}),
          ...(youtubeClip?.endSeconds !== undefined
            ? { mediaEndSeconds: youtubeClip.endSeconds }
            : {}),
        };
        const questionNow = new Date();
        await this.questions.upsert(
          {
            round: roundRow.id,
            orderIndex: questionIndex,
            type: question.type,
            prompt: question.prompt,
            answer: question.answer,
            notes: question.notes ?? null,
            payload,
            points: question.points,
            createdAt: questionNow,
            updatedAt: questionNow,
          },
          {
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
          },
        );
      }

      await this.questions.nativeDelete({
        round: roundRow.id,
        orderIndex: { $gte: round.questions.length },
      });
    }

    await this.rounds.nativeDelete({
      quiz: quizId,
      orderIndex: { $gte: rounds.length },
    });
  }
}
