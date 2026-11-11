import type {
  PickSidePayload,
  SessionState,
  SetTeamSidePayload,
} from '@campus-pubquiz/types';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import { requireSeat } from '@/game/state/session-updates.util';
import { TeamService } from '@/team/team.service';

function requireSide(session: SessionState, sideId: string): void {
  const { settings } = session.seededGame;
  if (!settings.versusEnabled) {
    throw new SessionRefusal('This session is not played with Versus');
  }
  if (!settings.versusSides.some((side) => side.id === sideId)) {
    throw new SessionRefusal('That side is not in this session');
  }
}

/**
 * The team side change module: builds the change for a team picking or
 * switching its own side, and for the quiz master moving any roster team
 * (`teamSideSet`, at any status). Allowed in the lobby, and at any status while the
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
    requireSide(session, sideId);
    if (
      session.progress.status !== 'lobby' &&
      session.teamSides[teamId] !== undefined
    ) {
      throw new SessionRefusal(
        'Sides are locked once the quiz has started; ask the quiz master to move you',
      );
    }
    return await this.store(session, teamId, sideId);
  }

  /** The quiz master moves a roster team to a side, at any status. */
  async teamSideSet(
    session: SessionState,
    { teamId, sideId }: SetTeamSidePayload,
  ): Promise<SessionChange<SessionOutcome>> {
    requireSide(session, sideId);
    if (!session.teams.some((team) => team.teamId === teamId)) {
      throw new SessionRefusal(`Team ${teamId} is not in this session`);
    }
    return await this.store(session, teamId, sideId);
  }

  private async store(
    session: SessionState,
    teamId: number,
    sideId: string,
  ): Promise<SessionChange<SessionOutcome>> {
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
