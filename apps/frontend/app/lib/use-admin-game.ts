'use client';

import { useCallback, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AckResult,
  type AdminActionPayload,
  type AnswersUpdatedPayload,
  type AwardBonusPayload,
  type BonusCategory,
  type CreateShowdownRoundPayload,
  type GameAction,
  type GradeAnswerPayload,
  type KickTeamPayload,
  type PresenterContextPayload,
  type SetBreakEndTimePayload,
  type SetDisplayTextScalePayload,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import { useGameConnection } from '@/app/lib/use-game-connection';

export interface UseAdminGameResult {
  snapshot: StateViewByRoom['admin'] | null;
  /** Only ever a connection problem (refused, lost, reconnecting) — a rejected action is a toast and the action's own result. */
  connectionError: string | null;
  /** Timestamp of the most recent successful (re)connection; add it to an effect's dependencies to re-fetch REST data after a drop. */
  reconnectedAt: number | null;
  liveAnswers: AnswersUpdatedPayload | null;
  /** Lets the page fold a REST-fetched payload into the same slot live ANSWERS_UPDATED broadcasts write to. */
  setLiveAnswers: (payload: AnswersUpdatedPayload | null) => void;
  /** Tells the hook which question's answers are on screen, so a broadcast for another question doesn't replace them. Null accepts whatever arrives. */
  focusAnswersQuestionId: (questionId: number | null) => void;
  /** Host notes for the open question + a preview of the next — see PresenterContextPayload. */
  presenterContext: PresenterContextPayload | null;
  sendAction: (action: GameAction) => Promise<AckResult>;
  gradeAnswer: (answerId: number, pointsAwarded: number) => Promise<AckResult>;
  kickTeam: (teamId: number) => Promise<AckResult>;
  awardBonus: (
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
  ) => Promise<AckResult>;
  /** Sets/clears the epoch-ms "back at HH:MM" time on the display's break screen — null clears it. */
  setBreakEndTime: (breakEndsAt: number | null) => Promise<AckResult>;
  setDisplayTextScale: (displayTextScale: number) => Promise<AckResult>;
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
  const [liveAnswers, setLiveAnswers] = useState<AnswersUpdatedPayload | null>(
    null,
  );
  const [presenterContext, setPresenterContext] =
    useState<PresenterContextPayload | null>(null);
  // A ref (not state) since it only filters an event handler and must never
  // trigger the connect Effect.
  const focusedAnswersQuestionIdRef = useRef<number | null>(null);

  const bindSocket = useCallback((socket: Socket) => {
    focusedAnswersQuestionIdRef.current = null;
    socket.on(
      SOCKET_EVENTS.ANSWERS_UPDATED,
      (payload: AnswersUpdatedPayload) => {
        const focusedQuestionId = focusedAnswersQuestionIdRef.current;
        // A late broadcast for a question the admin isn't grading would
        // replace the panel's data with the wrong question's.
        if (
          focusedQuestionId !== null &&
          payload.questionId !== focusedQuestionId
        ) {
          return;
        }
        setLiveAnswers(payload);
      },
    );
    socket.on(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      (payload: PresenterContextPayload) => setPresenterContext(payload),
    );
  }, []);

  const { identityKey, emitWithAck, ...connection } = useGameConnection(
    'admin',
    enabled,
    joinCode,
    bindSocket,
  );

  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (enabled) {
      setLiveAnswers(null);
      setPresenterContext(null);
    }
  }

  // Toasts directly (not via state + an effect) so a repeat rejection with
  // the identical message still toasts each time.
  const emitAction = useCallback(
    async (event: string, payload: unknown): Promise<AckResult> => {
      const result = await emitWithAck(event, payload);
      if (!result.success) toast.error(result.error);
      return result;
    },
    [emitWithAck],
  );

  const sendAction = useCallback(
    (action: GameAction) => {
      const payload: AdminActionPayload = { action };
      return emitAction(SOCKET_EVENTS.ADMIN_ACTION, payload);
    },
    [emitAction],
  );

  const gradeAnswer = useCallback(
    (answerId: number, pointsAwarded: number) => {
      const payload: GradeAnswerPayload = { answerId, pointsAwarded };
      return emitAction(SOCKET_EVENTS.GRADE_ANSWER, payload);
    },
    [emitAction],
  );

  const kickTeam = useCallback(
    (teamId: number) => {
      const payload: KickTeamPayload = { teamId };
      return emitAction(SOCKET_EVENTS.KICK_TEAM, payload);
    },
    [emitAction],
  );

  const awardBonus = useCallback(
    (
      teamId: number,
      category: BonusCategory,
      points: number,
      reason?: string,
    ) => {
      const payload: AwardBonusPayload = { teamId, category, points, reason };
      return emitAction(SOCKET_EVENTS.AWARD_BONUS, payload);
    },
    [emitAction],
  );

  const setBreakEndTime = useCallback(
    (breakEndsAt: number | null) => {
      const payload: SetBreakEndTimePayload = { breakEndsAt };
      return emitAction(SOCKET_EVENTS.SET_BREAK_END_TIME, payload);
    },
    [emitAction],
  );

  const setDisplayTextScale = useCallback(
    (displayTextScale: number) => {
      const payload: SetDisplayTextScalePayload = { displayTextScale };
      return emitAction(SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE, payload);
    },
    [emitAction],
  );

  const createShowdownRound = useCallback(
    (question: string, answer: string, points: number) => {
      const payload: CreateShowdownRoundPayload = { question, answer, points };
      return emitAction(SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND, payload);
    },
    [emitAction],
  );

  const focusAnswersQuestionId = useCallback((questionId: number | null) => {
    focusedAnswersQuestionIdRef.current = questionId;
  }, []);

  return {
    ...connection,
    liveAnswers,
    setLiveAnswers,
    focusAnswersQuestionId,
    presenterContext,
    sendAction,
    gradeAnswer,
    kickTeam,
    awardBonus,
    setBreakEndTime,
    setDisplayTextScale,
    createShowdownRound,
  };
}
