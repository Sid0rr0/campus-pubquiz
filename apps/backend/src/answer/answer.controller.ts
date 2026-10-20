import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import { mapUnknownLiveSession } from '@/league/league-http';

@Controller('sessions/:joinCode/answers')
@UseGuards(SessionGuard, RolesGuard)
export class AnswerController {
  constructor(private readonly liveSession: LiveSessionRest) {}

  @Get(':questionId')
  async list(
    @Param('joinCode') joinCode: string,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<AnswersUpdatedPayload> {
    const listed = await mapUnknownLiveSession(() =>
      this.liveSession.listAnswers(joinCode, questionId),
    );
    if (!listed) {
      throw new NotFoundException(`Unknown question ${questionId}`);
    }
    return listed;
  }
}
