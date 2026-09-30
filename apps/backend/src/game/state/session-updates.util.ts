import type { LeaderboardEntry } from '@campus-pubquiz/types';
import type {
  ActiveShowdownRoundState,
  SessionState,
} from '@/game/state/session-state';
import type { TeamRosterEntry } from '@/team/team.service';

/**
 * Pure per-field updates over one session record. Internal to the Live
 * session module: GameStateService applies them inside its event operations,
 * so nothing outside the module can change one field without the derived
 * caches that depend on it.
 */

export function withLeaderboard(
  session: SessionState,
  leaderboard: LeaderboardEntry[],
): SessionState {
  return { ...session, leaderboard };
}

export function withTeams(
  session: SessionState,
  teams: TeamRosterEntry[],
): SessionState {
  return { ...session, teams };
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

/** Patches the ungraded-question cache for one questionId. */
export function withQuestionGradedStatus(
  session: SessionState,
  questionId: number,
  hasUngradedAnswers: boolean,
): SessionState {
  const withoutQuestion = session.ungradedQuestionIds.filter(
    (id) => id !== questionId,
  );
  return {
    ...session,
    ungradedQuestionIds: hasUngradedAnswers
      ? [...withoutQuestion, questionId]
      : withoutQuestion,
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

/** Sets/replaces the in-progress showdown round and resets the reveal step to 0 — including sudden death's fresh round. */
export function withActiveShowdownRound(
  session: SessionState,
  round: ActiveShowdownRoundState,
): SessionState {
  return { ...session, activeShowdownRound: round, showdownRevealStep: 0 };
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
