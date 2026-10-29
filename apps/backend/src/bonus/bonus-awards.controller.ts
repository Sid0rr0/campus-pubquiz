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
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import {
  BonusAwardNotFoundError,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import { awardBonusPayloadSchema } from '@/game/socket/socket-payload.schemas';
import { parseOrThrow } from '@/league/league-http';
import { mapUnknownLiveSession } from '@/game/rest/live-session-http';

/** An award edit's body (`UpdateBonusAwardRequest`): the same points and reason rules as awarding one over the socket. */
const updateBonusAwardSchema = awardBonusPayloadSchema.pick({
  points: true,
  reason: true,
});

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
    @Body() body: unknown,
  ): Promise<BonusAwardAdminView> {
    const { points, reason } = parseOrThrow(
      updateBonusAwardSchema.safeParse(body),
      'Invalid bonus award',
    );
    return mapBonusErrors(() =>
      this.liveSession.editBonus(joinCode, awardId, points, reason),
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
