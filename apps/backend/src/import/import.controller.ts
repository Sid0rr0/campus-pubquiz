import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  QUIZ_MODES,
  type ImportFromUrlRequest,
  type ImportPreview,
  type ImportRequest,
  type QuizMode,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { ImportService } from '@/import/import.service';

const modeSchema = z.enum(QUIZ_MODES).default('pub');

function requireMode(mode: unknown): QuizMode {
  const parsed = modeSchema.safeParse(mode);
  if (!parsed.success) {
    throw new BadRequestException(
      `mode must be one of: ${QUIZ_MODES.join(', ')}`,
    );
  }
  return parsed.data;
}

function requireCsvText(body: Partial<ImportRequest>): ImportRequest {
  if (typeof body.csvText !== 'string' || body.csvText.trim() === '') {
    throw new BadRequestException('csvText is required');
  }
  return {
    csvText: body.csvText,
    quizTitle: body.quizTitle,
    mode: requireMode(body.mode),
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
    mode: requireMode(body.mode),
  };
}

@Controller('import')
@UseGuards(SessionGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  preview(@Body() body: Partial<ImportRequest>): ImportPreview {
    const { csvText, quizTitle, mode } = requireCsvText(body);
    return this.importService.preview(csvText, quizTitle, mode);
  }

  @Post('preview-from-url')
  previewFromUrl(
    @Body() body: Partial<ImportFromUrlRequest>,
  ): Promise<ImportPreview> {
    const { sheetUrl, quizTitle, mode } = requireSheetUrl(body);
    return this.importService.previewFromUrl(sheetUrl, quizTitle, mode);
  }
}
