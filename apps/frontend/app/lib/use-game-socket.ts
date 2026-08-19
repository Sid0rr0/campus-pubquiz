'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type AdminActionPayload,
  type AnswerReceivedPayload,
  type AnswersUpdatedPayload,
  type AwardBonusPayload,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type BonusCategory,
  type GameAction,
  type GradeAnswerPayload,
  type JoinAcceptedPayload,
  type JoinPlayersPayload,
  type KickTeamPayload,
  type SessionClosedPayload,
  type StateSnapshotPayload,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export type GameSocketRole = 'display' | 'admin' | 'players';

export interface JoinTeamOptions {
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
}

export interface UseGameSocketResult {
  snapshot: StateSnapshotPayload | null;
  connectionError: string | null;
  sendAction: (action: GameAction) => void;
  team: JoinAcceptedPayload | null;
  joinTeam: (teamName: string, options?: JoinTeamOptions) => void;
  submitAnswer: (questionId: number, teamId: number, value: string) => void;
  liveAnswers: AnswersUpdatedPayload | null;
  gradeAnswer: (answerId: number, pointsAwarded: number) => void;
  kickTeam: (teamId: number) => void;
  awardBonus: (
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
  ) => void;
  /** The team's own saved answers by question id (players only). */
  myAnswers: Record<number, string>;
  /**
   * Every question this socket has seen open or revealed so far, keyed by
   * id — accumulated across blocks/rounds, since `snapshot.blockQuestions`/
   * `revealQuestions` only ever cover the *current* block. Lets /play show a
   * running history of the whole quiz rather than just the latest block.
   */
  seenQuestions: Record<number, BlockQuestionView | BlockRevealQuestionView>;
  /**
   * Lets the admin page fold a REST-fetched `AnswersUpdatedPayload` (the
   * initial/on-question-change load, now a GET rather than a round-tripped
   * socket request) into the same state slot that live ANSWERS_UPDATED
   * broadcasts from SUBMIT_ANSWER/GRADE_ANSWER already write to.
   */
  setLiveAnswers: (payload: AnswersUpdatedPayload | null) => void;
  /**
   * Timestamp of the most recent successful (re)connection, including the
   * first one. Transient, request-driven data (e.g. the admin page's
   * REST-fetched `liveAnswers`) isn't part of the `STATE_SYNC` snapshot the
   * server resends automatically on reconnect, so consumers that need to
   * re-fetch it after a dropped connection should add this to their
   * effect's dependency array.
   */
  reconnectedAt: number | null;
  /** The joinCode of this session once its admin closes it, or null otherwise — players-room consumers use this to drop their identity and return to the join screen. */
  sessionClosed: string | null;
}

type SeenQuestions = Record<
  number,
  BlockQuestionView | BlockRevealQuestionView
>;

/** Folds a snapshot's block/reveal questions into the running seen-questions map — later sightings of the same id (e.g. once it's revealed) overwrite earlier ones so the richer view wins. */
function mergeSeenQuestions(
  current: SeenQuestions,
  payload: StateSnapshotPayload,
): SeenQuestions {
  const additions = [
    ...(payload.blockQuestions ?? []),
    ...(payload.revealQuestions ?? []),
  ];
  if (additions.length === 0) {
    return current;
  }
  const next = { ...current };
  for (const question of additions) {
    next[question.id] = question;
  }
  return next;
}

function getExceptionMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

export function useGameSocket(
  role: GameSocketRole,
  enabled = true,
  joinCode?: string,
  // Bumped by callers (e.g. useTeamJoin's joinAttempt) to force a fresh
  // socket even when role/joinCode are unchanged from the last attempt —
  // needed because a server-rejected connection (e.g. unknown session code)
  // disconnects with `skipReconnect` set, so socket.io-client never retries
  // it on its own. Without this, resubmitting the join form with the same
  // code would silently emit JOIN_PLAYERS on that dead socket and do nothing.
  retryKey = 0,
): UseGameSocketResult {
  const [snapshot, setSnapshot] = useState<StateSnapshotPayload | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [team, setTeam] = useState<JoinAcceptedPayload | null>(null);
  const [liveAnswers, setLiveAnswers] = useState<AnswersUpdatedPayload | null>(
    null,
  );
  const [myAnswers, setMyAnswers] = useState<Record<number, string>>({});
  const [seenQuestions, setSeenQuestions] = useState<SeenQuestions>({});
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const [sessionClosed, setSessionClosed] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // A fresh connect (first mount, or `role`/`joinCode`/`retryKey` identity
  // change) starts from a clean slate — otherwise the previous identity's
  // data stays on screen until the new STATE_SYNC arrives. Adjusted during
  // render rather than in the connect Effect below, keyed the same way its
  // dependency array is.
  const identityKey = `${enabled}|${role}|${joinCode ?? ''}|${retryKey}`;
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (enabled) {
      setSnapshot(null);
      setConnectionError(null);
      setTeam(null);
      setLiveAnswers(null);
      setMyAnswers({});
      setSeenQuestions({});
      setSessionClosed(null);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = io(getBackendUrl(), {
      query: joinCode ? { role, code: joinCode } : { role },
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setReconnectedAt(Date.now());
    });

    socket.on(SOCKET_EVENTS.STATE_SYNC, (payload: StateSnapshotPayload) => {
      setSnapshot(payload);
      setSeenQuestions((current) => mergeSeenQuestions(current, payload));
      setConnectionError(null);
    });

    socket.on(SOCKET_EVENTS.STATE_UPDATED, (payload: StateSnapshotPayload) => {
      setSnapshot(payload);
      setSeenQuestions((current) => mergeSeenQuestions(current, payload));
    });

    socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload: JoinAcceptedPayload) => {
      setTeam(payload);
      setMyAnswers(
        Object.fromEntries(
          (payload.answers ?? []).map((answer) => [
            answer.questionId,
            answer.value,
          ]),
        ),
      );
    });

    socket.on(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      (payload: AnswerReceivedPayload) => {
        setMyAnswers((current) => ({
          ...current,
          [payload.questionId]: payload.value,
        }));
      },
    );

    socket.on(
      SOCKET_EVENTS.ANSWERS_UPDATED,
      (payload: AnswersUpdatedPayload) => {
        setLiveAnswers(payload);
      },
    );

    socket.on(SOCKET_EVENTS.SESSION_CLOSED, (payload: SessionClosedPayload) => {
      setSessionClosed(payload.joinCode);
    });

    socket.on('connect_error', (payload: unknown) => {
      setConnectionError(getExceptionMessage(payload));
    });

    socket.on('disconnect', (reason: string) => {
      if (reason !== 'io client disconnect') {
        setConnectionError(
          (currentError) => currentError ?? `Disconnected: ${reason}`,
        );
      }
    });

    socket.on('exception', (payload: unknown) => {
      setConnectionError(getExceptionMessage(payload));
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, role, joinCode, retryKey]);

  const sendAction = useCallback((action: GameAction) => {
    const payload: AdminActionPayload = { action };
    socketRef.current?.emit(SOCKET_EVENTS.ADMIN_ACTION, payload);
  }, []);

  const joinTeam = useCallback(
    (teamName: string, options: JoinTeamOptions = {}) => {
      const payload: JoinPlayersPayload = {
        teamName,
        teamToken: options.teamToken,
        teamCode: options.teamCode,
        joinCode: options.joinCode,
      };
      socketRef.current?.emit(SOCKET_EVENTS.JOIN_PLAYERS, payload);
    },
    [],
  );

  const submitAnswer = useCallback(
    (questionId: number, teamId: number, value: string) => {
      const payload: SubmitAnswerPayload = { questionId, teamId, value };
      socketRef.current?.emit(SOCKET_EVENTS.SUBMIT_ANSWER, payload);
    },
    [],
  );

  const gradeAnswer = useCallback((answerId: number, pointsAwarded: number) => {
    const payload: GradeAnswerPayload = { answerId, pointsAwarded };
    socketRef.current?.emit(SOCKET_EVENTS.GRADE_ANSWER, payload);
  }, []);

  const kickTeam = useCallback((teamId: number) => {
    const payload: KickTeamPayload = { teamId };
    socketRef.current?.emit(SOCKET_EVENTS.KICK_TEAM, payload);
  }, []);

  const awardBonus = useCallback(
    (
      teamId: number,
      category: BonusCategory,
      points: number,
      reason?: string,
    ) => {
      const payload: AwardBonusPayload = { teamId, category, points, reason };
      socketRef.current?.emit(SOCKET_EVENTS.AWARD_BONUS, payload);
    },
    [],
  );

  return {
    snapshot,
    connectionError,
    sendAction,
    team,
    joinTeam,
    submitAnswer,
    liveAnswers,
    gradeAnswer,
    kickTeam,
    awardBonus,
    myAnswers,
    seenQuestions,
    setLiveAnswers,
    reconnectedAt,
    sessionClosed,
  };
}
