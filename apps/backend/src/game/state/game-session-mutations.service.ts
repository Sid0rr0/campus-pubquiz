import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { GameSessionStore } from '@/game/state/game-session.store';
import type { ActiveShowdownRoundState } from '@/game/state/session-state';
import type { TeamRosterEntry } from '@/team/team.service';

/**
 * Read-modify-write setters over one session's connection/roster/answer
 * bookkeeping — split out of GameStateService since none of these
 * participate in the state-machine transition applyAction drives.
 */
export class GameSessionMutationsService {
  constructor(private readonly store: GameSessionStore) {}

  setLeaderboard(joinCode: string, leaderboard: LeaderboardEntry[]): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, { ...session, leaderboard });
  }

  setTeams(joinCode: string, teams: TeamRosterEntry[]): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, { ...session, teams });
  }

  getConnectedSocketId(joinCode: string, teamId: number): string | undefined {
    return this.store.get(joinCode).connectedTeamSockets[teamId];
  }

  setTeamConnected(joinCode: string, teamId: number, socketId: string): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, {
      ...session,
      connectedTeamSockets: {
        ...session.connectedTeamSockets,
        [teamId]: socketId,
      },
    });
  }

  /** Called on socket disconnect; returns the teamId that was cleared, if any. */
  clearTeamConnectionBySocketId(
    joinCode: string,
    socketId: string,
  ): number | null {
    const session = this.store.get(joinCode);
    const entry = Object.entries(session.connectedTeamSockets).find(
      ([, sid]) => sid === socketId,
    );
    if (!entry) return null;
    const [clearedTeamId] = entry;
    this.store.set(joinCode, {
      ...session,
      connectedTeamSockets: Object.fromEntries(
        Object.entries(session.connectedTeamSockets).filter(
          ([teamId]) => teamId !== clearedTeamId,
        ),
      ),
    });
    return Number(clearedTeamId);
  }

  setAnsweredTeamIds(
    joinCode: string,
    questionId: number,
    teamIds: number[],
  ): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, {
      ...session,
      answeredTeamIdsByQuestion: {
        ...session.answeredTeamIdsByQuestion,
        [questionId]: teamIds,
      },
    });
  }

  /** Admin-set/clear the epoch-ms time the break is expected to end — see StateSnapshotPayload.breakEndsAt. */
  setBreakEndTime(joinCode: string, breakEndsAt: number | null): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, { ...session, breakEndsAt });
  }

  /** Incrementally patches the ungraded-question cache for one questionId — called by the gateway right after SUBMIT_ANSWER/GRADE_ANSWER, which grade individual answers without going through applyAction's bulk refresh. */
  setQuestionGradedStatus(
    joinCode: string,
    questionId: number,
    hasUngradedAnswers: boolean,
  ): void {
    const session = this.store.get(joinCode);
    const withoutQuestion = session.ungradedQuestionIds.filter(
      (id) => id !== questionId,
    );
    this.store.set(joinCode, {
      ...session,
      ungradedQuestionIds: hasUngradedAnswers
        ? [...withoutQuestion, questionId]
        : withoutQuestion,
    });
  }

  /** Sets/replaces the in-progress showdown round cache and resets the reveal step to 0 — called on CREATE_SHOWDOWN_ROUND, including sudden death's fresh round. */
  setActiveShowdownRound(
    joinCode: string,
    round: ActiveShowdownRoundState,
  ): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, {
      ...session,
      activeShowdownRound: round,
      showdownRevealStep: 0,
    });
  }

  /** Overwrite semantics, same as setAnsweredTeamIds/setBreakEndTime — resubmitting a guess before reveal replaces the previous one. No-op if there's no active round (a stale/racing submit after the round already moved on). */
  setShowdownGuess(joinCode: string, teamId: number, value: string): void {
    const session = this.store.get(joinCode);
    if (!session.activeShowdownRound) return;
    this.store.set(joinCode, {
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
    });
  }

  /**
   * In-memory-only override of progress.isLeaderboardVisible, deliberately
   * not persisted to GameProgress (same ephemeral shape as setBreakEndTime)
   * — used to hide the leaderboard overlay behind the showdown screen
   * without teaching the state machine a new transition out of 'ended'.
   */
  setLeaderboardVisible(joinCode: string, isVisible: boolean): void {
    const session = this.store.get(joinCode);
    this.store.set(joinCode, {
      ...session,
      progress: { ...session.progress, isLeaderboardVisible: isVisible },
    });
  }
}
