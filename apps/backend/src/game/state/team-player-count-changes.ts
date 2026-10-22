import type {
  SessionState,
  SetPlayerCountPayload,
  SetTeamPlayerCountPayload,
} from '@campus-pubquiz/types';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import {
  findTeamIdBySocketId,
  withPlayerCount,
} from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/**
 * The team player count change module: builds the changes for a team
 * reporting how many players it has, and for the quiz master or a moderator
 * setting or correcting a team's count. A team's own report is refused unless
 * the socket belongs to a team; an admin's is refused for a team that was
 * never on this session's roster. Both are checked before anything is stored.
 * Neither changes scores. The team's phones alone are told the new number,
 * and the admin room gets a fresh view of itself (the roster shows the count);
 * the big screen and the players room hear nothing.
 */
export class TeamPlayerCountChanges {
  constructor(
    private readonly playerCountService: PlayerCountService,
    private readonly standingsService: StandingsService,
  ) {}

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
    return await this.store(session, teamId, playerCount);
  }

  async teamPlayerCountSet(
    session: SessionState,
    { teamId, playerCount }: SetTeamPlayerCountPayload,
  ): Promise<SessionChange<SessionOutcome>> {
    if (!(await this.hasBeenOnRoster(session, teamId))) {
      throw new SessionRefusal(`Team ${teamId} is not in this session`);
    }
    return await this.store(session, teamId, playerCount);
  }

  /**
   * On the roster now, or off it by a kick or leave but still on record: a
   * count, graded answers or bonus awards outlive the roster row (the same
   * record the standings use for departed teams).
   */
  private async hasBeenOnRoster(
    session: SessionState,
    teamId: number,
  ): Promise<boolean> {
    if (session.teams.some((team) => team.teamId === teamId)) return true;
    const { gameSessionId } = session.seededGame;
    const stored = await this.playerCountService.getForTeam(
      gameSessionId,
      teamId,
    );
    if (stored !== null) return true;
    return await this.standingsService.hasTakenPart(gameSessionId, teamId);
  }

  private async store(
    session: SessionState,
    teamId: number,
    playerCount: number,
  ): Promise<SessionChange<SessionOutcome>> {
    await this.playerCountService.set(
      session.seededGame.gameSessionId,
      teamId,
      playerCount,
    );
    return {
      session: withPlayerCount(session, teamId, playerCount),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        shouldBroadcastState: false,
        shouldBroadcastAdminState: true,
        playerCountSyncs: connectedTeamSyncs(session, [teamId]).map((sync) => ({
          ...sync,
          playerCount,
        })),
      },
      touchedScores: false,
    };
  }
}
