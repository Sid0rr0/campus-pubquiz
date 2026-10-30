import { EntityRepository } from '@mikro-orm/postgresql';
import type { CoinAward } from '@/db/entities/coin-award.entity';

interface SumRow {
  team_id: number;
  total: string | number;
}

export class CoinAwardRepository extends EntityRepository<CoinAward> {
  /** The sum of each team's coin awards in the session, by team id (teams with none are absent). */
  async totalsForSession(
    gameSessionId: number,
  ): Promise<Record<number, number>> {
    const rows = (await this.getKnex()('coin_awards')
      .where({ game_session_id: gameSessionId })
      .groupBy('team_id')
      .select('team_id')
      .sum({ total: 'coins' })) as SumRow[];
    return Object.fromEntries(
      rows.map((row) => [row.team_id, Number(row.total)]),
    );
  }
}
