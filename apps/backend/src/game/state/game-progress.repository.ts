import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { GameProgress } from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';

/** Everything needed to resume a session exactly where it left off — GameProgress plus the phase timer's live frontier. See SessionState. */
export interface PersistedGameProgress {
  progress: GameProgress;
  livePhaseKey: string | null;
  phaseStartedAt: number | null;
  phaseElapsedByKey: Record<string, number>;
}

@Injectable()
export class GameProgressRepository {
  constructor(
    @InjectRepository(GameSession)
    private readonly gameSessions: GameSessionRepository,
  ) {}

  async save(gameSessionId: number, data: PersistedGameProgress): Promise<void> {
    const session = await this.gameSessions.findOneOrFail(gameSessionId);
    session.status = data.progress.status;
    session.currentRoundIndex = data.progress.roundIndex;
    session.currentQuestionIndex = data.progress.questionIndex;
    session.revealIndex = data.progress.revealIndex;
    session.furthestOpenIndex = data.progress.furthestOpenIndex;
    session.isLeaderboardVisible = data.progress.isLeaderboardVisible;
    session.previousStatus = data.progress.previousStatus ?? null;
    session.livePhaseKey = data.livePhaseKey;
    session.phaseStartedAt =
      data.phaseStartedAt !== null ? new Date(data.phaseStartedAt) : null;
    session.phaseElapsedByKey = data.phaseElapsedByKey;
    await this.gameSessions.getEntityManager().flush();
  }

  async load(gameSessionId: number): Promise<PersistedGameProgress | null> {
    const session = await this.gameSessions.findOne(gameSessionId);

    if (!session) {
      return null;
    }

    return {
      progress: {
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
      },
      livePhaseKey: session.livePhaseKey,
      phaseStartedAt:
        session.phaseStartedAt !== null ? session.phaseStartedAt.getTime() : null,
      phaseElapsedByKey: session.phaseElapsedByKey,
    };
  }
}
