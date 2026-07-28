import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createImportPreview,
  type ImportConfirmResult,
  type ImportPreview,
  type ImportRoundPreview,
} from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';
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
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
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

  private async upsertQuiz(title: string): Promise<string> {
    const [existing] = await this.db
      .select({ id: schema.quizzes.id })
      .from(schema.quizzes)
      .where(eq(schema.quizzes.title, title))
      .limit(1);
    if (existing) {
      return existing.id;
    }
    const [created] = await this.db
      .insert(schema.quizzes)
      .values({ title })
      .returning({ id: schema.quizzes.id });
    return created.id;
  }

  private async upsertRounds(
    quizId: string,
    rounds: ImportRoundPreview[],
  ): Promise<void> {
    for (const [roundIndex, round] of rounds.entries()) {
      const [roundRow] = await this.db
        .insert(schema.rounds)
        .values({
          quizId,
          title: round.title,
          orderIndex: roundIndex,
          breakAfter: round.breakAfter,
        })
        .onConflictDoUpdate({
          target: [schema.rounds.quizId, schema.rounds.orderIndex],
          set: { title: round.title, breakAfter: round.breakAfter },
        })
        .returning({ id: schema.rounds.id });

      for (const [questionIndex, question] of round.questions.entries()) {
        const payload = {
          ...(question.options ? { options: question.options } : {}),
          ...(question.mediaUrl ? { mediaUrl: question.mediaUrl } : {}),
        };
        await this.db
          .insert(schema.questions)
          .values({
            roundId: roundRow.id,
            orderIndex: questionIndex,
            type: question.type,
            prompt: question.prompt,
            answer: question.answer,
            notes: question.notes,
            payload,
            points: question.points,
          })
          .onConflictDoUpdate({
            target: [schema.questions.roundId, schema.questions.orderIndex],
            set: {
              type: question.type,
              prompt: question.prompt,
              answer: question.answer,
              notes: question.notes,
              payload,
              points: question.points,
            },
          });
      }

      await this.db
        .delete(schema.questions)
        .where(
          and(
            eq(schema.questions.roundId, roundRow.id),
            gte(schema.questions.orderIndex, round.questions.length),
          ),
        );
    }

    await this.db
      .delete(schema.rounds)
      .where(
        and(
          eq(schema.rounds.quizId, quizId),
          gte(schema.rounds.orderIndex, rounds.length),
        ),
      );
  }
}
