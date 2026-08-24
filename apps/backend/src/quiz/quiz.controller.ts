import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type {
  QuizDraft,
  QuizDraftSaveRequest,
  QuizDraftSaveResult,
  QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { GameStateService } from '@/game/state/game-state.service';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  QuizService,
} from '@/quiz/quiz.service';

@Controller('quizzes')
@UseGuards(SessionGuard, RolesGuard)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly gameState: GameStateService,
  ) {}

  @Get()
  async list(
    @Query('joinCode') joinCode?: string,
  ): Promise<QuizzesListedPayload> {
    const quizzes = await this.quizService.list();
    return {
      activeQuizId: joinCode ? this.gameState.getActiveQuizId(joinCode) : null,
      quizzes,
    };
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<QuizDraft> {
    const draft = await this.quizService.findDraftById(id);
    if (!draft) {
      throw new NotFoundException(`Quiz ${id} does not exist`);
    }
    return draft;
  }

  @Post()
  async create(
    @Body() body: QuizDraftSaveRequest,
  ): Promise<QuizDraftSaveResult> {
    try {
      return await this.quizService.create(body.title, body.rounds);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: QuizDraftSaveRequest,
  ): Promise<QuizDraftSaveResult> {
    try {
      return await this.quizService.update(id, body.title, body.rounds);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof QuizDraftInvalidError) {
      return new UnprocessableEntityException({
        message: error.message,
        issues: error.issues,
      });
    }
    if (error instanceof QuizNotFoundError) {
      return new NotFoundException(error.message);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
