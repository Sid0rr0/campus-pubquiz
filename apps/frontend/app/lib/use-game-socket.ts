'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type AdminActionPayload,
  type AnswerReceivedPayload,
  type AnswersUpdatedPayload,
  type GameAction,
  type GradeAnswerPayload,
  type JoinAcceptedPayload,
  type JoinPlayersPayload,
  type KickTeamPayload,
  type ListAnswersPayload,
  type QuizzesListedPayload,
  type SelectQuizPayload,
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
  submitAnswer: (questionId: string, teamId: string, value: string) => void;
  liveAnswers: AnswersUpdatedPayload | null;
  gradeAnswer: (answerId: string, pointsAwarded: number) => void;
  kickTeam: (teamId: string) => void;
  quizzes: QuizzesListedPayload | null;
  requestQuizzes: () => void;
  selectQuiz: (quizId: string) => void;
  /** The team's own saved answers by question id (players only). */
  myAnswers: Record<string, string>;
  listAnswers: (questionId: string) => void;
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
  password?: string,
  enabled = true,
): UseGameSocketResult {
  const [snapshot, setSnapshot] = useState<StateSnapshotPayload | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [team, setTeam] = useState<JoinAcceptedPayload | null>(null);
  const [liveAnswers, setLiveAnswers] = useState<AnswersUpdatedPayload | null>(null);
  const [quizzes, setQuizzes] = useState<QuizzesListedPayload | null>(null);
  const [myAnswers, setMyAnswers] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = io(getBackendUrl(), {
      query: { role },
      auth: password ? { password } : undefined,
    });
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.STATE_SYNC, (payload: StateSnapshotPayload) => {
      setSnapshot(payload);
      setConnectionError(null);
    });

    socket.on(SOCKET_EVENTS.STATE_UPDATED, (payload: StateSnapshotPayload) => {
      setSnapshot(payload);
    });

    socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload: JoinAcceptedPayload) => {
      setTeam(payload);
      setMyAnswers(
        Object.fromEntries(
          (payload.answers ?? []).map((answer) => [answer.questionId, answer.value]),
        ),
      );
    });

    socket.on(SOCKET_EVENTS.ANSWER_RECEIVED, (payload: AnswerReceivedPayload) => {
      setMyAnswers((current) => ({ ...current, [payload.questionId]: payload.value }));
    });

    socket.on(SOCKET_EVENTS.ANSWERS_UPDATED, (payload: AnswersUpdatedPayload) => {
      setLiveAnswers(payload);
    });

    socket.on(SOCKET_EVENTS.QUIZZES_LISTED, (payload: QuizzesListedPayload) => {
      setQuizzes(payload);
    });

    socket.on('connect_error', (payload: unknown) => {
      setConnectionError(getExceptionMessage(payload));
    });

    socket.on('disconnect', (reason: string) => {
      if (reason !== 'io client disconnect') {
        setConnectionError((currentError) => currentError ?? `Disconnected: ${reason}`);
      }
    });

    socket.on('exception', (payload: unknown) => {
      setConnectionError(getExceptionMessage(payload));
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, password, role]);

  const sendAction = useCallback((action: GameAction) => {
    const payload: AdminActionPayload = { action };
    socketRef.current?.emit(SOCKET_EVENTS.ADMIN_ACTION, payload);
  }, []);

  const joinTeam = useCallback((teamName: string, options: JoinTeamOptions = {}) => {
    const payload: JoinPlayersPayload = {
      teamName,
      teamToken: options.teamToken,
      teamCode: options.teamCode,
      joinCode: options.joinCode,
    };
    socketRef.current?.emit(SOCKET_EVENTS.JOIN_PLAYERS, payload);
  }, []);

  const submitAnswer = useCallback(
    (questionId: string, teamId: string, value: string) => {
      const payload: SubmitAnswerPayload = { questionId, teamId, value };
      socketRef.current?.emit(SOCKET_EVENTS.SUBMIT_ANSWER, payload);
    },
    [],
  );

  const gradeAnswer = useCallback((answerId: string, pointsAwarded: number) => {
    const payload: GradeAnswerPayload = { answerId, pointsAwarded };
    socketRef.current?.emit(SOCKET_EVENTS.GRADE_ANSWER, payload);
  }, []);

  const kickTeam = useCallback((teamId: string) => {
    const payload: KickTeamPayload = { teamId };
    socketRef.current?.emit(SOCKET_EVENTS.KICK_TEAM, payload);
  }, []);

  const requestQuizzes = useCallback(() => {
    socketRef.current?.emit(SOCKET_EVENTS.LIST_QUIZZES);
  }, []);

  const selectQuiz = useCallback((quizId: string) => {
    const payload: SelectQuizPayload = { quizId };
    socketRef.current?.emit(SOCKET_EVENTS.SELECT_QUIZ, payload);
  }, []);

  const listAnswers = useCallback((questionId: string) => {
    const payload: ListAnswersPayload = { questionId };
    socketRef.current?.emit(SOCKET_EVENTS.LIST_ANSWERS, payload);
  }, []);

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
    quizzes,
    requestQuizzes,
    selectQuiz,
    myAnswers,
    listAnswers,
  };
}
