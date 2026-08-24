import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  createImportPreview,
  type ImportConfirmResult,
  type ImportPreview,
} from '@campus-pubquiz/types';
import { Quiz } from '@/db/entities/quiz.entity';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { assembleImportPreview } from '@/import/question-row.schema';
import { parseSheetCsv, SheetFormatError } from '@/import/sheet-csv.parser';
import { QuizService } from '@/quiz/quiz.service';

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
    private readonly gameState: GameStateService,
    private readonly quizService: QuizService,
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
    joinCode: string,
    quizTitle?: string,
  ): Promise<ImportConfirmResult> {
    const status = this.gameState.getSnapshot(joinCode).progress.status;
    if (!IMPORTABLE_STATUSES.includes(status)) {
      throw new ImportLockedError(status);
    }

    const preview = this.preview(csvText, quizTitle);
    if (!preview.isImportable) {
      throw new ImportBlockedError(preview);
    }

    const quizId = await this.upsertQuiz(preview.quizTitle);
    await this.quizService.syncRoundsAndQuestions(quizId, preview.rounds);

    if (quizId === this.gameState.getActiveQuizId(joinCode)) {
      await this.gameState.reloadActiveQuiz(joinCode);
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
}
