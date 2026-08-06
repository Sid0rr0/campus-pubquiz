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

function requireJoinCode(body: Partial<ImportRequest>): string {
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
      if (error instanceof ImportBlockedError) {
        throw new UnprocessableEntityException({
          message: error.message,
          issues: error.preview.issues,
        });
      }
      if (error instanceof ImportLockedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
