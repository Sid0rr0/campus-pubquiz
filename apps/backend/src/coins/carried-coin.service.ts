import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { CARRIED_COINS } from '@campus-pubquiz/types';
import { SessionCarriedCoin } from '@/db/entities/session-carried-coin.entity';
import { SessionCarriedCoinRepository } from '@/db/repositories/session-carried-coin.repository';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';

/** The carried coins: `CARRIED_COINS` for a team that rated every round of its last ended session sharing a league with this one. Decided once per team per session and stored. */
@Injectable()
export class CarriedCoinService {
  constructor(
    @InjectRepository(SessionCarriedCoin)
    private readonly carriedCoins: SessionCarriedCoinRepository,
    private readonly endedSessions: EndedSessionsRead,
  ) {}

  /** Decides (once) and returns the carried coin of each team; a team already decided keeps its stored coin. */
  async decide(
    gameSessionId: number,
    teamIds: readonly number[],
  ): Promise<Record<number, number>> {
    const stored = await this.loadAll(gameSessionId);
    for (const teamId of teamIds) {
      if (teamId in stored) continue;
      const coins = (await this.earnedBy(gameSessionId, teamId))
        ? CARRIED_COINS
        : 0;
      // An upsert skips the entity's timestamp hooks, so they are set here.
      const now = new Date();
      await this.carriedCoins.upsert(
        {
          gameSession: gameSessionId,
          team: teamId,
          coins,
          createdAt: now,
          updatedAt: now,
        },
        {
          onConflictFields: ['gameSession', 'team'],
          onConflictAction: 'ignore',
        },
      );
      stored[teamId] = coins;
    }
    return stored;
  }

  /** Every stored carried coin of the session by team id. */
  async loadAll(gameSessionId: number): Promise<Record<number, number>> {
    const rows = (await this.carriedCoins
      .getKnex()('session_carried_coins')
      .where('game_session_id', gameSessionId)
      .select('team_id as teamId', 'coins')) as {
      teamId: number;
      coins: number;
    }[];
    return Object.fromEntries(rows.map((row) => [row.teamId, row.coins]));
  }

  /** Whether the team rated every round of the last ended session it took part in that shares a league with `gameSessionId`. */
  private async earnedBy(
    gameSessionId: number,
    teamId: number,
  ): Promise<boolean> {
    const knex = this.carriedCoins.getKnex();
    const leagueIds = knex('league_sessions')
      .where('game_session_id', gameSessionId)
      .select('league_id');
    const shared = (await knex('league_sessions')
      .whereIn('league_id', leagueIds)
      .distinct('game_session_id')) as { game_session_id: number }[];
    const sharedIds = new Set(shared.map((row) => row.game_session_id));
    // Newest first, so the first one in a shared league is the team's last.
    const last = (await this.endedSessions.participations([teamId])).find(
      (night) =>
        night.gameSessionId !== gameSessionId &&
        sharedIds.has(night.gameSessionId),
    );
    if (!last) return false;

    const roundCount = Number(
      (
        await knex('rounds')
          .where('quiz_id', last.quizId)
          .count({ count: '*' })
          .first()
      )?.count ?? 0,
    );
    const rated = Number(
      (
        await knex('round_ratings')
          .where({ game_session_id: last.gameSessionId, team_id: teamId })
          .countDistinct({ count: 'round_id' })
          .first()
      )?.count ?? 0,
    );
    return roundCount > 0 && rated === roundCount;
  }
}
