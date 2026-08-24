import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { GameSessionStore } from '@/game/state/game-session.store';
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
}
