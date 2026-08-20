import { EntityRepository } from '@mikro-orm/postgresql';
import type { BonusCategory } from '@campus-pubquiz/types';
import type { BonusAward } from '@/db/entities/bonus-award.entity';

interface CountRow {
  total: string | number | null;
}

export class BonusAwardRepository extends EntityRepository<BonusAward> {
  /** How many times this team has already been awarded this category this session — used to enforce SessionSettings.maxBonusAwardsPerCategory. */
  async countAwards(
    gameSessionId: number,
    teamId: number,
    category: BonusCategory,
  ): Promise<number> {
    const knex = this.getKnex();
    const row = (await knex('bonus_awards')
      .where({
        game_session_id: gameSessionId,
        team_id: teamId,
        category,
      })
      .count({ total: '*' })
      .first()) as CountRow | undefined;
    return Number(row?.total ?? 0);
  }
}
