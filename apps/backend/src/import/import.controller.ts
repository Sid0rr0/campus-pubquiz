import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type {
  ImportConfirmResult,
  ImportFromUrlRequest,
  ImportPreview,
  ImportRequest,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import {
  ImportBlockedError,
  ImportLockedError,
  ImportService,
} from '@/import/import.service';
import { SheetFetchError } from '@/import/sheet-url-fetcher';

function requireCsvText(body: Partial<ImportRequest>): ImportRequest {
  if (typeof body.csvText !== 'string' || body.csvText.trim() === '') {
    throw new BadRequestException('csvText is required');
  }
  return {
    csvText: body.csvText,
    quizTitle: body.quizTitle,
    joinCode: body.joinCode,
  };
}

function requireSheetUrl(
  body: Partial<ImportFromUrlRequest>,
): ImportFromUrlRequest {
  if (typeof body.sheetUrl !== 'string' || body.sheetUrl.trim() === '') {
    throw new BadRequestException('sheetUrl is required');
  }
  return {
    sheetUrl: body.sheetUrl,
    quizTitle: body.quizTitle,
    joinCode: body.joinCode,
  };
}

function requireJoinCode(body: { joinCode?: string }): string {
  if (typeof body.joinCode !== 'string' || body.joinCode.trim() === '') {
    throw new BadRequestException('joinCode is required');
  }
  return body.joinCode;
}

@Controller('import')
@UseGuards(SessionGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  preview(@Body() body: Partial<ImportRequest>): ImportPreview {
    const { csvText, quizTitle } = requireCsvText(body);
    return this.importService.preview(csvText, quizTitle);
  }

  @Post('confirm')
  async confirm(
    @Body() body: Partial<ImportRequest>,
  ): Promise<ImportConfirmResult> {
    const { csvText, quizTitle } = requireCsvText(body);
    const joinCode = requireJoinCode(body);
    try {
      return await this.importService.confirm(csvText, joinCode, quizTitle);
    } catch (error) {
      throw mapConfirmError(error);
    }
  }

  @Post('preview-from-url')
  previewFromUrl(
    @Body() body: Partial<ImportFromUrlRequest>,
  ): Promise<ImportPreview> {
    const { sheetUrl, quizTitle } = requireSheetUrl(body);
    return this.importService.previewFromUrl(sheetUrl, quizTitle);
  }

  @Post('confirm-from-url')
  async confirmFromUrl(
    @Body() body: Partial<ImportFromUrlRequest>,
  ): Promise<ImportConfirmResult> {
    const { sheetUrl, quizTitle } = requireSheetUrl(body);
    const joinCode = requireJoinCode(body);
    try {
      return await this.importService.confirmFromUrl(
        sheetUrl,
        joinCode,
        quizTitle,
      );
    } catch (error) {
      if (error instanceof SheetFetchError) {
        throw new UnprocessableEntityException({ message: error.message });
      }
      throw mapConfirmError(error);
    }
  }
}

function mapConfirmError(error: unknown): unknown {
  if (error instanceof ImportBlockedError) {
    return new UnprocessableEntityException({
      message: error.message,
      issues: error.preview.issues,
    });
  }
  if (error instanceof ImportLockedError) {
    return new ConflictException(error.message);
  }
  return error;
}
