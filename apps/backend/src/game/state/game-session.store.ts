import type { SessionState } from '@/game/state/session-state';

/**
 * Owns the in-memory session registry keyed by joinCode — the single source
 * of truth GameStateService and its collaborators (GameSessionMutationsService,
 * BlockGradingService) read and write through. Composed inside GameStateService
 * rather than injected via Nest DI, since nothing outside that service needs
 * its own reference to the registry.
 */
export class GameSessionStore {
  private readonly sessions = new Map<string, SessionState>();
  /** Whether onModuleInit has resolved — lets get() distinguish "used too early" from "unknown joinCode". */
  private initialized = false;

  markInitialized(): void {
    this.initialized = true;
  }

  has(joinCode: string): boolean {
    return this.sessions.has(joinCode);
  }

  get(joinCode: string): SessionState {
    // Distinguishing "never initialized" from "unknown joinCode" gives
    // onModuleInit-ordering bugs a clearer error than a generic lookup miss.
    if (!this.initialized) {
      throw new Error(
        'GameStateService used before initialization (onModuleInit has not resolved yet)',
      );
    }
    const session = this.sessions.get(joinCode);
    if (!session) {
      throw new Error(`Unknown game session for join code "${joinCode}"`);
    }
    return session;
  }

  set(joinCode: string, session: SessionState): void {
    this.sessions.set(joinCode, session);
  }

  delete(joinCode: string): void {
    this.sessions.delete(joinCode);
  }

  values(): SessionState[] {
    return Array.from(this.sessions.values());
  }
}
