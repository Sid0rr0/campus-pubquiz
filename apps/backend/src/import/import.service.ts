import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  createImportPreview,
  type ImportConfirmResult,
  type ImportPreview,
  type ImportRoundPreview,
} from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { GameStateService } from '@/game/game-state.service';
import { assembleImportPreview } from '@/import/question-row.schema';
import { parseSheetCsv, SheetFormatError } from '@/import/sheet-csv.parser';

const DEFAULT_QUIZ_TITLE = 'Imported Quiz';

/** Statuses during which importing cannot corrupt a running game. */
const IMPORTABLE_STATUSES = ['lobby', 'ended'];

export class ImportBlockedError extends Error {
  constructor(public readonly preview: ImportPreview) {
    super(
      `The sheet has ${preview.issues.length} validation issue(s) — fix them and re-upload`,
    );
    this.name = 'ImportBlockedError';
  }
}

export class ImportLockedError extends Error {
  constructor(status: string) {
    super(
      `Importing is only allowed in the lobby or after the quiz has ended (current status: "${status}")`,
    );
    this.name = 'ImportLockedError';
  }
}

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(Quiz) private readonly quizzes: QuizRepository,
    @InjectRepository(Round) private readonly rounds: RoundRepository,
    @InjectRepository(Question)
    private readonly questions: QuestionRepository,
    private readonly gameState: GameStateService,
  ) {}

  /** Validates the uploaded CSV into a preview. Never writes, never throws. */
  preview(csvText: string, quizTitle?: string): ImportPreview {
    const title = quizTitle?.trim() || DEFAULT_QUIZ_TITLE;
    try {
      return assembleImportPreview(title, parseSheetCsv(csvText));
    } catch (error) {
      const message =
        error instanceof SheetFormatError
          ? error.message
          : 'Could not read the CSV file';
      return createImportPreview(
        title,
        [],
        [{ rowNumber: 1, field: 'file', message }],
      );
    }
  }

  /**
   * Re-validates and saves the quiz. Idempotent keyed by quiz title: rounds
   * and questions are upserted on their (parent, orderIndex) unique indexes
   * so re-importing an edited sheet updates rows in place, and anything that
   * vanished from the sheet is deleted.
   */
  async confirm(
    csvText: string,
    quizTitle?: string,
  ): Promise<ImportConfirmResult> {
    const status = this.gameState.getSnapshot().progress.status;
    if (!IMPORTABLE_STATUSES.includes(status)) {
      throw new ImportLockedError(status);
    }

    const preview = this.preview(csvText, quizTitle);
    if (!preview.isImportable) {
      throw new ImportBlockedError(preview);
    }

    const quizId = await this.upsertQuiz(preview.quizTitle);
    await this.upsertRounds(quizId, preview.rounds);

    if (quizId === this.gameState.getActiveQuizId()) {
      await this.gameState.reloadActiveQuiz();
    }

    return {
      quizId,
      roundCount: preview.rounds.length,
      questionCount: preview.rounds.reduce(
        (total, round) => total + round.questions.length,
        0,
      ),
    };
  }

  private async upsertQuiz(title: string): Promise<number> {
    const existing = await this.quizzes.findOne({ title }, { fields: ['id'] });
    if (existing) {
      return existing.id;
    }
    const created = this.quizzes.create({ title });
    await this.quizzes.getEntityManager().persistAndFlush(created);
    return created.id;
  }

  private async upsertRounds(
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
        const payload = {
          ...(question.options ? { options: question.options } : {}),
          ...(question.mediaUrl ? { mediaUrl: question.mediaUrl } : {}),
          ...(question.answerMediaUrl
            ? { answerMediaUrl: question.answerMediaUrl }
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
