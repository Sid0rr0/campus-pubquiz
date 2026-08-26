import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type {
  BonusAwardAdminView,
  BonusAwardsListedPayload,
  UpdateBonusAwardRequest,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import {
  BonusAwardNotFoundError,
  BonusService,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/state/game-state.service';

/**
 * Nested under teams/:teamId (rather than living on BonusAwardMutationsController
 * below) because listing is naturally scoped to one team, while the mutation
 * routes address an award directly by id — keeping them apart avoids an
 * ambiguous "is this param a teamId or an awardId" route shape.
 */
@Controller('sessions/:joinCode/teams/:teamId/bonus-awards')
@UseGuards(SessionGuard, RolesGuard)
export class BonusAwardsController {
  constructor(
    private readonly bonusService: BonusService,
    private readonly gameState: GameStateService,
  ) {}

  @Get()
  async list(
    @Param('joinCode') joinCode: string,
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<BonusAwardsListedPayload> {
    if (!this.gameState.hasSession(joinCode)) {
      throw new NotFoundException(`Unknown session "${joinCode}"`);
    }
    const awards = await this.bonusService.listForTeamAdmin(
      this.gameState.getGameSessionId(joinCode),
      teamId,
    );
    return { teamId, awards };
  }
}

/**
 * No @Roles(...) on either controller here — this keeps admin+moderator
 * parity with the existing live AWARD_BONUS socket event, which moderators
 * can already use.
 */
@Controller('sessions/:joinCode/bonus-awards')
@UseGuards(SessionGuard, RolesGuard)
export class BonusAwardMutationsController {
  constructor(
    private readonly bonusService: BonusService,
    private readonly gameState: GameStateService,
    private readonly gameGateway: GameGateway,
  ) {}

  @Patch(':awardId')
  async update(
    @Param('joinCode') joinCode: string,
    @Param('awardId', ParseIntPipe) awardId: number,
    @Body() body: UpdateBonusAwardRequest,
  ): Promise<BonusAwardAdminView> {
    if (!this.gameState.hasSession(joinCode)) {
      throw new NotFoundException(`Unknown session "${joinCode}"`);
    }

    let updated: BonusAwardAdminView;
    try {
      updated = await this.bonusService.update(
        this.gameState.getGameSessionId(joinCode),
        awardId,
        body.points,
        body.reason,
      );
    } catch (error) {
      if (error instanceof BonusAwardNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidBonusAwardError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    await this.gameGateway.notifyBonusAwardsChanged(joinCode);
    return updated;
  }

  @Delete(':awardId')
  @HttpCode(204)
  async remove(
    @Param('joinCode') joinCode: string,
    @Param('awardId', ParseIntPipe) awardId: number,
  ): Promise<void> {
    if (!this.gameState.hasSession(joinCode)) {
      throw new NotFoundException(`Unknown session "${joinCode}"`);
    }

    try {
      await this.bonusService.remove(
        this.gameState.getGameSessionId(joinCode),
        awardId,
      );
    } catch (error) {
      if (error instanceof BonusAwardNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }

    await this.gameGateway.notifyBonusAwardsChanged(joinCode);
  }
}
