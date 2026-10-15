import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';

interface SessionPlayerCountRow {
  gameSessionId: number;
  teamId: number;
  playerCount: number;
}

/** How many players each team brought to a session: one number per team per session, last write wins. */
@Injectable()
export class PlayerCountService {
  constructor(
    @InjectRepository(SessionPlayerCount)
    private readonly playerCounts: SessionPlayerCountRepository,
  ) {}

  /** Saves the team's player count, replacing any earlier one. */
  async set(
    gameSessionId: number,
    teamId: number,
    playerCount: number,
  ): Promise<void> {
    // An upsert skips the entity's timestamp hooks, so they are set here.
    const now = new Date();
    await this.playerCounts.upsert(
      {
        gameSession: gameSessionId,
        team: teamId,
        playerCount,
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'team'],
        onConflictMergeFields: ['playerCount', 'updatedAt'],
      },
    );
  }

  /** What the team last reported this session, or null when it reported none. */
  async getForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<number | null> {
    const row = await this.playerCounts.findForTeam(gameSessionId, teamId);
    return row?.playerCount ?? null;
  }

  /**
   * The reported counts of several sessions in one read, by session then team,
   * optionally only for the given teams. Read from the counts table, not the
   * roster, so a kicked or departed team keeps its count. A session with no
   * reported count has no entry.
   */
  async listForSessions(
    gameSessionIds: readonly number[],
    teamIds?: readonly number[],
  ): Promise<Map<number, Map<number, number>>> {
    const result = new Map<number, Map<number, number>>();
    if (gameSessionIds.length === 0) return result;
    let query = this.playerCounts
      .getKnex()('session_player_counts')
      .whereIn('game_session_id', [...gameSessionIds]);
    if (teamIds) query = query.whereIn('team_id', [...teamIds]);
    const rows = (await query.select(
      'game_session_id as gameSessionId',
      'team_id as teamId',
      'player_count as playerCount',
    )) as SessionPlayerCountRow[];
    for (const row of rows) {
      const byTeam = result.get(row.gameSessionId) ?? new Map<number, number>();
      byTeam.set(row.teamId, row.playerCount);
      result.set(row.gameSessionId, byTeam);
    }
    return result;
  }
}
