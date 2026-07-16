import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { GameProgress, GameStatus } from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

@Injectable()
export class GameProgressRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async save(gameSessionId: string, progress: GameProgress): Promise<void> {
    await this.db
      .update(schema.gameSessions)
      .set({
        status: progress.status,
        currentRoundIndex: progress.roundIndex,
        currentQuestionIndex: progress.questionIndex,
        isLeaderboardVisible: progress.isLeaderboardVisible,
      })
      .where(eq(schema.gameSessions.id, gameSessionId));
  }

  async load(gameSessionId: string): Promise<GameProgress | null> {
    const [session] = await this.db
      .select()
      .from(schema.gameSessions)
      .where(eq(schema.gameSessions.id, gameSessionId));

    if (!session) {
      return null;
    }

    return {
      status: session.status as GameStatus,
      roundIndex: session.currentRoundIndex,
      questionIndex: session.currentQuestionIndex,
      isLeaderboardVisible: session.isLeaderboardVisible,
    };
  }
}
