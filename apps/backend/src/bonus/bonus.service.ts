import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  type AwardToStore,
  type BonusAwardAdminView,
  type BonusCategory,
  type CoinAwardAdminView,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { CoinAward } from '@/db/entities/coin-award.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import { CoinAwardRepository } from '@/db/repositories/coin-award.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

/** Not thrown by the store: the REST layer maps the change module's invalid-award refusal back to it for a 400. */
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

  /** Whether the stored roster of the session holds the team (the session's cached roster misses teams not rejoined since a restart). */
  async isOnRoster(gameSessionId: number, teamId: number): Promise<boolean> {
    return !!(await this.gameSessionTeams.findOne({
      gameSession: gameSessionId,
      team: teamId,
    }));
  }

  /** Stores what the Bonus award policy allowed (the bonus award, its linked coins and any manual coins) in one flush. Decides nothing. */
  async award(
    gameSessionId: number,
    teamId: number,
    { bonus, linkedCoins, manualCoins, manualCoinsReason }: AwardToStore,
  ): Promise<AwardedBonus> {
    const em = this.bonusAwards.getEntityManager();
    if (bonus) {
      const bonusAward = this.bonusAwards.create({
        gameSession: gameSessionId,
        team: teamId,
        ...bonus,
      });
      em.persist(bonusAward);
      if (linkedCoins !== 0) {
        em.persist(
          this.coinAwards.create({
            gameSession: gameSessionId,
            team: teamId,
            coins: linkedCoins,
            bonusAward,
          }),
        );
      }
    }
    if (manualCoins !== 0) {
      em.persist(
        this.coinAwards.create({
          gameSession: gameSessionId,
          team: teamId,
          coins: manualCoins,
          reason: manualCoinsReason,
        }),
      );
    }
    await em.flush();

    return {
      teamId,
      coinsGiven: (bonus ? linkedCoins : 0) + manualCoins,
      coinTotal: await this.coinAwardTotal(gameSessionId, teamId),
    };
  }

  /** Stores a coin award of `coins` with `reason` and no bonus award (covering coins a deleted award had given and the team already spent). */
  coverSpentCoins(
    gameSessionId: number,
    teamId: number,
    coins: number,
    reason: string,
  ): Promise<AwardedBonus> {
    return this.award(gameSessionId, teamId, {
      linkedCoins: 0,
      manualCoins: coins,
      manualCoinsReason: reason,
    });
  }

  /** How many awards of the category the team has in the session. */
  awardCount(
    gameSessionId: number,
    teamId: number,
    category: BonusCategory,
  ): Promise<number> {
    return this.bonusAwards.countAwards(gameSessionId, teamId, category);
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

  /** Admin view of a team's coin awards, oldest first: what each gave or took and why. */
  async listCoinAwardsForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<CoinAwardAdminView[]> {
    const awards = await this.coinAwards.listForTeam(gameSessionId, teamId);
    return awards.map((award) => ({
      id: award.id,
      coins: award.coins,
      reason: award.reason ?? undefined,
      createdAt: award.createdAt.toISOString(),
    }));
  }

  /** The award with this id in this session; BonusAwardNotFoundError otherwise. */
  async findOwnedAward(
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

  /** Stores an edit's decided points/reason and returns the award's admin view with the id of the team that holds it. Category is not editable — see UpdateBonusAwardRequest. */
  async update(
    gameSessionId: number,
    awardId: number,
    points: number,
    reason: string | undefined,
  ): Promise<{ award: BonusAwardAdminView; teamId: number }> {
    const award = await this.findOwnedAward(gameSessionId, awardId);
    award.points = points;
    award.reason = reason;
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
