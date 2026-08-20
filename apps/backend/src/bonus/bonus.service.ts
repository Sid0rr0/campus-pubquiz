import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { BONUS_CATEGORIES, type BonusCategory } from '@campus-pubquiz/types';
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

export interface AwardedBonus {
  teamId: number;
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
}
