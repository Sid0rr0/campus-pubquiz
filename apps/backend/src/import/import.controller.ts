import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ImportFromUrlRequest,
  ImportPreview,
  ImportRequest,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { ImportService } from '@/import/import.service';

function requireCsvText(body: Partial<ImportRequest>): ImportRequest {
  if (typeof body.csvText !== 'string' || body.csvText.trim() === '') {
    throw new BadRequestException('csvText is required');
  }
  return { csvText: body.csvText, quizTitle: body.quizTitle };
}

function requireSheetUrl(
  body: Partial<ImportFromUrlRequest>,
): ImportFromUrlRequest {
  if (typeof body.sheetUrl !== 'string' || body.sheetUrl.trim() === '') {
    throw new BadRequestException('sheetUrl is required');
  }
  return { sheetUrl: body.sheetUrl, quizTitle: body.quizTitle };
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

  @Post('preview-from-url')
  previewFromUrl(
    @Body() body: Partial<ImportFromUrlRequest>,
  ): Promise<ImportPreview> {
    const { sheetUrl, quizTitle } = requireSheetUrl(body);
    return this.importService.previewFromUrl(sheetUrl, quizTitle);
  }
}
