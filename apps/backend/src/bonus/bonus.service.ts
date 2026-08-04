import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { BonusCategory } from '@campus-pubquiz/types';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';

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
  ) {}

  async award(
    gameSessionId: number,
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
  ): Promise<AwardedBonus> {
    if (!Number.isFinite(points) || points === 0) {
      throw new InvalidBonusAwardError(
        'Bonus points must be a non-zero number',
      );
    }

    const trimmedReason = reason?.trim();
    if (category === 'custom' && !trimmedReason) {
      throw new InvalidBonusAwardError('A custom bonus needs a reason');
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
