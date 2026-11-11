import type { PickSidePayload, SessionState } from '@campus-pubquiz/types';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import { requireSeat } from '@/game/state/session-updates.util';
import { TeamService } from '@/team/team.service';

/**
 * The team side change module: builds the change for a team picking or
 * switching its own side. Allowed in the lobby, and at any status while the
 * team has no side yet (a late join, or Versus just turned on); refused once
 * the quiz has started and the team has one, and for a side the session
 * doesn't have. Changes no scores. The team's phones are told their side, and
 * every room gets a fresh view (the roster shows it).
 */
export class TeamSideChanges {
  constructor(private readonly teamService: TeamService) {}

  async sidePicked(
    session: SessionState,
    { sideId }: PickSidePayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = requireSeat(
      session,
      socketId,
      'Join a team before picking a side',
    );
    const { settings } = session.seededGame;
    if (!settings.versusEnabled) {
      throw new SessionRefusal('This session is not played with Versus');
    }
    if (!settings.versusSides.some((side) => side.id === sideId)) {
      throw new SessionRefusal('That side is not in this session');
    }
    if (
      session.progress.status !== 'lobby' &&
      session.teamSides[teamId] !== undefined
    ) {
      throw new SessionRefusal(
        'Sides are locked once the quiz has started; ask the quiz master to move you',
      );
    }
    await this.teamService.setSide(
      session.seededGame.gameSessionId,
      teamId,
      sideId,
    );
    return {
      session: {
        ...session,
        teamSides: { ...session.teamSides, [teamId]: sideId },
      },
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        sideSyncs: connectedTeamSyncs(session, [teamId]).map((sync) => ({
          ...sync,
          sideId,
        })),
      },
      touchedScores: false,
    };
  }
}
