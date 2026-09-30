'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AdminActionPayload,
  type AnswerReceivedPayload,
  type AnswersUpdatedPayload,
  type AwardBonusPayload,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type BonusAwardedPayload,
  type BonusCategory,
  type CreateShowdownRoundPayload,
  type GameAction,
  type GradeAnswerPayload,
  type JoinAcceptedPayload,
  type JoinPlayersPayload,
  type KickTeamPayload,
  type LeaveSessionPayload,
  type PresenterContextPayload,
  type SessionClosedPayload,
  type SetBreakEndTimePayload,
  type SetDisplayTextScalePayload,
  type StateSnapshotPayload,
  type StateViewByRoom,
  type SubmitAnswerPayload,
  type SubmitShowdownGuessPayload,
  type TeamAnswersSyncedPayload,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import {
  buildMyAnswerGrades,
  buildMyAnswers,
  mergeSeenQuestions,
  type JoinTeamOptions,
  type MyAnswerGrade,
  type SeenQuestions,
} from '@/app/lib/use-player-game';

type GameSocketRole = 'display' | 'admin' | 'players';

/** How long a submitted answer may go unconfirmed (no ANSWER_RECEIVED or 'exception') before the socket is treated as silently dead — e.g. a network switch or a phone waking from sleep, where socket.io can still believe it's connected until its ~45s ping timeout. */
export const SUBMIT_CONFIRM_TIMEOUT_MS = 5000;
const RECONNECTING_MESSAGE = 'Connection lost — reconnecting…';
const NOT_CONNECTED_MESSAGE =
  "You're not connected right now — hang on while we reconnect, then try again.";

export interface UseGameSocketResult<
  View extends StateSnapshotPayload = StateSnapshotPayload,
> {
  /** The state view the server sends this hook's role — see StateViewByRoom. */
  snapshot: View | null;
  connectionError: string | null;
  sendAction: (action: GameAction) => void;
  team: JoinAcceptedPayload | null;
  joinTeam: (teamName: string, options?: JoinTeamOptions) => void;
  submitAnswer: (questionId: number, teamId: number, value: string) => void;
  liveAnswers: AnswersUpdatedPayload | null;
  /** Admin-only: host notes for the currently open question + a preview of the next question — see PresenterContextPayload. Never sent to /display or /play. */
  presenterContext: PresenterContextPayload | null;
  gradeAnswer: (answerId: number, pointsAwarded: number) => void;
  kickTeam: (teamId: number) => void;
  /** Players-only: tells the server this team is intentionally leaving (log out) — removes its roster row so it doesn't linger in /control until an admin kicks it by hand. */
  leaveSession: (teamId: number) => void;
  awardBonus: (
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
  ) => void;
  /** Admin-only: sets/clears the epoch-ms time shown as "back at HH:MM" on the display's break screen — null clears it. */
  setBreakEndTime: (breakEndsAt: number | null) => void;
  /** Admin-only: sets the text-size multiplier for every /display screen except the header — see DISPLAY_TEXT_SCALE_STEPS. */
  setDisplayTextScale: (displayTextScale: number) => void;
  /** Admin-only: starts a showdown tiebreaker round for the teams currently tied for 1st. */
  createShowdownRound: (
    question: string,
    answer: string,
    points: number,
  ) => void;
  /** Players-only: submits this team's numeric guess for the active showdown round. */
  submitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => void;
  /** The team's own saved answers by question id (players only). */
  myAnswers: Record<number, string>;
  /** The team's own points awarded by question id, present only once that question's answer is graded (players only). */
  myAnswerGrades: Record<number, MyAnswerGrade>;
  /** Every bonus award this team has received so far this session, in award order (players only). */
  myBonusAwards: TeamBonusAwardView[];
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
   * Admin-only: tells the hook which question's answers the caller is
   * currently displaying, so a live ANSWERS_UPDATED broadcast for some
   * *other* question (e.g. a team's answer to the still-open current
   * question arriving while the admin is browsing an earlier, already-locked
   * question to grade it) doesn't clobber `liveAnswers` out from under the
   * one on screen. Pass null to accept whatever arrives (e.g. before a
   * question is selected).
   */
  focusAnswersQuestionId: (questionId: number | null) => void;
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
  /** Players-only: true while the server has this socket registered as the team's (JOIN_ACCEPTED on the current connection) — false while disconnected or mid-rejoin, when answers can't be accepted. */
  isTeamLinked: boolean;
  /** True once this team's own socket has been kicked by the admin — players-room consumers use this to drop their identity and return to the join screen with a notice. */
  kicked: boolean;
  /** The message from the most recent rejected awardBonus call (admin-only) — surfaced separately from connectionError so callers can show it as a toast next to the award form instead of the persistent connection banner. */
  bonusAwardError: string | null;
}

/** Only a *different* earlier socket is worth naming — a rejoin on the same socket needs no handover. */
function getPreviousSocketId(
  linkedSocketId: string | null,
  currentSocketId: string | undefined,
): string | undefined {
  if (!linkedSocketId || linkedSocketId === currentSocketId) return undefined;
  return linkedSocketId;
}

function getExceptionMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

export function useGameSocket<Role extends GameSocketRole>(
  role: Role,
  enabled = true,
  joinCode?: string,
  // Bumped by callers (e.g. useTeamJoin's joinAttempt) to force a fresh
  // socket even when role/joinCode are unchanged from the last attempt —
  // needed because a server-rejected connection (e.g. unknown session code)
  // disconnects with `skipReconnect` set, so socket.io-client never retries
  // it on its own. Without this, resubmitting the join form with the same
  // code would silently emit JOIN_PLAYERS on that dead socket and do nothing.
  retryKey = 0,
): UseGameSocketResult<StateViewByRoom[Role]> {
  const [snapshot, setSnapshot] = useState<StateViewByRoom[Role] | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [team, setTeam] = useState<JoinAcceptedPayload | null>(null);
  const [liveAnswers, setLiveAnswers] = useState<AnswersUpdatedPayload | null>(
    null,
  );
  const [presenterContext, setPresenterContext] =
    useState<PresenterContextPayload | null>(null);
  const [myAnswers, setMyAnswers] = useState<Record<number, string>>({});
  const [myAnswerGrades, setMyAnswerGrades] = useState<
    Record<number, MyAnswerGrade>
  >({});
  const [myBonusAwards, setMyBonusAwards] = useState<TeamBonusAwardView[]>([]);
  const [seenQuestions, setSeenQuestions] = useState<SeenQuestions>({});
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const [sessionClosed, setSessionClosed] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [bonusAwardError, setBonusAwardError] = useState<string | null>(null);
  const [isTeamLinked, setIsTeamLinked] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  // Mirrors isTeamLinked for submitAnswer, which must check it synchronously.
  const isTeamLinkedRef = useRef(false);
  // The socket id the server last registered this team on — sent back as
  // `previousSocketId` on a rejoin so the server can hand the team over from
  // that stale socket instead of rejecting this device as a second one.
  const linkedSocketIdRef = useRef<string | null>(null);
  // The most recent answer not yet confirmed by ANSWER_RECEIVED/'exception' —
  // resent once the team is linked again after a forced reconnect.
  const pendingSubmitRef = useRef<SubmitAnswerPayload | null>(null);
  const submitConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // See `focusAnswersQuestionId` below — a ref (not state) since it only
  // filters an event handler and must never trigger the connect Effect.
  const focusedAnswersQuestionIdRef = useRef<number | null>(null);
  // Set right before an AWARD_BONUS emit, cleared on the next STATE_UPDATED
  // (success) or 'exception' (failure) — lets the generic exception handler
  // below tell a bonus-award rejection apart from any other action-level
  // WsException without the backend needing to tag which action failed.
  const pendingBonusAwardRef = useRef(false);
  // Same pattern for ADVANCE — e.g. rejected with UngradedAnswersError when
  // the admin tries to leave a break screen with ungraded answers still
  // outstanding. Surfaced as a toast (like bonusAwardError) rather than the
  // persistent connectionError banner, since it's a transient, actionable
  // rejection the admin/presenter can retry after grading, not a dropped
  // connection.
  const pendingAdvanceRef = useRef(false);

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
      setPresenterContext(null);
      setMyAnswers({});
      setMyAnswerGrades({});
      setMyBonusAwards([]);
      setSeenQuestions({});
      setSessionClosed(null);
      setKicked(false);
      setBonusAwardError(null);
      setIsTeamLinked(false);
    }
  }

  const clearSubmitConfirmTimer = useCallback(() => {
    if (submitConfirmTimerRef.current !== null) {
      clearTimeout(submitConfirmTimerRef.current);
      submitConfirmTimerRef.current = null;
    }
  }, []);

  const setTeamLinked = useCallback((value: boolean) => {
    isTeamLinkedRef.current = value;
    setIsTeamLinked(value);
  }, []);

  // Emits the answer and arms a confirmation timer: if the server never
  // replies, the socket is dead without knowing it, so force a fresh
  // connection — the rejoin that follows resends this answer.
  const sendAnswer = useCallback(
    (payload: SubmitAnswerPayload) => {
      const socket = socketRef.current;
      if (!socket) return;
      pendingSubmitRef.current = payload;
      clearSubmitConfirmTimer();
      submitConfirmTimerRef.current = setTimeout(() => {
        submitConfirmTimerRef.current = null;
        setTeamLinked(false);
        setConnectionError(RECONNECTING_MESSAGE);
        socket.disconnect();
        socket.connect();
      }, SUBMIT_CONFIRM_TIMEOUT_MS);
      socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, payload);
    },
    [clearSubmitConfirmTimer, setTeamLinked],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = io(getBackendUrl(), {
      query: joinCode ? { role, code: joinCode } : { role },
      withCredentials: true,
    });
    socketRef.current = socket;
    pendingBonusAwardRef.current = false;
    pendingAdvanceRef.current = false;
    focusedAnswersQuestionIdRef.current = null;
    isTeamLinkedRef.current = false;
    linkedSocketIdRef.current = null;
    pendingSubmitRef.current = null;

    socket.on('connect', () => {
      setReconnectedAt(Date.now());
    });

    socket.on(SOCKET_EVENTS.STATE_SYNC, (payload: StateViewByRoom[Role]) => {
      setSnapshot(payload);
      setSeenQuestions((current) => mergeSeenQuestions(current, payload));
      setConnectionError(null);
    });

    socket.on(SOCKET_EVENTS.STATE_UPDATED, (payload: StateViewByRoom[Role]) => {
      setSnapshot(payload);
      setSeenQuestions((current) => mergeSeenQuestions(current, payload));
      pendingBonusAwardRef.current = false;
      pendingAdvanceRef.current = false;
    });

    socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload: JoinAcceptedPayload) => {
      setTeam(payload);
      setMyAnswers(buildMyAnswers(payload.answers ?? []));
      setMyAnswerGrades(buildMyAnswerGrades(payload.answers ?? []));
      setMyBonusAwards(payload.bonusAwards ?? []);
      linkedSocketIdRef.current = socket.id ?? null;
      setTeamLinked(true);
      if (pendingSubmitRef.current) {
        sendAnswer(pendingSubmitRef.current);
      }
      // A confirmed join supersedes any earlier join-related error (e.g. a
      // losing duplicate request's "already registered") — without this the
      // stale banner stays up over an otherwise-successfully-connected game.
      setConnectionError(null);
    });

    socket.on(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      (payload: AnswerReceivedPayload) => {
        pendingSubmitRef.current = null;
        clearSubmitConfirmTimer();
        setMyAnswers((current) => ({
          ...current,
          [payload.questionId]: payload.value,
        }));
        if (payload.gradedAt !== null) {
          setMyAnswerGrades((current) => ({
            ...current,
            [payload.questionId]: {
              pointsAwarded: payload.pointsAwarded,
              gradedAt: payload.gradedAt as string,
              verdict: payload.verdict,
            },
          }));
        }
      },
    );

    // Pushed once the block a team answered reaches reveal_intro — carries
    // that team's complete, freshly-graded answer set (same shape as
    // JOIN_ACCEPTED.answers), so both maps are replaced wholesale rather
    // than merged, same as a reconnect would produce.
    socket.on(
      SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      (payload: TeamAnswersSyncedPayload) => {
        setMyAnswers(buildMyAnswers(payload.answers));
        setMyAnswerGrades(buildMyAnswerGrades(payload.answers));
      },
    );

    socket.on(
      SOCKET_EVENTS.ANSWERS_UPDATED,
      (payload: AnswersUpdatedPayload) => {
        const focusedQuestionId = focusedAnswersQuestionIdRef.current;
        if (
          focusedQuestionId !== null &&
          payload.questionId !== focusedQuestionId
        ) {
          // A late/out-of-order broadcast for a question the admin isn't
          // currently grading (e.g. a team answering the still-open current
          // question while an earlier locked one is on screen) — dropping it
          // keeps the panel on screen showing what it already was, instead
          // of a mismatch hiding it entirely.
          return;
        }
        setLiveAnswers(payload);
      },
    );

    socket.on(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      (payload: PresenterContextPayload) => {
        setPresenterContext(payload);
      },
    );

    socket.on(SOCKET_EVENTS.BONUS_AWARDED, (payload: BonusAwardedPayload) => {
      setMyBonusAwards((current) => [...current, payload]);
    });

    socket.on(SOCKET_EVENTS.SESSION_CLOSED, (payload: SessionClosedPayload) => {
      setSessionClosed(payload.joinCode);
    });

    socket.on(SOCKET_EVENTS.TEAM_KICKED, () => {
      setKicked(true);
      setConnectionError('You were removed from this team by the quiz master');
    });

    socket.on('connect_error', (payload: unknown) => {
      setConnectionError(getExceptionMessage(payload));
    });

    socket.on('disconnect', (reason: string) => {
      setTeamLinked(false);
      // Any unconfirmed answer stays pending and is resent after the rejoin.
      clearSubmitConfirmTimer();
      if (reason === 'io client disconnect') return;
      if (reason === 'io server disconnect') {
        // The server refused this socket — socket.io won't retry on its own.
        setConnectionError(
          (currentError) => currentError ?? `Disconnected: ${reason}`,
        );
        return;
      }
      setConnectionError(RECONNECTING_MESSAGE);
    });

    socket.on('exception', (payload: unknown) => {
      // A rejected submit (e.g. answers locked) still proves the connection
      // is alive — nothing to reconnect or resend.
      pendingSubmitRef.current = null;
      clearSubmitConfirmTimer();
      if (pendingBonusAwardRef.current) {
        pendingBonusAwardRef.current = false;
        // Called directly (not via state + useToastOnError) so repeat
        // rejections with the identical message — e.g. hitting the same
        // per-category cap twice in a row — still toast each time. Routing
        // this through state would have React bail on the no-op update
        // (Object.is sees the same string) and skip the second toast.
        const message = getExceptionMessage(payload);
        setBonusAwardError(message);
        toast.error(message);
        return;
      }
      if (pendingAdvanceRef.current) {
        pendingAdvanceRef.current = false;
        toast.error(getExceptionMessage(payload));
        return;
      }
      setConnectionError(getExceptionMessage(payload));
    });

    return () => {
      clearSubmitConfirmTimer();
      socket.disconnect();
    };
  }, [
    enabled,
    role,
    joinCode,
    retryKey,
    clearSubmitConfirmTimer,
    sendAnswer,
    setTeamLinked,
  ]);

  const sendAction = useCallback((action: GameAction) => {
    pendingAdvanceRef.current = action === 'ADVANCE';
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
        previousSocketId: getPreviousSocketId(
          linkedSocketIdRef.current,
          socketRef.current?.id,
        ),
      };
      socketRef.current?.emit(SOCKET_EVENTS.JOIN_PLAYERS, payload);
    },
    [],
  );

  const submitAnswer = useCallback(
    (questionId: number, teamId: number, value: string) => {
      if (!isTeamLinkedRef.current) {
        toast.error(NOT_CONNECTED_MESSAGE);
        return;
      }
      sendAnswer({ questionId, teamId, value });
    },
    [sendAnswer],
  );

  const gradeAnswer = useCallback((answerId: number, pointsAwarded: number) => {
    const payload: GradeAnswerPayload = { answerId, pointsAwarded };
    socketRef.current?.emit(SOCKET_EVENTS.GRADE_ANSWER, payload);
  }, []);

  const kickTeam = useCallback((teamId: number) => {
    const payload: KickTeamPayload = { teamId };
    socketRef.current?.emit(SOCKET_EVENTS.KICK_TEAM, payload);
  }, []);

  const leaveSession = useCallback((teamId: number) => {
    const payload: LeaveSessionPayload = { teamId };
    socketRef.current?.emit(SOCKET_EVENTS.LEAVE_SESSION, payload);
  }, []);

  const awardBonus = useCallback(
    (
      teamId: number,
      category: BonusCategory,
      points: number,
      reason?: string,
    ) => {
      const payload: AwardBonusPayload = { teamId, category, points, reason };
      pendingBonusAwardRef.current = true;
      socketRef.current?.emit(SOCKET_EVENTS.AWARD_BONUS, payload);
    },
    [],
  );

  const setBreakEndTime = useCallback((breakEndsAt: number | null) => {
    const payload: SetBreakEndTimePayload = { breakEndsAt };
    socketRef.current?.emit(SOCKET_EVENTS.SET_BREAK_END_TIME, payload);
  }, []);

  const setDisplayTextScale = useCallback((displayTextScale: number) => {
    const payload: SetDisplayTextScalePayload = { displayTextScale };
    socketRef.current?.emit(SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE, payload);
  }, []);

  const createShowdownRound = useCallback(
    (question: string, answer: string, points: number) => {
      const payload: CreateShowdownRoundPayload = { question, answer, points };
      socketRef.current?.emit(SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND, payload);
    },
    [],
  );

  const submitShowdownGuess = useCallback(
    (showdownRoundId: number, teamId: number, value: string) => {
      const payload: SubmitShowdownGuessPayload = {
        showdownRoundId,
        teamId,
        value,
      };
      socketRef.current?.emit(SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS, payload);
    },
    [],
  );

  const focusAnswersQuestionId = useCallback((questionId: number | null) => {
    focusedAnswersQuestionIdRef.current = questionId;
  }, []);

  return {
    snapshot,
    connectionError,
    sendAction,
    team,
    joinTeam,
    submitAnswer,
    liveAnswers,
    presenterContext,
    gradeAnswer,
    kickTeam,
    leaveSession,
    awardBonus,
    setBreakEndTime,
    setDisplayTextScale,
    createShowdownRound,
    submitShowdownGuess,
    myAnswers,
    myAnswerGrades,
    myBonusAwards,
    seenQuestions,
    setLiveAnswers,
    focusAnswersQuestionId,
    reconnectedAt,
    sessionClosed,
    kicked,
    isTeamLinked,
    bonusAwardError,
  };
}
