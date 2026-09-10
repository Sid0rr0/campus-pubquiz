import {
  Body,
  ConflictException,
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
  GameStatus,
  QuizDraft,
  QuizDraftSaveRequest,
  QuizDraftSaveResult,
  QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/state/game-state.service';
import {
  findLiveEditViolations,
  QuizLiveEditBlockedError,
} from '@/quiz/live-edit-guard';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  QuizService,
} from '@/quiz/quiz.service';

/** A session in one of these statuses can't be corrupted by an editor save — every other status is "live" for locking purposes. */
const NOT_LIVE_STATUSES: GameStatus[] = ['lobby', 'ended'];

@Controller('quizzes')
@UseGuards(SessionGuard, RolesGuard)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly gameState: GameStateService,
    private readonly gameGateway: GameGateway,
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
    const liveJoinCodes = this.getLiveSessionJoinCodes(id);
    if (liveJoinCodes.length === 0) return draft;
    return {
      ...draft,
      liveEdit: { lockedQuestionIds: this.getLockedQuestionIds(liveJoinCodes) },
    };
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
      const liveJoinCodes = this.getLiveSessionJoinCodes(id);
      if (liveJoinCodes.length > 0) {
        await this.assertNoLiveEditViolations(id, body, liveJoinCodes);
      }

      const result = await this.quizService.update(id, body.title, body.rounds);

      for (const joinCode of liveJoinCodes) {
        await this.gameGateway.notifyQuizEdited(joinCode);
      }

      return result;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async assertNoLiveEditViolations(
    quizId: number,
    body: QuizDraftSaveRequest,
    liveJoinCodes: string[],
  ): Promise<void> {
    const currentDraft = await this.quizService.findDraftById(quizId);
    if (!currentDraft) return; // quizService.update below reports the 404

    const lockedQuestionIds = this.getLockedQuestionIds(liveJoinCodes);
    const issues = findLiveEditViolations(
      currentDraft.rounds,
      body.rounds,
      lockedQuestionIds,
    );
    if (issues.length > 0) {
      throw new QuizLiveEditBlockedError(issues);
    }
  }

  /** Join codes of every currently-running session on `quizId` — lobby/ended sessions can't be broken by an editor save, so they're excluded. */
  private getLiveSessionJoinCodes(quizId: number): string[] {
    return this.gameState
      .listSessions()
      .filter(
        (session) =>
          session.quizId === quizId &&
          !NOT_LIVE_STATUSES.includes(session.status),
      )
      .map((session) => session.joinCode);
  }

  /** Union of already-shown/in-progress question ids across every live session on the quiz — a question locked in any one of them stays locked in the shared draft. */
  private getLockedQuestionIds(liveJoinCodes: string[]): number[] {
    const ids = new Set<number>();
    for (const joinCode of liveJoinCodes) {
      for (const id of this.gameState.getShownOrInProgressQuestionIds(
        joinCode,
      )) {
        ids.add(id);
      }
    }
    return [...ids];
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof QuizDraftInvalidError) {
      return new UnprocessableEntityException({
        message: error.message,
        issues: error.issues,
      });
    }
    if (error instanceof QuizLiveEditBlockedError) {
      return new ConflictException({
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
