import type {
  SessionState,
  SetPlayerCountPayload,
} from '@campus-pubquiz/types';
import { PlayerCountService } from '@/player-count/player-count.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import { findTeamIdBySocketId } from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/**
 * The team player count change module: builds the change for a team reporting
 * how many players it has. Refused unless the socket belongs to a team,
 * checked before anything is stored. It changes no scores and broadcasts
 * nothing: the team's phones alone are told the new number.
 */
export class TeamPlayerCountChanges {
  constructor(private readonly playerCountService: PlayerCountService) {}

  async playerCountSet(
    session: SessionState,
    { playerCount }: SetPlayerCountPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = findTeamIdBySocketId(session, socketId);
    if (teamId === null) {
      throw new SessionRefusal(
        'Join a team before reporting your player count',
      );
    }
    await this.playerCountService.set(
      session.seededGame.gameSessionId,
      teamId,
      playerCount,
    );
    return {
      session,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        shouldBroadcastState: false,
        playerCountSyncs: connectedTeamSyncs(session, [teamId]).map((sync) => ({
          ...sync,
          playerCount,
        })),
      },
    };
  }
}
