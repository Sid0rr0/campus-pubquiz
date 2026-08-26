import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BONUS_CATEGORIES,
  type BonusAwardAdminView,
  type BonusCategory,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

export class InvalidBonusAwardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBonusAwardError';
  }
}

/** Thrown by update()/remove() when the awardId doesn't exist, or exists under a different session — the session id is the security boundary, so the two cases are deliberately indistinguishable to the caller. */
export class BonusAwardNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BonusAwardNotFoundError';
  }
}

export interface AwardedBonus {
  teamId: number;
}

function toAdminView(award: BonusAward): BonusAwardAdminView {
  return {
    id: award.id,
    category: award.category,
    points: award.points,
    reason: award.reason,
    createdAt: award.createdAt.toISOString(),
  };
}

@Injectable()
export class BonusService {
  constructor(
    @InjectRepository(BonusAward)
    private readonly bonusAwards: BonusAwardRepository,
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
  ) {}

  async award(
    gameSessionId: number,
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
    enabledCategories: readonly BonusCategory[] = BONUS_CATEGORIES,
    maxAwardsPerCategory: Partial<Record<BonusCategory, number>> = {},
  ): Promise<AwardedBonus> {
    if (!Number.isFinite(points) || points === 0) {
      throw new InvalidBonusAwardError(
        'Bonus points must be a non-zero number',
      );
    }

    if (!enabledCategories.includes(category)) {
      throw new InvalidBonusAwardError(
        `"${category}" is not enabled for this session`,
      );
    }

    const trimmedReason = reason?.trim();
    if (category === 'custom' && !trimmedReason) {
      throw new InvalidBonusAwardError('A custom bonus needs a reason');
    }

    const isOnRoster = await this.gameSessionTeams.findOne({
      gameSession: gameSessionId,
      team: teamId,
    });
    if (!isOnRoster) {
      throw new InvalidBonusAwardError('Team is not part of this game session');
    }

    const cap = maxAwardsPerCategory[category];
    if (cap !== undefined) {
      const awardedCount = await this.bonusAwards.countAwards(
        gameSessionId,
        teamId,
        category,
      );
      if (awardedCount >= cap) {
        throw new InvalidBonusAwardError(
          `This team has already been awarded the "${category}" bonus the maximum ${cap} time(s)`,
        );
      }
    }

    const bonusAward = this.bonusAwards.create({
      gameSession: gameSessionId,
      team: teamId,
      category,
      reason: category === 'custom' ? trimmedReason : undefined,
      points,
    });
    await this.bonusAwards.getEntityManager().persistAndFlush(bonusAward);

    return { teamId };
  }

  async listForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamBonusAwardView[]> {
    const awards = await this.bonusAwards.listForTeam(gameSessionId, teamId);
    return awards.map((award) => ({
      category: award.category,
      points: award.points,
      reason: award.reason,
    }));
  }

  /** Admin view of a team's awards — includes the id/timestamp listForTeam's team-facing view omits, needed to edit/delete a specific award. */
  async listForTeamAdmin(
    gameSessionId: number,
    teamId: number,
  ): Promise<BonusAwardAdminView[]> {
    const awards = await this.bonusAwards.listForTeam(gameSessionId, teamId);
    return awards.map(toAdminView);
  }

  private async findOwnedAward(
    gameSessionId: number,
    awardId: number,
  ): Promise<BonusAward> {
    const award = await this.bonusAwards.findOne({
      id: awardId,
      gameSession: gameSessionId,
    });
    if (!award) {
      throw new BonusAwardNotFoundError(
        `Bonus award ${awardId} not found in this session`,
      );
    }
    return award;
  }

  /** Edits an existing award's points/reason. Category is not editable — see UpdateBonusAwardRequest. */
  async update(
    gameSessionId: number,
    awardId: number,
    points: number,
    reason?: string,
  ): Promise<BonusAwardAdminView> {
    const award = await this.findOwnedAward(gameSessionId, awardId);

    if (!Number.isFinite(points) || points === 0) {
      throw new InvalidBonusAwardError(
        'Bonus points must be a non-zero number',
      );
    }
    const trimmedReason = reason?.trim();
    if (award.category === 'custom' && !trimmedReason) {
      throw new InvalidBonusAwardError('A custom bonus needs a reason');
    }

    award.points = points;
    award.reason = award.category === 'custom' ? trimmedReason : undefined;
    await this.bonusAwards.getEntityManager().flush();

    return toAdminView(award);
  }

  async remove(gameSessionId: number, awardId: number): Promise<void> {
    const award = await this.findOwnedAward(gameSessionId, awardId);
    await this.bonusAwards.getEntityManager().removeAndFlush(award);
  }
}
