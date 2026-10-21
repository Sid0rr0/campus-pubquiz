import {
  revealOnAir,
  type ActiveShowdownRoundState,
  type SessionState,
  type TeamRosterEntry,
} from '@campus-pubquiz/types';

/**
 * Pure per-field updates over one session record. Internal to the Live
 * session module: GameStateService applies them inside its event operations,
 * so nothing outside the module can change one field without the derived
 * caches that depend on it.
 */

export function withTeams(
  session: SessionState,
  teams: TeamRosterEntry[],
): SessionState {
  return { ...session, teams };
}

/** The session with `teamId`'s player count cached; a null count (none reported) leaves the cache as it was. */
export function withPlayerCount(
  session: SessionState,
  teamId: number,
  playerCount: number | null,
): SessionState {
  return playerCount === null
    ? session
    : {
        ...session,
        playerCounts: { ...session.playerCounts, [teamId]: playerCount },
      };
}

export function withTeamConnected(
  session: SessionState,
  teamId: number,
  socketId: string,
): SessionState {
  return {
    ...session,
    connectedTeamSockets: {
      ...session.connectedTeamSockets,
      [teamId]: socketId,
    },
  };
}

export function withoutTeamConnection(
  session: SessionState,
  teamId: number,
): SessionState {
  return {
    ...session,
    connectedTeamSockets: Object.fromEntries(
      Object.entries(session.connectedTeamSockets).filter(
        ([connectedTeamId]) => connectedTeamId !== String(teamId),
      ),
    ),
  };
}

export function findTeamIdBySocketId(
  session: SessionState,
  socketId: string,
): number | null {
  const entry = Object.entries(session.connectedTeamSockets).find(
    ([, connectedSocketId]) => connectedSocketId === socketId,
  );
  return entry ? Number(entry[0]) : null;
}

export function withAnsweredTeamIds(
  session: SessionState,
  questionId: number,
  teamIds: number[],
): SessionState {
  return {
    ...session,
    answeredTeamIdsByQuestion: {
      ...session.answeredTeamIdsByQuestion,
      [questionId]: teamIds,
    },
  };
}

export function withBreakEndTime(
  session: SessionState,
  breakEndsAt: number | null,
): SessionState {
  return { ...session, breakEndsAt };
}

export function withDisplayTextScale(
  session: SessionState,
  displayTextScale: number,
): SessionState {
  return { ...session, displayTextScale };
}

export function withDisplaySoundMuted(
  session: SessionState,
  isDisplaySoundMuted: boolean,
): SessionState {
  return { ...session, isDisplaySoundMuted };
}

/** Sets/replaces the in-progress showdown round — including sudden death's fresh round. A round that is the reveal on air starts at its first step; one composed while another reveal is on air leaves that reveal's step alone. */
export function withActiveShowdownRound(
  session: SessionState,
  round: ActiveShowdownRoundState,
): SessionState {
  const withRound = { ...session, activeShowdownRound: round };
  return revealOnAir(withRound)?.reveal === 'showdown'
    ? { ...withRound, revealStep: 0 }
    : withRound;
}

/** Overwrite semantics — resubmitting a guess before reveal replaces the previous one. No-op when there's no active round (a stale/racing submit after the round moved on). */
export function withShowdownGuess(
  session: SessionState,
  teamId: number,
  value: string,
): SessionState {
  if (!session.activeShowdownRound) return session;
  return {
    ...session,
    activeShowdownRound: {
      ...session.activeShowdownRound,
      participants: session.activeShowdownRound.participants.map(
        (participant) =>
          participant.teamId === teamId
            ? { ...participant, guess: value }
            : participant,
      ),
    },
  };
}
