import {
  type JoinPlayersPayload,
  type SessionState,
  SOCKET_EVENTS,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { FeedbackService } from '@/feedback/feedback.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import {
  findTeamIdBySocketId,
  withTeamConnected,
  withTeams,
  withoutTeamConnection,
} from '@/game/state/session-updates.util';
import type { SessionChange } from '@/game/state/session-write';
import { TeamService, type TeamIdentity } from '@/team/team.service';

/** What a join's write yields: the resolved team, and the outcome to deliver once the reply is built. */
export interface JoinOutcome {
  team: TeamIdentity;
  joined: SessionOutcome;
}

/**
 * The team roster change module: builds the changes for a team joining or
 * rejoining, a socket dropping, a team leaving and the quiz master kicking a
 * team. Composed inside the game state class, which hands each builder to the
 * Session write module. Follows the pattern set out on
 * SessionSettingsChanges.
 */
export class TeamRosterChanges {
  constructor(
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly bonusService: BonusService,
    private readonly feedbackService: FeedbackService,
  ) {}

  /**
   * A team joins (or rejoins) from `socketId`. The team service resolves the
   * team inside the write, so a leave or kick for the same team lands either
   * wholly before or wholly after this join. Then the seat takeover rule
   * applies: a live socket already holding the seat refuses the join, unless
   * the request names that socket as its previous one — then it is listed to
   * close. A takeover is the same device auto-reconnecting on a fresh socket
   * before the ping timeout noticed its old one died; socket ids are random
   * and never shared, so only that device can name it. Records the connection
   * and the roster together. `isSocketLive` comes from the socket layer.
   */
  async join(
    session: SessionState,
    input: {
      request: JoinPlayersPayload;
      socketId: string;
      isSocketLive: (socketId: string) => boolean;
    },
  ): Promise<SessionChange<JoinOutcome>> {
    const { request, socketId, isSocketLive } = input;
    const { gameSessionId } = session.seededGame;
    const team = await this.teamService.join(gameSessionId, request.teamName, {
      teamToken: request.teamToken,
      teamCode: request.teamCode,
      joinCode: request.joinCode,
    });
    const heldBy = session.connectedTeamSockets[team.id];
    const takenOver =
      heldBy && heldBy !== socketId && isSocketLive(heldBy) ? heldBy : null;
    if (takenOver && request.previousSocketId !== takenOver) {
      throw new SessionRefusal(
        `"${team.name}" is already connected on another device — ask the quiz master to remove it, then try again.`,
      );
    }
    return {
      session: withTeams(
        withTeamConnected(session, team.id, socketId),
        await this.teamService.listForSession(gameSessionId),
      ),
      outcome: {
        team,
        joined: {
          ...BROADCAST_STATE_OUTCOME,
          socketsToClose: takenOver ? [takenOver] : [],
        },
      },
    };
  }

  /** The JOIN_ACCEPTED reply for a joined team: its saved answers, bonus awards, round ratings and feedback. Built after the join's write. */
  async joinReply(
    gameSessionId: number,
    team: TeamIdentity,
  ): Promise<SessionOutcome['replies'][number]> {
    return {
      event: SOCKET_EVENTS.JOIN_ACCEPTED,
      payload: {
        teamId: team.id,
        teamName: team.name,
        teamToken: team.token,
        teamCode: team.code,
        answers: await this.answerService.listForTeam(gameSessionId, team.id),
        bonusAwards: await this.bonusService.listForTeam(
          gameSessionId,
          team.id,
        ),
        roundRatings: await this.feedbackService.listRoundRatingsForTeam(
          gameSessionId,
          team.id,
        ),
        feedback: await this.feedbackService.getFeedbackForTeam(
          gameSessionId,
          team.id,
        ),
      },
    };
  }

  /** A socket dropped: frees its team, if it held one. A socket that held no team yields a null outcome — nothing to push. */
  disconnect(
    session: SessionState,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome | null>> {
    const teamId = findTeamIdBySocketId(session, socketId);
    return Promise.resolve(
      teamId === null
        ? { session, outcome: null }
        : {
            session: withoutTeamConnection(session, teamId),
            outcome: BROADCAST_STATE_OUTCOME,
          },
    );
  }

  /**
   * A team leaves from `socketId`. Refused unless that socket owns the team's
   * seat, checked against the session as the previous write left it, so a
   * leave from a socket that just lost the seat to a rejoin is refused.
   */
  async leave(
    session: SessionState,
    input: { teamId: number; socketId: string },
  ): Promise<SessionChange<SessionOutcome>> {
    if (session.connectedTeamSockets[input.teamId] !== input.socketId) {
      throw new SessionRefusal('Can only leave the session as your own team');
    }
    return await this.teamRemoved(session, input.teamId, 'left');
  }

  /** The quiz master kicks a team, even one with no socket. */
  kick(
    session: SessionState,
    teamId: number,
  ): Promise<SessionChange<SessionOutcome>> {
    return this.teamRemoved(session, teamId, 'kicked');
  }

  /**
   * The change a team's removal makes: removes the team from the roster, then
   * drops its connection and swaps in the roster after its removal, so the
   * next snapshot never has one without the other. A kick also carries
   * TEAM_KICKED for the socket the team held, if any, then closes that socket.
   */
  private async teamRemoved(
    session: SessionState,
    teamId: number,
    reason: 'kicked' | 'left',
  ): Promise<SessionChange<SessionOutcome>> {
    const { gameSessionId } = session.seededGame;
    await this.teamService.removeFromRoster(gameSessionId, teamId);
    const socketId = session.connectedTeamSockets[teamId];
    const notices =
      reason === 'kicked' && socketId
        ? [
            {
              socketId,
              event: SOCKET_EVENTS.TEAM_KICKED,
              payload: undefined,
            },
          ]
        : [];
    return {
      session: withTeams(
        withoutTeamConnection(session, teamId),
        await this.teamService.listForSession(gameSessionId),
      ),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        notices,
        socketsToClose: notices.map((notice) => notice.socketId),
      },
    };
  }
}
