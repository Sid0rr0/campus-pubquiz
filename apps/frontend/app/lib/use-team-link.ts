'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AckResult,
  type JoinAcceptedPayload,
  type LeaveSessionPayload,
  type RateRoundPayload,
  type SendFeedbackPayload,
  type StateViewByRoom,
  type SubmitShowdownGuessPayload,
  type TeamBonusAwardView,
  type TeamFeedbackView,
} from '@campus-pubquiz/types';
import { NOT_CONNECTED_MESSAGE } from '@/app/lib/connection-messages';
import {
  mergeSeenQuestions,
  type SeenQuestions,
} from '@/app/lib/seen-questions';
import {
  initialTeamLink,
  teamLink,
  type MyAnswerGrade,
  type TeamLinkCommand,
  type TeamLinkInput,
} from '@/app/lib/team-link';
import {
  JOIN_CODE_STORAGE_KEY,
  TEAM_CODE_STORAGE_KEY,
  TEAM_NAME_STORAGE_KEY,
  TEAM_TOKEN_STORAGE_KEY,
  clearStoredSession,
  readStoredIdentity,
} from '@/app/lib/team-storage';
import {
  useGameConnection,
  type RoomSocket,
  type UseGameConnectionResult,
} from '@/app/lib/use-game-connection';

/** How long a submitted answer may go unacknowledged before the socket is treated as silently dead — e.g. a network switch or a phone waking from sleep, where socket.io can still believe it's connected until its ~45s ping timeout. */
export const SUBMIT_CONFIRM_TIMEOUT_MS = 5000;

const STORAGE_KEY_BY_IDENTITY_FIELD = {
  teamName: TEAM_NAME_STORAGE_KEY,
  gameCode: JOIN_CODE_STORAGE_KEY,
  teamToken: TEAM_TOKEN_STORAGE_KEY,
  teamCode: TEAM_CODE_STORAGE_KEY,
} as const;

const NOT_CONNECTED_RESULT: AckResult = {
  success: false,
  error: NOT_CONNECTED_MESSAGE,
};

type PlayerConnection = Pick<
  UseGameConnectionResult<'players'>,
  'emitWithAck' | 'forceReconnect'
>;

export interface UseTeamLinkResult {
  snapshot: StateViewByRoom['players'] | null;
  team: JoinAcceptedPayload | null;
  /** The team's own saved answers by question id. */
  myAnswers: Record<number, string>;
  /** The team's own points awarded by question id, present only once that question's answer is graded. */
  myAnswerGrades: Record<number, MyAnswerGrade>;
  /** Every bonus award this team has received so far this session, in award order. */
  myBonusAwards: TeamBonusAwardView[];
  /** The team's saved round ratings by round id: what the join payload last carried plus every rating the server has acknowledged since (a tap that never reached the server is not in it). */
  myRoundRatings: Record<number, number>;
  /** The team's saved comment and topics, kept the same way as the ratings. */
  myFeedback: TeamFeedbackView;
  /** Counts join payloads: when it changes, `myRoundRatings` was replaced wholesale and anything drawn from older taps is out of date. */
  roundRatingsEpoch: number;
  /** Every question this socket has seen open or revealed so far, keyed by id — accumulated across blocks/rounds, since the snapshot only ever covers the current block. */
  seenQuestions: SeenQuestions;
  /** Refuses with a "not connected" toast while unlinked; otherwise keeps the answer pending (and resends it after a rejoin) until the server acknowledges it. */
  submitAnswer: (
    questionId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
  /** Resolves to the server's verdict on one round rating; the rating card shows it, so nothing is toasted here. */
  rateRound: (roundId: number, stars: number) => Promise<AckResult>;
  /** Resolves to the server's verdict on the comment and topics; the final form shows it, so nothing is toasted here. */
  sendFeedback: (feedback: SendFeedbackPayload) => Promise<AckResult>;
  submitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
  /** What the join screen shows: a rejected join's reason, the kick notice, or a connection problem — in that order. */
  connectionError: string | null;
  teamName: string | null;
  nameInput: string;
  setNameInput: (value: string) => void;
  codeInput: string;
  setCodeInput: (value: string) => void;
  teamCodeInput: string;
  setTeamCodeInput: (value: string) => void;
  hasStoredIdentity: boolean;
  /** The game code the connection is opened for, or null when none is known yet — tells "genuinely mid-connection" apart from "no session to reconnect to" even while teamName is already restored from storage. */
  activeJoinCode: string | null;
  handleJoin: (event: SubmitEvent<HTMLFormElement>) => void;
  handleLogOut: () => void;
}

function writeIdentity(
  identity: Extract<TeamLinkCommand, { type: 'writeIdentity' }>['identity'],
): void {
  for (const [field, key] of Object.entries(STORAGE_KEY_BY_IDENTITY_FIELD)) {
    const value = identity[field as keyof typeof identity];
    if (value) window.localStorage.setItem(key, value);
  }
}

function showToast(command: Extract<TeamLinkCommand, { type: 'toast' }>) {
  const options = { duration: command.durationMs };
  if (command.tone === 'success') toast.success(command.message, options);
  else if (command.tone === 'error') toast.error(command.message, options);
  else toast(command.message, options);
}

/**
 * Runs the Team link with React for /play and the home page's join panel:
 * feeds the socket's events and the team's taps into the module, keeps its
 * state, and carries out its commands against the socket, localStorage, the
 * router, the toaster and the answer confirmation timer.
 */
export function useTeamLink(
  codeFromUrl: string,
  teamCodeFromUrl: string = '',
  nameFromUrl: string = '',
): UseTeamLinkResult {
  const router = useRouter();
  const [link, setLink] = useState(() =>
    initialTeamLink({
      url: {
        gameCode: codeFromUrl,
        teamCode: teamCodeFromUrl,
        name: nameFromUrl,
      },
    }),
  );
  // Always the newest state, so a second tap before React re-renders still
  // sees the double-tap guard.
  const linkRef = useRef(link);
  // The socket's emit and reconnect come from the connection core, which in
  // turn needs the socket bindings (which need `dispatch`), so commands reach
  // it through this ref.
  const connectionRef = useRef<PlayerConnection | null>(null);
  const goToJoinScreenRef = useRef<() => void>(() => undefined);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What each answer attempt's caller is waiting for.
  const answerWaitersRef = useRef(new Map<number, (r: AckResult) => void>());
  const latestAnswerRef = useRef<Promise<AckResult> | null>(null);
  const [seenQuestions, setSeenQuestions] = useState<SeenQuestions>({});

  const dispatch = useCallback(function dispatch(input: TeamLinkInput) {
    const step = teamLink(linkRef.current, input);
    linkRef.current = step.state;
    setLink(step.state);
    for (const command of step.commands) runCommand(command);

    function clearConfirmTimer() {
      if (confirmTimerRef.current === null) return;
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }

    function runCommand(command: TeamLinkCommand) {
      const connection = connectionRef.current;
      switch (command.type) {
        case 'sendJoin':
          void connection
            ?.emitWithAck(SOCKET_EVENTS.JOIN_PLAYERS, command.payload)
            .then((result) => {
              if (result.success) return;
              dispatch({
                type: 'joinRefused',
                connectionId: command.connectionId,
                reason: result.error,
              });
            });
          break;
        case 'sendAnswer': {
          const { attempt, payload } = command;
          latestAnswerRef.current = new Promise<AckResult>((resolve) => {
            answerWaitersRef.current.set(attempt, resolve);
            const sent =
              connection?.emitWithAck(SOCKET_EVENTS.SUBMIT_ANSWER, payload) ??
              Promise.resolve(NOT_CONNECTED_RESULT);
            void sent.then((result) => {
              answerWaitersRef.current.delete(attempt);
              resolve(result);
              dispatch({ type: 'answerResult', attempt, result });
            });
          });
          break;
        }
        case 'armConfirmTimer':
          clearConfirmTimer();
          confirmTimerRef.current = setTimeout(() => {
            confirmTimerRef.current = null;
            answerWaitersRef.current.get(command.attempt)?.(
              NOT_CONNECTED_RESULT,
            );
            dispatch({ type: 'answerTimedOut', attempt: command.attempt });
          }, SUBMIT_CONFIRM_TIMEOUT_MS);
          break;
        case 'clearConfirmTimer':
          clearConfirmTimer();
          break;
        case 'forceReconnect':
          connection?.forceReconnect();
          break;
        case 'toast':
          showToast(command);
          break;
        case 'writeIdentity':
          writeIdentity(command.identity);
          break;
        case 'clearIdentity':
          clearStoredSession(command.scope === 'all');
          break;
        case 'sendLeave': {
          const payload: LeaveSessionPayload = { teamId: command.teamId };
          // Best-effort: the team is leaving whether or not the server hears it.
          void connection?.emitWithAck(SOCKET_EVENTS.LEAVE_SESSION, payload);
          break;
        }
        case 'goToJoinScreen':
          goToJoinScreenRef.current();
          break;
        case 'openConnection':
          // The connection core below opens it from `activeJoinCode` and `attempt`.
          break;
        default: {
          const unhandled: never = command;
          throw new Error(`Unhandled team link command: ${String(unhandled)}`);
        }
      }
    }
  }, []);

  const bindSocket = useCallback(
    (socket: RoomSocket<'players'>) => {
      const onStateReceived = (
        payload: Parameters<typeof mergeSeenQuestions>[1],
      ) => setSeenQuestions((current) => mergeSeenQuestions(current, payload));
      socket.on(SOCKET_EVENTS.STATE_SYNC, onStateReceived);
      socket.on(SOCKET_EVENTS.STATE_UPDATED, onStateReceived);
      socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload) =>
        dispatch({ type: 'joinAccepted', payload }),
      );
      socket.on(SOCKET_EVENTS.ANSWER_RECEIVED, (payload) =>
        dispatch({ type: 'answerReceived', payload }),
      );
      socket.on(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, (payload) =>
        dispatch({ type: 'teamAnswersSynced', answers: payload.answers }),
      );
      socket.on(SOCKET_EVENTS.BONUS_AWARDED, (payload) =>
        dispatch({ type: 'bonusAwarded', payload }),
      );
      socket.on(SOCKET_EVENTS.SESSION_CLOSED, () =>
        dispatch({ type: 'sessionClosed' }),
      );
      socket.on(SOCKET_EVENTS.TEAM_KICKED, () => dispatch({ type: 'kicked' }));
    },
    [dispatch],
  );

  const {
    snapshot,
    socketConnection,
    connectionError: socketConnectionError,
    identityKey,
    emitWithAck,
    forceReconnect,
  } = useGameConnection(
    'players',
    Boolean(link.activeJoinCode),
    link.activeJoinCode ?? undefined,
    bindSocket,
    link.attempt,
  );

  useEffect(() => {
    connectionRef.current = { emitWithAck, forceReconnect };
    goToJoinScreenRef.current = () => router.push('/play');
  }, [emitWithAck, forceReconnect, router]);

  useEffect(
    () => () => {
      if (confirmTimerRef.current !== null) {
        clearTimeout(confirmTimerRef.current);
      }
    },
    [],
  );

  // A fresh connect starts from a clean slate — otherwise the previous
  // identity's data stays on screen until the new STATE_SYNC arrives.
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (link.activeJoinCode) setSeenQuestions({});
  }
  const identityKeyRef = useRef(identityKey);
  useEffect(() => {
    if (identityKeyRef.current === identityKey) return;
    identityKeyRef.current = identityKey;
    if (linkRef.current.activeJoinCode) dispatch({ type: 'identityChanged' });
  }, [identityKey, dispatch]);

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored identity can only
    // be read after mount.
    dispatch({ type: 'storageRead', stored: readStoredIdentity() });
  }, [dispatch]);

  const connectionCountRef = useRef({ count: 0, last: socketConnection });
  useEffect(() => {
    if (!socketConnection) {
      if (linkRef.current.connection) dispatch({ type: 'disconnected' });
      return;
    }
    const counter = connectionCountRef.current;
    if (counter.last !== socketConnection) {
      counter.count += 1;
      counter.last = socketConnection;
    }
    dispatch({
      type: 'connected',
      connectionId: counter.count,
      socketId: socketConnection.socketId,
    });
  }, [socketConnection, dispatch]);

  useEffect(() => {
    // A refused connection (e.g. an unknown game code) never gets as far as a
    // join, so no join result will arrive to release the guard.
    if (socketConnectionError) dispatch({ type: 'connectionRefused' });
  }, [socketConnectionError, dispatch]);

  const status = snapshot?.progress.status;
  useEffect(() => {
    if (status) dispatch({ type: 'statusSeen', status });
  }, [status, dispatch]);

  const submitAnswer = useCallback(
    (questionId: number, teamId: number, value: string) => {
      latestAnswerRef.current = null;
      dispatch({ type: 'answerSubmitted', questionId, teamId, value });
      return latestAnswerRef.current ?? Promise.resolve(NOT_CONNECTED_RESULT);
    },
    [dispatch],
  );

  const rateRound = useCallback(
    async (roundId: number, stars: number) => {
      const payload: RateRoundPayload = { roundId, stars };
      const result = await emitWithAck(SOCKET_EVENTS.RATE_ROUND, payload);
      if (result.success) dispatch({ type: 'ratingSaved', roundId, stars });
      return result;
    },
    [emitWithAck, dispatch],
  );

  const sendFeedback = useCallback(
    async (feedback: SendFeedbackPayload) => {
      const result = await emitWithAck(SOCKET_EVENTS.SEND_FEEDBACK, feedback);
      if (result.success) {
        dispatch({
          type: 'feedbackSaved',
          feedback: { comment: feedback.comment, topics: feedback.topics },
        });
      }
      return result;
    },
    [emitWithAck, dispatch],
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

  const setNameInput = useCallback(
    (value: string) => dispatch({ type: 'nameTyped', value }),
    [dispatch],
  );
  const setCodeInput = useCallback(
    (value: string) => dispatch({ type: 'gameCodeTyped', value }),
    [dispatch],
  );
  const setTeamCodeInput = useCallback(
    (value: string) => dispatch({ type: 'teamCodeTyped', value }),
    [dispatch],
  );

  function handleJoin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: 'joinSubmitted' });
  }

  // Stable across renders since SiteHeader's PlayerMenuProvider bridge
  // depends on this reference.
  const handleLogOut = useCallback(
    () => dispatch({ type: 'logoutRequested' }),
    [dispatch],
  );

  return {
    snapshot,
    team: link.team,
    myAnswers: link.myAnswers,
    myAnswerGrades: link.myAnswerGrades,
    myBonusAwards: link.myBonusAwards,
    myRoundRatings: link.myRoundRatings,
    myFeedback: link.myFeedback,
    roundRatingsEpoch: link.roundRatingsEpoch,
    seenQuestions,
    submitAnswer,
    rateRound,
    sendFeedback,
    submitShowdownGuess,
    connectionError: link.joinError ?? link.kickNotice ?? socketConnectionError,
    teamName: link.teamName,
    nameInput: link.nameInput,
    setNameInput,
    codeInput: link.codeInput,
    setCodeInput,
    teamCodeInput: link.teamCodeInput,
    setTeamCodeInput,
    hasStoredIdentity: link.hasStoredIdentity,
    activeJoinCode: link.activeJoinCode,
    handleJoin,
    handleLogOut,
  };
}
