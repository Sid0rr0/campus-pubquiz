import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BONUS_CATEGORIES,
  SHOT_SELFIE_COINS,
  type BonusAwardAdminView,
  type BonusCategory,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { CoinAward } from '@/db/entities/coin-award.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import { CoinAwardRepository } from '@/db/repositories/coin-award.repository';
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
  /** The coins this award gave in all (the linked `SHOT_SELFIE_COINS` plus any manual coins); 0 when none. */
  coinsGiven: number;
  /** The sum of the team's coin awards after this award. */
  coinTotal: number;
}

/** What the session's power-ups setting and the form's coins field add to an award. */
export interface AwardCoins {
  powerUpsEnabled: boolean;
  /** The form's manual coins (may be negative, absent or 0 for none). */
  manual?: number;
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
    @InjectRepository(CoinAward)
    private readonly coinAwards: CoinAwardRepository,
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
    coins: AwardCoins = { powerUpsEnabled: false },
  ): Promise<AwardedBonus> {
    const manualCoins = coins.manual ?? 0;
    // Points of 0 give coins alone: no bonus award is stored.
    const givesPoints = points !== 0;
    if (!Number.isFinite(points) || (!givesPoints && manualCoins === 0)) {
      throw new InvalidBonusAwardError(
        'Bonus points must be a non-zero number',
      );
    }
    if (manualCoins !== 0 && !coins.powerUpsEnabled) {
      throw new InvalidBonusAwardError(
        'Coins can only be awarded in a session with power-ups',
      );
    }

    if (givesPoints && !enabledCategories.includes(category)) {
      throw new InvalidBonusAwardError(
        `"${category}" is not enabled for this session`,
      );
    }

    const trimmedReason = reason?.trim();
    if (givesPoints && category === 'custom' && !trimmedReason) {
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
    if (givesPoints && cap !== undefined) {
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

    const em = this.bonusAwards.getEntityManager();
    let coinsGiven = 0;
    if (givesPoints) {
      const bonusAward = this.bonusAwards.create({
        gameSession: gameSessionId,
        team: teamId,
        category,
        reason: category === 'custom' ? trimmedReason : undefined,
        points,
      });
      em.persist(bonusAward);
      // A shot or selfie earns coins of its own, which go with the award; a penalty earns none.
      if (coins.powerUpsEnabled && category !== 'custom' && points > 0) {
        em.persist(
          this.coinAwards.create({
            gameSession: gameSessionId,
            team: teamId,
            coins: SHOT_SELFIE_COINS,
            bonusAward,
          }),
        );
        coinsGiven += SHOT_SELFIE_COINS;
      }
    }
    if (manualCoins !== 0) {
      em.persist(
        this.coinAwards.create({
          gameSession: gameSessionId,
          team: teamId,
          coins: manualCoins,
          reason: trimmedReason || undefined,
        }),
      );
      coinsGiven += manualCoins;
    }
    await em.flush();

    return {
      teamId,
      coinsGiven,
      coinTotal: await this.coinAwardTotal(gameSessionId, teamId),
    };
  }

  /** The sum of each team's coin awards in the session, by team id (teams with none are absent). */
  coinAwardTotals(gameSessionId: number): Promise<Record<number, number>> {
    return this.coinAwards.totalsForSession(gameSessionId);
  }

  /** The sum of one team's coin awards in the session. */
  async coinAwardTotal(gameSessionId: number, teamId: number): Promise<number> {
    return (await this.coinAwardTotals(gameSessionId))[teamId] ?? 0;
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

  /** Edits an existing award's points/reason and returns its admin view with the id of the team that holds it. Category is not editable — see UpdateBonusAwardRequest. */
  async update(
    gameSessionId: number,
    awardId: number,
    points: number,
    reason?: string,
  ): Promise<{ award: BonusAwardAdminView; teamId: number }> {
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

    return { award: toAdminView(award), teamId: award.team.id };
  }

  /** Deletes an award, and with it (in the database) the coin award it created, and returns the id of the team that held it and that team's coin award total afterwards. */
  async remove(
    gameSessionId: number,
    awardId: number,
  ): Promise<{ teamId: number; coinTotal: number }> {
    const award = await this.findOwnedAward(gameSessionId, awardId);
    const teamId = award.team.id;
    await this.bonusAwards.getEntityManager().removeAndFlush(award);
    return {
      teamId,
      coinTotal: await this.coinAwardTotal(gameSessionId, teamId),
    };
  }
}
