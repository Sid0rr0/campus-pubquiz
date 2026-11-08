import { Injectable } from '@nestjs/common';
import {
  createImportPreview,
  type ImportPreview,
  type QuizMode,
} from '@campus-pubquiz/types';
import { assembleImportPreview } from '@/import/question-row.schema';
import { parseSheetCsv, SheetFormatError } from '@/import/sheet-csv.parser';
import {
  fetchSheetCsv,
  parseGoogleSheetUrl,
  SheetFetchError,
  type SheetCsvResult,
} from '@/import/sheet-url-fetcher';

const DEFAULT_QUIZ_TITLE = 'Imported Quiz';

@Injectable()
export class ImportService {
  /** Validates the uploaded CSV into a preview. Never writes, never throws. */
  preview(
    csvText: string,
    quizTitle: string | undefined,
    mode: QuizMode,
  ): ImportPreview {
    const title = quizTitle?.trim() || DEFAULT_QUIZ_TITLE;
    try {
      return assembleImportPreview(title, parseSheetCsv(csvText), mode);
    } catch (error) {
      const message =
        error instanceof SheetFormatError
          ? error.message
          : // Stryker disable next-line StringLiteral: unreachable fallback, the CSV parser wraps every failure in a SheetFormatError.
            'Could not read the CSV file';
      return createImportPreview(
        title,
        [],
        [{ rowNumber: 1, field: 'file', message }],
      );
    }
  }

  /**
   * Fetches the CSV export of a pasted Google Sheets URL, then validates it
   * into a preview exactly like `preview()`. Never writes. A fetch failure
   * (unshared sheet, network error, etc.) is reported as an issue rather
   * than thrown, matching `preview()`'s never-throw contract for CSV parse
   * failures.
   */
  async previewFromUrl(
    sheetUrl: string,
    quizTitle: string | undefined,
    mode: QuizMode,
  ): Promise<ImportPreview> {
    const title = quizTitle?.trim() || DEFAULT_QUIZ_TITLE;
    try {
      const { csvText, sheetName } = await this.fetchSheetCsvText(sheetUrl);
      return this.preview(csvText, quizTitle ?? sheetName, mode);
    } catch (error) {
      const message =
        error instanceof SheetFetchError
          ? error.message
          : 'Could not fetch that sheet';
      return createImportPreview(
        title,
        [],
        [{ rowNumber: 1, field: 'sheetUrl', message }],
      );
    }
  }

  private async fetchSheetCsvText(sheetUrl: string): Promise<SheetCsvResult> {
    const { spreadsheetId, gid } = parseGoogleSheetUrl(sheetUrl);
    return fetchSheetCsv(spreadsheetId, gid);
  }
}
