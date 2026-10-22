import {
  hasJokersWithoutOverview,
  JOKERS_NEED_OVERVIEW_MESSAGE,
  type SessionSettings,
  type SessionState,
} from '@campus-pubquiz/types';
import { SeedService } from '@/db/seed.service';
import { SessionSettingsInvalidError } from '@/game/state/errors/session-settings-invalid.error';
import { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
import type { SessionChange } from '@/game/state/session-write';
import {
  withBreakEndTime,
  withDisplaySoundMuted,
  withDisplayTextScale,
} from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/**
 * The session settings change module: builds the changes for the quiz
 * master's session-value events (break end time, display text size, lobby
 * settings). Composed inside the game state class, which hands each builder
 * to the Session write module.
 *
 * The pattern every domain change module follows:
 * - a plain class, not a Nest provider, taking only the services its domain uses;
 * - no reference to the Session write module or the game state class, so a
 *   change can't run a write, call another event or store a session;
 * - each builder takes the session as the previous write left it plus the
 *   event's input, and either throws its refusal or returns the new session
 *   with its outcome (a SessionChange).
 */
export class SessionSettingsChanges {
  constructor(private readonly seedService: SeedService) {}

  /** Sets or clears the epoch-ms time the break is expected to end. */
  breakEndTime(
    session: SessionState,
    breakEndsAt: number | null,
  ): Promise<SessionChange<SessionOutcome>> {
    return Promise.resolve({
      session: withBreakEndTime(session, breakEndsAt),
      outcome: BROADCAST_STATE_OUTCOME,
      touchedScores: false,
    });
  }

  /** Sets the text-size multiplier for every /display screen except the header. */
  displayTextScale(
    session: SessionState,
    displayTextScale: number,
  ): Promise<SessionChange<SessionOutcome>> {
    return Promise.resolve({
      session: withDisplayTextScale(session, displayTextScale),
      outcome: BROADCAST_STATE_OUTCOME,
      touchedScores: false,
    });
  }

  /** Mutes or unmutes the big screen's sounds. */
  displaySoundMuted(
    session: SessionState,
    isDisplaySoundMuted: boolean,
  ): Promise<SessionChange<SessionOutcome>> {
    return Promise.resolve({
      session: withDisplaySoundMuted(session, isDisplaySoundMuted),
      outcome: BROADCAST_STATE_OUTCOME,
      touchedScores: false,
    });
  }

  /** Sets or clears (null) the held session's custom name, after the stats page renamed the ended session's row. */
  customName(
    session: SessionState,
    customName: string | null,
  ): Promise<SessionChange<void>> {
    return Promise.resolve({
      session: {
        ...session,
        seededGame: { ...session.seededGame, customName },
      },
      outcome: undefined,
      touchedScores: false,
    });
  }

  /**
   * Merges `partial` over the session's settings and persists them,
   * lobby-only: refused once the quiz has started, so the values in effect
   * stop moving under the game. The lobby check runs before the database write.
   */
  async lobbySettings(
    session: SessionState,
    partial: Partial<SessionSettings>,
  ): Promise<SessionChange<void>> {
    if (session.progress.status !== 'lobby') {
      throw new SessionSettingsUpdateBlockedError(
        session.seededGame.joinCode,
        `already started (status: "${session.progress.status}")`,
      );
    }
    const settings = { ...session.seededGame.settings, ...partial };
    // A patch naming only one of the pair is checked against the other as stored.
    if (hasJokersWithoutOverview(settings)) {
      throw new SessionSettingsInvalidError(JOKERS_NEED_OVERVIEW_MESSAGE);
    }
    await this.seedService.updateSettings(
      session.seededGame.gameSessionId,
      settings,
    );
    return {
      session: { ...session, seededGame: { ...session.seededGame, settings } },
      outcome: undefined,
      touchedScores: false,
    };
  }
}
