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
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import { mapUnknownLiveSession } from '@/league/league-http';

/**
 * Nested under teams/:teamId (rather than living on BonusAwardMutationsController
 * below) because listing is naturally scoped to one team, while the mutation
 * routes address an award directly by id — keeping them apart avoids an
 * ambiguous "is this param a teamId or an awardId" route shape.
 */
@Controller('sessions/:joinCode/teams/:teamId/bonus-awards')
@UseGuards(SessionGuard, RolesGuard)
export class BonusAwardsController {
  constructor(private readonly liveSession: LiveSessionRest) {}

  @Get()
  async list(
    @Param('joinCode') joinCode: string,
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<BonusAwardsListedPayload> {
    return mapUnknownLiveSession(() =>
      this.liveSession.listBonusAwards(joinCode, teamId),
    );
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
  constructor(private readonly liveSession: LiveSessionRest) {}

  @Patch(':awardId')
  async update(
    @Param('joinCode') joinCode: string,
    @Param('awardId', ParseIntPipe) awardId: number,
    @Body() body: UpdateBonusAwardRequest,
  ): Promise<BonusAwardAdminView> {
    return mapBonusErrors(() =>
      this.liveSession.editBonus(joinCode, awardId, body.points, body.reason),
    );
  }

  @Delete(':awardId')
  @HttpCode(204)
  async remove(
    @Param('joinCode') joinCode: string,
    @Param('awardId', ParseIntPipe) awardId: number,
  ): Promise<void> {
    await mapBonusErrors(() => this.liveSession.removeBonus(joinCode, awardId));
  }
}

/** Maps the bonus service's refusals, and an unknown join code, to HTTP. */
function mapBonusErrors<T>(run: () => Promise<T>): Promise<T> {
  return mapUnknownLiveSession(async () => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BonusAwardNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidBonusAwardError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  });
}
