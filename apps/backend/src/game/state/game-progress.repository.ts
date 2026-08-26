import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { GameProgress } from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';

@Injectable()
export class GameProgressRepository {
  constructor(
    @InjectRepository(GameSession)
    private readonly gameSessions: GameSessionRepository,
  ) {}

  async save(gameSessionId: number, progress: GameProgress): Promise<void> {
    const session = await this.gameSessions.findOneOrFail(gameSessionId);
    session.status = progress.status;
    session.currentRoundIndex = progress.roundIndex;
    session.currentQuestionIndex = progress.questionIndex;
    session.revealIndex = progress.revealIndex;
    session.furthestOpenIndex = progress.furthestOpenIndex;
    session.isLeaderboardVisible = progress.isLeaderboardVisible;
    session.previousStatus = progress.previousStatus ?? null;
    await this.gameSessions.getEntityManager().flush();
  }

  async load(gameSessionId: number): Promise<GameProgress | null> {
    const session = await this.gameSessions.findOne(gameSessionId);

    if (!session) {
      return null;
    }

    return {
      // Sessions persisted before block-based locking may still carry the
      // retired 'locked' status; treat them as an open question.
      status:
        (session.status as string) === 'locked'
          ? 'question_open'
          : session.status,
      roundIndex: session.currentRoundIndex,
      questionIndex: session.currentQuestionIndex,
      revealIndex: session.revealIndex,
      furthestOpenIndex: session.furthestOpenIndex,
      isLeaderboardVisible: session.isLeaderboardVisible,
      previousStatus: session.previousStatus,
    };
  }
}
