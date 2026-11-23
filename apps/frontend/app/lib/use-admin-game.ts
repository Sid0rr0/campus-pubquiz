'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AckResult,
  type AdminActionPayload,
  type AwardBonusPayload,
  type BonusCategory,
  type ClientToServerAck,
  type ClientToServerEvent,
  type ClientToServerPayload,
  type CreateShowdownRoundPayload,
  type GameAction,
  type GradeAnswerPayload,
  type KickTeamPayload,
  type PresenterContextPayload,
  type SetBreakEndTimePayload,
  type SetDisplaySoundMutedPayload,
  type SetDisplayTextScalePayload,
  type SetTeamJokerPayload,
  type SetTeamPlayerCountPayload,
  type SetTeamSidePayload,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import {
  useGameConnection,
  type ConnectionIssue,
  type RoomSocket,
} from '@/app/lib/use-game-connection';
import { queryKeys } from '@/app/lib/query-keys';

export interface UseAdminGameResult {
  snapshot: StateViewByRoom['admin'] | null;
  /** Only ever a connection problem (refused, lost, reconnecting) — a rejected action is a toast and the action's own result. */
  connectionError: string | null;
  /** Why the socket isn't connected: `reconnecting` while socket.io retries, `refused` when the server turned it away. Null while connected. */
  connectionIssue: ConnectionIssue | null;
  /** Timestamp of the most recent successful (re)connection; add it to an effect's dependencies to re-fetch REST data after a drop. */
  reconnectedAt: number | null;
  /** Host notes for the open question + a preview of the next — see PresenterContextPayload. */
  presenterContext: PresenterContextPayload | null;
  sendAction: (action: GameAction) => Promise<AckResult>;
  gradeAnswer: (answerId: number, pointsAwarded: number) => Promise<AckResult>;
  kickTeam: (teamId: number) => Promise<AckResult>;
  /** Sets or corrects a team's player count; a rejection is a toast and the returned result. */
  setTeamPlayerCount: (
    teamId: number,
    playerCount: number,
  ) => Promise<AckResult>;
  /** Moves a team to a Versus side at any status; a rejection is a toast and the returned result. */
  setTeamSide: (teamId: number, sideId: string) => Promise<AckResult>;
  /** Gives a team a round as its joker, until that round has started; a rejection is a toast and the returned result. */
  setTeamJoker: (teamId: number, roundId: number) => Promise<AckResult>;
  awardBonus: (
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
    /** The total coins the award gives (its own shot/selfie coins included); only in a session with power-ups. */
    coins?: number,
  ) => Promise<AckResult>;
  /** Sets/clears the epoch-ms "back at HH:MM" time on the display's break screen — null clears it. */
  setBreakEndTime: (breakEndsAt: number | null) => Promise<AckResult>;
  setDisplayTextScale: (displayTextScale: number) => Promise<AckResult>;
  /** Mutes or unmutes the big screen's sounds. */
  setDisplaySoundMuted: (isDisplaySoundMuted: boolean) => Promise<AckResult>;
  createShowdownRound: (
    question: string,
    answer: string,
    points: number,
  ) => Promise<AckResult>;
}

/**
 * The /control and /remote view of a live session. Every action returns a
 * promise of the server's acknowledgement and toasts each rejection, so a
 * caller only awaits the result when it has something to do about a failure
 * (e.g. keep a form's values).
 */
export function useAdminGame(
  enabled: boolean,
  joinCode: string | undefined,
): UseAdminGameResult {
  const [presenterContext, setPresenterContext] =
    useState<PresenterContextPayload | null>(null);
  const queryClient = useQueryClient();

  // A range, not next-line: Stryker only honours a comment that leads a node, and nothing leads the `[]` after this callback's closing brace. Equivalent — `queryClient` and the state setters never change, so a padded list never changes how it behaves.
  // Stryker disable ArrayDeclaration: see above
  const bindSocket = useCallback(
    (socket: RoomSocket<'admin'>) => {
      socket.on(SOCKET_EVENTS.ANSWERS_UPDATED, (payload) => {
        queryClient.setQueryData(
          queryKeys.answers.forQuestion(joinCode ?? '', payload.questionId),
          payload,
        );
      });
      socket.on(SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED, (payload) =>
        setPresenterContext(payload),
      );
    },
    [queryClient, joinCode],
  );
  // Stryker restore ArrayDeclaration

  const {
    identityKey,
    emitWithAck,
    snapshot,
    connectionError,
    connectionIssue,
    reconnectedAt,
  } = useGameConnection('admin', enabled, joinCode, bindSocket);

  useEffect(() => {
    // The answers aren't part of the STATE_SYNC the server resends on
    // reconnect, so re-read whichever Answer lists are on screen.
    if (reconnectedAt === null) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.answers.all });
  }, [reconnectedAt, queryClient]);

  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (enabled) {
      setPresenterContext(null);
    }
  }

  // Toasts directly (not via state + an effect) so a repeat rejection with
  // the identical message still toasts each time.
  const emitAction = useCallback(
    async <E extends ClientToServerEvent>(
      event: E,
      payload: ClientToServerPayload<E>,
    ): Promise<AckResult<ClientToServerAck<E>>> => {
      const result = await emitWithAck(event, payload);
      if (!result.success) toast.error(result.error);
      return result;
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` never changes (`useCallback(…, [])` in useGameConnection), so `emitAction` is the same function either way
    [emitWithAck],
  );

  const sendAction = useCallback(
    (action: GameAction) => {
      const payload: AdminActionPayload = { action };
      return emitAction(SOCKET_EVENTS.ADMIN_ACTION, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `sendAction` is the same function either way
    [emitAction],
  );

  const gradeAnswer = useCallback(
    (answerId: number, pointsAwarded: number) => {
      const payload: GradeAnswerPayload = { answerId, pointsAwarded };
      return emitAction(SOCKET_EVENTS.GRADE_ANSWER, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `gradeAnswer` is the same function either way
    [emitAction],
  );

  const kickTeam = useCallback(
    (teamId: number) => {
      const payload: KickTeamPayload = { teamId };
      return emitAction(SOCKET_EVENTS.KICK_TEAM, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `kickTeam` is the same function either way
    [emitAction],
  );

  const setTeamPlayerCount = useCallback(
    (teamId: number, playerCount: number) => {
      const payload: SetTeamPlayerCountPayload = { teamId, playerCount };
      return emitAction(SOCKET_EVENTS.SET_TEAM_PLAYER_COUNT, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `setTeamPlayerCount` is the same function either way
    [emitAction],
  );

  const setTeamSide = useCallback(
    (teamId: number, sideId: string) => {
      const payload: SetTeamSidePayload = { teamId, sideId };
      return emitAction(SOCKET_EVENTS.SET_TEAM_SIDE, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `setTeamSide` is the same function either way
    [emitAction],
  );

  const setTeamJoker = useCallback(
    (teamId: number, roundId: number) => {
      const payload: SetTeamJokerPayload = { teamId, roundId };
      return emitAction(SOCKET_EVENTS.SET_TEAM_JOKER, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `setTeamJoker` is the same function either way
    [emitAction],
  );

  const awardBonus = useCallback(
    (
      teamId: number,
      category: BonusCategory,
      points: number,
      reason?: string,
      coins?: number,
    ) => {
      const payload: AwardBonusPayload = {
        teamId,
        category,
        points,
        reason,
        ...(coins === undefined ? {} : { coins }),
      };
      return emitAction(SOCKET_EVENTS.AWARD_BONUS, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `awardBonus` is the same function either way
    [emitAction],
  );

  const setBreakEndTime = useCallback(
    (breakEndsAt: number | null) => {
      const payload: SetBreakEndTimePayload = { breakEndsAt };
      return emitAction(SOCKET_EVENTS.SET_BREAK_END_TIME, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `setBreakEndTime` is the same function either way
    [emitAction],
  );

  const setDisplayTextScale = useCallback(
    (displayTextScale: number) => {
      const payload: SetDisplayTextScalePayload = { displayTextScale };
      return emitAction(SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `setDisplayTextScale` is the same function either way
    [emitAction],
  );

  const setDisplaySoundMuted = useCallback(
    (isDisplaySoundMuted: boolean) => {
      const payload: SetDisplaySoundMutedPayload = { isDisplaySoundMuted };
      return emitAction(SOCKET_EVENTS.SET_DISPLAY_SOUND_MUTED, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `setDisplaySoundMuted` is the same function either way
    [emitAction],
  );

  const createShowdownRound = useCallback(
    (question: string, answer: string, points: number) => {
      const payload: CreateShowdownRoundPayload = { question, answer, points };
      return emitAction(SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND, payload);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitAction` never changes, so `createShowdownRound` is the same function either way
    [emitAction],
  );

  return {
    snapshot,
    connectionError,
    connectionIssue,
    reconnectedAt,
    presenterContext,
    sendAction,
    gradeAnswer,
    kickTeam,
    setTeamPlayerCount,
    setTeamSide,
    setTeamJoker,
    awardBonus,
    setBreakEndTime,
    setDisplayTextScale,
    setDisplaySoundMuted,
    createShowdownRound,
  };
}
