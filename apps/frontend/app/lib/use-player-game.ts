'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AckResult,
  type AnswerReceivedPayload,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type BonusAwardedPayload,
  type JoinAcceptedPayload,
  type JoinPlayersPayload,
  type LeaveSessionPayload,
  type SessionClosedPayload,
  type StateSnapshotPayload,
  type StateViewByRoom,
  type SubmitAnswerPayload,
  type SubmitShowdownGuessPayload,
  type TeamAnswerView,
  type TeamAnswersSyncedPayload,
  type TeamBonusAwardView,
  type Verdict,
} from '@campus-pubquiz/types';
import {
  NOT_CONNECTED_MESSAGE,
  useGameConnection,
} from '@/app/lib/use-game-connection';

/** How long a submitted answer may go unacknowledged before the socket is treated as silently dead — e.g. a network switch or a phone waking from sleep, where socket.io can still believe it's connected until its ~45s ping timeout. */
export const SUBMIT_CONFIRM_TIMEOUT_MS = 5000;

export interface JoinTeamOptions {
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
}

/** A team's own graded answer to one question — absent from the map entirely until grading happens (instantly for auto-graded types, on admin grading for the rest). */
export interface MyAnswerGrade {
  pointsAwarded: number;
  gradedAt: string;
  /** How the answer was judged — the same verdict the quiz master sees. */
  verdict: Verdict | null;
}

export type SeenQuestions = Record<
  number,
  BlockQuestionView | BlockRevealQuestionView
>;

export interface UsePlayerGameResult {
  snapshot: StateViewByRoom['players'] | null;
  /** Only ever a connection problem (refused, lost, reconnecting) — a rejected join, answer or guess is that action's own result. */
  connectionError: string | null;
  /** Timestamp of the most recent successful (re)connection, including the first. */
  reconnectedAt: number | null;
  team: JoinAcceptedPayload | null;
  /** True while the server has this socket registered as the team's (JOIN_ACCEPTED on the current connection) — false while disconnected or mid-rejoin, when answers can't be accepted. */
  isTeamLinked: boolean;
  /** True once this team's own socket has been kicked by the admin — consumers drop their identity and return to the join screen with a notice. */
  kicked: boolean;
  /** The joinCode of this session once its admin closes it, or null otherwise — consumers drop their identity and return to the join screen. */
  sessionClosed: string | null;
  /** The team's own saved answers by question id. */
  myAnswers: Record<number, string>;
  /** The team's own points awarded by question id, present only once that question's answer is graded. */
  myAnswerGrades: Record<number, MyAnswerGrade>;
  /** Every bonus award this team has received so far this session, in award order. */
  myBonusAwards: TeamBonusAwardView[];
  /** Every question this socket has seen open or revealed so far, keyed by id — accumulated across blocks/rounds, since the snapshot only ever covers the current block. */
  seenQuestions: SeenQuestions;
  /** Resolves to the server's verdict on the join; the caller shows a rejection (it is not toasted here). */
  joinTeam: (teamName: string, options?: JoinTeamOptions) => Promise<AckResult>;
  /** Refuses with a "not connected" toast while unlinked; otherwise keeps the answer pending (and resends it after a rejoin) until the server acknowledges it. A rejection is toasted and never treated as a dead connection. */
  submitAnswer: (
    questionId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
  /** Tells the server this team is intentionally leaving (log out) — removes its roster row so it doesn't linger in /control until an admin kicks it by hand. */
  leaveSession: (teamId: number) => Promise<AckResult>;
  submitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
}

/** Folds a view's block/reveal questions into the running seen-questions map — later sightings of the same id (e.g. once it's revealed) overwrite earlier ones so the richer view wins. The players view never carries a question that hasn't been shown yet, so everything in it is taken as it arrives. */
export function mergeSeenQuestions(
  current: SeenQuestions,
  payload: StateSnapshotPayload,
): SeenQuestions {
  const additions = [
    ...(payload.blockQuestions ?? []),
    ...(payload.revealQuestions ?? []),
    ...(payload.pastRevealedQuestions ?? []),
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

export function buildMyAnswers(
  answers: TeamAnswerView[],
): Record<number, string> {
  return Object.fromEntries(
    answers.map((answer) => [answer.questionId, answer.value]),
  );
}

export function buildMyAnswerGrades(
  answers: TeamAnswerView[],
): Record<number, MyAnswerGrade> {
  return Object.fromEntries(
    answers
      .filter((answer) => answer.gradedAt !== null)
      .map((answer) => [
        answer.questionId,
        {
          pointsAwarded: answer.pointsAwarded,
          gradedAt: answer.gradedAt as string,
          verdict: answer.verdict,
        },
      ]),
  );
}

/** Only a *different* earlier socket is worth naming — a rejoin on the same socket needs no handover. */
function getPreviousSocketId(
  linkedSocketId: string | null,
  currentSocketId: string | undefined,
): string | undefined {
  if (!linkedSocketId || linkedSocketId === currentSocketId) return undefined;
  return linkedSocketId;
}

/**
 * A team phone's view of a live session. Every action returns a promise of
 * the server's acknowledgement; answer and showdown-guess rejections are
 * toasted here, while a join rejection is left to the join flow to show.
 */
export function usePlayerGame(
  enabled: boolean,
  joinCode: string | undefined,
  // Bumped by callers (e.g. useTeamJoin's joinAttempt) to force a fresh
  // socket even when the join code is unchanged — a server-rejected
  // connection (e.g. unknown session code) disconnects with `skipReconnect`
  // set, so socket.io-client never retries it on its own.
  retryKey = 0,
): UsePlayerGameResult {
  const [team, setTeam] = useState<JoinAcceptedPayload | null>(null);
  const [myAnswers, setMyAnswers] = useState<Record<number, string>>({});
  const [myAnswerGrades, setMyAnswerGrades] = useState<
    Record<number, MyAnswerGrade>
  >({});
  const [myBonusAwards, setMyBonusAwards] = useState<TeamBonusAwardView[]>([]);
  const [seenQuestions, setSeenQuestions] = useState<SeenQuestions>({});
  const [sessionClosed, setSessionClosed] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [isTeamLinked, setIsTeamLinked] = useState(false);
  // Mirrors isTeamLinked for submitAnswer, which must check it synchronously.
  const isTeamLinkedRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  // The socket id the server last registered this team on — sent back as
  // `previousSocketId` on a rejoin so the server can hand the team over from
  // that stale socket instead of rejecting this device as a second one.
  const linkedSocketIdRef = useRef<string | null>(null);
  // The most recent answer not yet acknowledged — resent once the team is
  // linked again after a forced reconnect.
  const pendingSubmitRef = useRef<SubmitAnswerPayload | null>(null);
  // Identifies the latest send, so an acknowledgement belonging to an
  // earlier, superseded send is ignored.
  const submitAttemptRef = useRef(0);
  const submitConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // The socket bindings need to resend the pending answer, but the send needs
  // the connection core, which in turn needs the bindings — so they reach it
  // through this ref, kept current by an Effect below.
  const resendPendingRef = useRef<() => void>(() => undefined);

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

  const bindSocket = useCallback(
    (socket: Socket) => {
      socketRef.current = socket;
      isTeamLinkedRef.current = false;
      linkedSocketIdRef.current = null;
      pendingSubmitRef.current = null;

      socket.on(SOCKET_EVENTS.STATE_SYNC, (payload: StateSnapshotPayload) => {
        setSeenQuestions((current) => mergeSeenQuestions(current, payload));
      });
      socket.on(
        SOCKET_EVENTS.STATE_UPDATED,
        (payload: StateSnapshotPayload) => {
          setSeenQuestions((current) => mergeSeenQuestions(current, payload));
        },
      );

      socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload: JoinAcceptedPayload) => {
        setTeam(payload);
        setMyAnswers(buildMyAnswers(payload.answers ?? []));
        setMyAnswerGrades(buildMyAnswerGrades(payload.answers ?? []));
        setMyBonusAwards(payload.bonusAwards ?? []);
        linkedSocketIdRef.current = socket.id ?? null;
        setTeamLinked(true);
        resendPendingRef.current();
      });

      // The saved answer and any auto-graded points — the acknowledgement
      // only says the answer was accepted, this carries what was stored.
      socket.on(
        SOCKET_EVENTS.ANSWER_RECEIVED,
        (payload: AnswerReceivedPayload) => {
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

      socket.on(SOCKET_EVENTS.BONUS_AWARDED, (payload: BonusAwardedPayload) => {
        setMyBonusAwards((current) => [...current, payload]);
      });

      socket.on(
        SOCKET_EVENTS.SESSION_CLOSED,
        (payload: SessionClosedPayload) => {
          setSessionClosed(payload.joinCode);
        },
      );

      socket.on(SOCKET_EVENTS.TEAM_KICKED, () => setKicked(true));

      socket.on('disconnect', () => {
        setTeamLinked(false);
        // Any unacknowledged answer stays pending and is resent after the rejoin.
        clearSubmitConfirmTimer();
      });
    },
    [clearSubmitConfirmTimer, setTeamLinked],
  );

  const { identityKey, emitWithAck, forceReconnect, ...connection } =
    useGameConnection('players', enabled, joinCode, bindSocket, retryKey);

  // A fresh connect starts from a clean slate — otherwise the previous
  // identity's data stays on screen until the new STATE_SYNC arrives.
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (enabled) {
      setTeam(null);
      setMyAnswers({});
      setMyAnswerGrades({});
      setMyBonusAwards([]);
      setSeenQuestions({});
      setSessionClosed(null);
      setKicked(false);
      setIsTeamLinked(false);
    }
  }

  // Emits the answer and arms a confirmation timer: if the server never
  // acknowledges, the socket is dead without knowing it, so force a fresh
  // connection — the rejoin that follows resends this answer.
  const sendAnswer = useCallback(
    (payload: SubmitAnswerPayload): Promise<AckResult> => {
      const attempt = submitAttemptRef.current + 1;
      submitAttemptRef.current = attempt;
      pendingSubmitRef.current = payload;
      clearSubmitConfirmTimer();

      return new Promise((resolve) => {
        submitConfirmTimerRef.current = setTimeout(() => {
          submitConfirmTimerRef.current = null;
          setTeamLinked(false);
          forceReconnect();
          resolve({ success: false, error: NOT_CONNECTED_MESSAGE });
        }, SUBMIT_CONFIRM_TIMEOUT_MS);

        void emitWithAck(SOCKET_EVENTS.SUBMIT_ANSWER, payload).then(
          (result) => {
            // A superseded send says nothing about this answer.
            if (attempt !== submitAttemptRef.current) {
              resolve(result);
              return;
            }
            // An answer that never left the socket stays pending for the
            // rejoin; there is no dead socket to force a reconnect on, so
            // socket.io's own reconnect is left alone.
            if (!result.success && result.error === NOT_CONNECTED_MESSAGE) {
              clearSubmitConfirmTimer();
              resolve(result);
              return;
            }
            pendingSubmitRef.current = null;
            clearSubmitConfirmTimer();
            // Toasts directly (not via state) so a repeat rejection with the
            // identical message still toasts each time.
            if (!result.success) toast.error(result.error);
            resolve(result);
          },
        );
      });
    },
    [clearSubmitConfirmTimer, emitWithAck, forceReconnect, setTeamLinked],
  );

  useEffect(() => {
    resendPendingRef.current = () => {
      if (pendingSubmitRef.current) void sendAnswer(pendingSubmitRef.current);
    };
  }, [sendAnswer]);

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
      return emitWithAck(SOCKET_EVENTS.JOIN_PLAYERS, payload);
    },
    [emitWithAck],
  );

  const submitAnswer = useCallback(
    (questionId: number, teamId: number, value: string) => {
      if (!isTeamLinkedRef.current) {
        toast.error(NOT_CONNECTED_MESSAGE);
        return Promise.resolve<AckResult>({
          success: false,
          error: NOT_CONNECTED_MESSAGE,
        });
      }
      return sendAnswer({ questionId, teamId, value });
    },
    [sendAnswer],
  );

  const leaveSession = useCallback(
    (teamId: number) => {
      const payload: LeaveSessionPayload = { teamId };
      return emitWithAck(SOCKET_EVENTS.LEAVE_SESSION, payload);
    },
    [emitWithAck],
  );

  const submitShowdownGuess = useCallback(
    async (showdownRoundId: number, teamId: number, value: string) => {
      const payload: SubmitShowdownGuessPayload = {
        showdownRoundId,
        teamId,
        value,
      };
      const result = await emitWithAck(
        SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS,
        payload,
      );
      if (!result.success) toast.error(result.error);
      return result;
    },
    [emitWithAck],
  );

  return {
    ...connection,
    team,
    isTeamLinked,
    kicked,
    sessionClosed,
    myAnswers,
    myAnswerGrades,
    myBonusAwards,
    seenQuestions,
    joinTeam,
    submitAnswer,
    leaveSession,
    submitShowdownGuess,
  };
}
