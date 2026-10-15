import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';

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
}
