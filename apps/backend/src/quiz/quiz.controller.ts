import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type QuizDraft,
  type QuizDraftSaveRequest,
  type QuizDraftSaveResult,
  type QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import { GameStateService } from '@/game/state/game-state.service';
import { toQuizHttpError } from '@/quiz/quiz-http-errors';
import { QuizService } from '@/quiz/quiz.service';

@Controller('quizzes')
@UseGuards(SessionGuard, RolesGuard)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly gameState: GameStateService,
    private readonly liveEdit: LiveEditService,
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
    const frontier = this.liveEdit.getFrontier(id);
    return frontier ? { ...draft, liveEdit: frontier } : draft;
  }

  @Post()
  async create(
    @Body() body: QuizDraftSaveRequest,
  ): Promise<QuizDraftSaveResult> {
    try {
      return await this.quizService.create(body.title, body.rounds);
    } catch (error) {
      throw toQuizHttpError(error);
    }
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: QuizDraftSaveRequest,
  ): Promise<QuizDraftSaveResult> {
    try {
      return await this.liveEdit.save(id, body);
    } catch (error) {
      throw toQuizHttpError(error);
    }
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    if (this.liveEdit.hasLiveSession(id)) {
      throw new ConflictException(
        'Cannot delete a quiz with a live session running — close the session first',
      );
    }
    try {
      await this.quizService.remove(id);
    } catch (error) {
      throw toQuizHttpError(error);
    }
  }
}
