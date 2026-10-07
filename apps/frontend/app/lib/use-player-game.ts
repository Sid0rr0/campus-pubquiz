'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AckResult,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type JoinAcceptedPayload,
  type JoinPlayersPayload,
  type LeaveSessionPayload,
  type RateRoundPayload,
  type RoundRatingView,
  type SendFeedbackPayload,
  type TeamFeedbackView,
  type PlayersStatePayload,
  type StateViewByRoom,
  type SubmitAnswerPayload,
  type SubmitShowdownGuessPayload,
  type TeamAnswerView,
  type TeamBonusAwardView,
  type Verdict,
} from '@campus-pubquiz/types';
import { formatBonusAwardToast } from '@/app/lib/bonus-categories';
import {
  NOT_CONNECTED_MESSAGE,
  useGameConnection,
  type SocketConnection,
  type RoomSocket,
} from '@/app/lib/use-game-connection';

/** Award toasts outlast the default so a team passing the phone around still sees them. */
const BONUS_AWARD_TOAST_DURATION_MS = 8000;

/** How long a submitted answer may go unacknowledged before the socket is treated as silently dead — e.g. a network switch or a phone waking from sleep, where socket.io can still believe it's connected until its ~45s ping timeout. */
export const SUBMIT_CONFIRM_TIMEOUT_MS = 5000;

/** A team's own graded answer to one question — absent from the map entirely until grading happens (at submit when the answer is graded automatically, on admin grading otherwise). */
export interface MyAnswerGrade {
  pointsAwarded: number;
  gradedAt: string;
  /** How the answer was judged — the same verdict the quiz master sees. */
  verdict: Verdict | null;
}

/** The fields of the players view the seen-questions merge reads. */
export type SeenQuestionsSource = Pick<
  PlayersStatePayload,
  'blockQuestions' | 'revealQuestions' | 'pastRevealedQuestions'
>;

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
  /** The live connection (a new object on every connect), or null while disconnected — what the Team link tells connections apart by. */
  socketConnection: SocketConnection | null;
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
  /** The team's saved round ratings by round id: what the join payload last carried plus every rating the server has acknowledged since, so a reconnecting phone shows its stars again (a tap that never reached the server is not in it). */
  myRoundRatings: Record<number, number>;
  /** The team's saved comment and topics: what the join payload last carried plus whatever the server has acknowledged since, so a reconnecting phone shows its final form again. */
  myFeedback: TeamFeedbackView;
  /** Counts join payloads: when it changes, `myRoundRatings` was replaced wholesale and anything drawn from older taps is out of date. */
  roundRatingsEpoch: number;
  /** Every question this socket has seen open or revealed so far, keyed by id — accumulated across blocks/rounds, since the snapshot only ever covers the current block. */
  seenQuestions: SeenQuestions;
  /** Emits the join as given and resolves to the server's verdict; the Team link decides when to send one and shows a rejection (it is not toasted here). */
  sendJoin: (payload: JoinPlayersPayload) => Promise<AckResult>;
  /** Refuses with a "not connected" toast while unlinked; otherwise keeps the answer pending (and resends it after a rejoin) until the server acknowledges it. A rejection is toasted and never treated as a dead connection. */
  submitAnswer: (
    questionId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
  /** Resolves to the server's verdict on one round rating; the rating card shows it, so nothing is toasted here. */
  rateRound: (roundId: number, stars: number) => Promise<AckResult>;
  /** Resolves to the server's verdict on the comment and topics; the final form shows it, so nothing is toasted here. */
  sendFeedback: (feedback: SendFeedbackPayload) => Promise<AckResult>;
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
  payload: SeenQuestionsSource,
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

const EMPTY_FEEDBACK: TeamFeedbackView = { comment: '', topics: [] };

export function buildMyRoundRatings(
  ratings: RoundRatingView[],
): Record<number, number> {
  return Object.fromEntries(
    ratings.map((rating) => [rating.roundId, rating.stars]),
  );
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

/**
 * A team phone's view of a live session. Every action returns a promise of
 * the server's acknowledgement; answer and showdown-guess rejections are
 * toasted here, while a join rejection is left to the join flow to show.
 */
export function usePlayerGame(
  enabled: boolean,
  joinCode: string | undefined,
  // Bumped by callers (e.g. the Team link's attempt) to force a fresh
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
  const [myRoundRatings, setMyRoundRatings] = useState<Record<number, number>>(
    {},
  );
  const [myFeedback, setMyFeedback] =
    useState<TeamFeedbackView>(EMPTY_FEEDBACK);
  const [roundRatingsEpoch, setRoundRatingsEpoch] = useState(0);
  const [seenQuestions, setSeenQuestions] = useState<SeenQuestions>({});
  const [sessionClosed, setSessionClosed] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [isTeamLinked, setIsTeamLinked] = useState(false);
  // Mirrors isTeamLinked for submitAnswer, which must check it synchronously.
  const isTeamLinkedRef = useRef(false);
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
    (socket: RoomSocket<'players'>) => {
      isTeamLinkedRef.current = false;
      pendingSubmitRef.current = null;

      const onStateReceived = (
        payload: Parameters<typeof mergeSeenQuestions>[1],
      ) => {
        setSeenQuestions((current) => mergeSeenQuestions(current, payload));
      };
      socket.on(SOCKET_EVENTS.STATE_SYNC, onStateReceived);
      socket.on(SOCKET_EVENTS.STATE_UPDATED, onStateReceived);

      socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload) => {
        setTeam(payload);
        setMyAnswers(buildMyAnswers(payload.answers ?? []));
        setMyAnswerGrades(buildMyAnswerGrades(payload.answers ?? []));
        setMyBonusAwards(payload.bonusAwards ?? []);
        setMyRoundRatings(buildMyRoundRatings(payload.roundRatings ?? []));
        setMyFeedback(payload.feedback ?? EMPTY_FEEDBACK);
        setRoundRatingsEpoch((epoch) => epoch + 1);
        setTeamLinked(true);
        resendPendingRef.current();
      });

      // The saved answer and any auto-graded points — the acknowledgement
      // only says the answer was accepted, this carries what was stored.
      socket.on(SOCKET_EVENTS.ANSWER_RECEIVED, (payload) => {
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
      });

      // Pushed once the block a team answered reaches reveal_intro — carries
      // that team's complete, freshly-graded answer set (same shape as
      // JOIN_ACCEPTED.answers), so both maps are replaced wholesale rather
      // than merged, same as a reconnect would produce.
      socket.on(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, (payload) => {
        setMyAnswers(buildMyAnswers(payload.answers));
        setMyAnswerGrades(buildMyAnswerGrades(payload.answers));
      });

      socket.on(SOCKET_EVENTS.BONUS_AWARDED, (payload) => {
        setMyBonusAwards((current) => [...current, payload]);
        // Only a live award notice toasts; awards restored on join never come through here.
        const message = formatBonusAwardToast(payload);
        const options = { duration: BONUS_AWARD_TOAST_DURATION_MS };
        if (payload.points > 0) toast.success(`🎉 ${message}`, options);
        else toast(message, options);
      });

      socket.on(SOCKET_EVENTS.SESSION_CLOSED, (payload) => {
        setSessionClosed(payload.joinCode);
      });

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
      setMyRoundRatings({});
      setMyFeedback(EMPTY_FEEDBACK);
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

  const sendJoin = useCallback(
    (payload: JoinPlayersPayload) =>
      emitWithAck(SOCKET_EVENTS.JOIN_PLAYERS, payload),
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

  const rateRound = useCallback(
    async (roundId: number, stars: number) => {
      const payload: RateRoundPayload = { roundId, stars };
      const result = await emitWithAck(SOCKET_EVENTS.RATE_ROUND, payload);
      if (result.success) {
        setMyRoundRatings((current) => ({ ...current, [roundId]: stars }));
      }
      return result;
    },
    [emitWithAck],
  );

  const sendFeedback = useCallback(
    async (feedback: SendFeedbackPayload) => {
      const result = await emitWithAck(SOCKET_EVENTS.SEND_FEEDBACK, feedback);
      if (result.success) {
        setMyFeedback({ comment: feedback.comment, topics: feedback.topics });
      }
      return result;
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
    myRoundRatings,
    myFeedback,
    roundRatingsEpoch,
    seenQuestions,
    sendJoin,
    submitAnswer,
    leaveSession,
    rateRound,
    sendFeedback,
    submitShowdownGuess,
  };
}
