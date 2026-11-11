'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  SOCKET_EVENTS,
  type AckResult,
  type JoinAcceptedPayload,
  type LeaveSessionPayload,
  type PickJokerPayload,
  type PickSidePayload,
  type PowerUpId,
  type PurchaseView,
  type RateRoundPayload,
  type RateSessionPayload,
  type SendFeedbackPayload,
  type SetPlayerCountPayload,
  type StateViewByRoom,
  type SubmitShowdownGuessPayload,
  type TeamBonusAwardView,
  type TeamFeedbackView,
  type TeamJoker,
  type TeamSessionRatingsView,
} from '@campus-pubquiz/types';
import {
  NOT_CONNECTED_MESSAGE,
  isNotDelivered,
} from '@/app/lib/connection-messages';
import { needsJoinForm } from '@/app/lib/join-gate';
import {
  mergeSeenQuestions,
  type SeenQuestions,
} from '@/app/lib/seen-questions';
import {
  initialTeamLink,
  teamLink,
  type MyAnswer,
  type TeamLinkCommand,
  type TeamLinkInput,
  type TeamLinkState,
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
  type EmitWithAck,
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

/** Who the team is and how it gets in. */
export interface TeamLinkJoin {
  team: JoinAcceptedPayload | null;
  /** What the join screen shows: a rejected join's reason, the kick notice, or a connection problem — in that order. */
  connectionError: string | null;
  teamName: string | null;
  /** True while the only thing wrong is the socket reconnecting — no join error or kick notice outranks it — so /play shows the reconnecting bar instead of inline text. */
  isReconnecting: boolean;
  /** Drops the current socket and connects afresh; the join path hands the team's seat over. */
  forceReconnect: () => void;
  nameInput: string;
  setNameInput: (value: string) => void;
  codeInput: string;
  setCodeInput: (value: string) => void;
  teamCodeInput: string;
  setTeamCodeInput: (value: string) => void;
  hasStoredIdentity: boolean;
  /** Whether the phone should show the join form: no team name, nothing to reconnect to, or an unrecovered connection error. The one gate /play and the home page's join panel share. */
  needsJoinForm: boolean;
  /** The game code the connection is opened for, or null when none is known yet — tells "genuinely mid-connection" apart from "no session to reconnect to" even while teamName is already restored from storage. */
  activeJoinCode: string | null;
  handleJoin: (event: SubmitEvent<HTMLFormElement>) => void;
  handleLogOut: () => void;
}

/** What a joined phone plays with; present once a view has arrived. */
export interface TeamLinkGame {
  view: StateViewByRoom['players'];
  /** The team's own saved answers by question id, each with its grade (once graded) and recorded clue (Clue questions). */
  myAnswers: Record<number, MyAnswer>;
  /** Every bonus award this team has received so far this session, in award order. */
  myBonusAwards: TeamBonusAwardView[];
  /** The team's saved round ratings by round id: what the join payload last carried plus every rating the server has acknowledged since (a tap that never reached the server is not in it). */
  myRoundRatings: Record<number, number>;
  /** The team's saved comment and topics, kept the same way as the ratings. */
  myFeedback: TeamFeedbackView;
  /** Counts join payloads: when it changes, `myRoundRatings` was replaced wholesale and anything drawn from older taps is out of date. */
  roundRatingsEpoch: number;
  /** Every question this socket has seen open or revealed so far, keyed by id — accumulated across blocks/rounds, since the view only ever covers the current block. */
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
  /** The team's pacing and felt-difficulty answers, kept the same way as the ratings. */
  mySessionRatings: TeamSessionRatingsView;
  /** Resolves to the server's verdict on one pacing or felt-difficulty answer; the final form shows it, so nothing is toasted here. */
  rateSession: (rating: RateSessionPayload) => Promise<AckResult>;
  /** The team's player count as the server last confirmed it, or null until one is reported. */
  myPlayerCount: number | null;
  /** Resolves to the server's verdict on the count; the card shows it, so nothing is toasted here. */
  setPlayerCount: (playerCount: number) => Promise<AckResult>;
  /** The team's own joker as the server last said it, or null while it has none. */
  myJoker: TeamJoker | null;
  /** Resolves to the server's verdict on a joker pick; the picker shows it ("Saved ✓", or the reason), so nothing is toasted here. */
  pickJoker: (roundId: number) => Promise<AckResult>;
  /** The id of the team's own Versus side as the server last said it, or null while it has none. */
  mySideId: string | null;
  /** Resolves to the server's verdict on a side pick; the new side arrives as a sync, so nothing is dispatched here. */
  pickSide: (sideId: string) => Promise<AckResult>;
  /** The team's own power-up purchases as the server last said them. */
  myPurchases: PurchaseView[];
  /** The questions on which this team's Ask the room is ready, as the server last said. */
  roomReadyQuestionIds: number[];
  /** Buys a power-up on a question; resolves to the server's verdict (the refusal's reason when it says no). */
  buyPowerUp: (powerUp: PowerUpId, questionId: number) => Promise<AckResult>;
  buyExtraJoker: (roundId: number) => Promise<AckResult>;
  submitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
}

export interface UseTeamLinkResult {
  join: TeamLinkJoin;
  /** Absent until the first view arrives. */
  game: TeamLinkGame | undefined;
}

function writeIdentity(
  identity: Extract<TeamLinkCommand, { type: 'writeIdentity' }>['identity'],
): void {
  for (const [field, key] of Object.entries(STORAGE_KEY_BY_IDENTITY_FIELD)) {
    const value = identity[field as keyof typeof identity];
    if (value) window.localStorage.setItem(key, value);
  }
}

/** The view the phone draws: a question is answerable only while the server confirms this socket holds the team's seat, so the form never offers an answer the server would refuse. */
function viewWithSeat(
  view: StateViewByRoom['players'],
  isLinked: boolean,
): StateViewByRoom['players'] {
  return view.isAnswerable && !isLinked
    ? { ...view, isAnswerable: false }
    : view;
}

function showToast(command: Extract<TeamLinkCommand, { type: 'toast' }>) {
  const options = { duration: command.durationMs };
  if (command.tone === 'success') toast.success(command.message, options);
  else if (command.tone === 'error') toast.error(command.message, options);
  else toast(command.message, options);
}

type TimerRef = RefObject<ReturnType<typeof setTimeout> | null>;

/** The hook's refs a command reads or writes; each is stable for the hook's lifetime. */
interface TeamLinkCommandRefs {
  connectionRef: RefObject<PlayerConnection | null>;
  goToJoinScreenRef: RefObject<() => void>;
  confirmTimerRef: TimerRef;
  joinRetryTimerRef: TimerRef;
  answerWaitersRef: RefObject<Map<number, (r: AckResult) => void>>;
  latestAnswerRef: RefObject<Promise<AckResult> | null>;
}

function clearTimer(timerRef: TimerRef) {
  if (timerRef.current === null) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
}

/** Carries out one Team link command against the socket, timers and storage. */
function runTeamLinkCommand(
  command: TeamLinkCommand,
  dispatch: (input: TeamLinkInput) => void,
  refs: TeamLinkCommandRefs,
) {
  const run = COMMAND_RUNNERS[command.type] as
    | CommandRunner<TeamLinkCommand>
    | undefined;
  // Stryker disable next-line ConditionalExpression,BlockStatement: equivalent — an exhaustiveness guard; every command type has a runner
  if (!run) {
    throw new Error(`Unhandled team link command: ${String(command)}`);
  }
  run(command, dispatch, refs);
}

type CommandRunner<Command> = (
  command: Command,
  dispatch: (input: TeamLinkInput) => void,
  refs: TeamLinkCommandRefs,
) => void;
type CommandOf<Type extends TeamLinkCommand['type']> = Extract<
  TeamLinkCommand,
  { type: Type }
>;

function sendJoin(
  command: CommandOf<'sendJoin'>,
  dispatch: (input: TeamLinkInput) => void,
  { connectionRef }: TeamLinkCommandRefs,
) {
  void connectionRef.current
    ?.emitWithAck(SOCKET_EVENTS.JOIN_PLAYERS, command.payload)
    .then((result) => {
      if (result.success) return;
      dispatch({
        type: 'joinRefused',
        connectionId: command.connectionId,
        reason: result.error,
      });
    });
}

function sendAnswer(
  { attempt, payload }: CommandOf<'sendAnswer'>,
  dispatch: (input: TeamLinkInput) => void,
  { connectionRef, answerWaitersRef, latestAnswerRef }: TeamLinkCommandRefs,
) {
  latestAnswerRef.current = new Promise<AckResult>((resolve) => {
    answerWaitersRef.current.set(attempt, resolve);
    const sent =
      connectionRef.current?.emitWithAck(
        SOCKET_EVENTS.SUBMIT_ANSWER,
        payload,
      ) ?? Promise.resolve(NOT_CONNECTED_RESULT);
    void sent.then((result) => {
      // Stryker disable next-line CallExpression: equivalent — a waiter left in the map is only resolved a second time later, which a promise ignores
      answerWaitersRef.current.delete(attempt);
      resolve(result);
      dispatch(
        isNotDelivered(result)
          ? { type: 'answerNotDelivered', attempt }
          : { type: 'answerResult', attempt, result },
      );
    });
  });
}

function armConfirmTimer(
  command: CommandOf<'armConfirmTimer'>,
  dispatch: (input: TeamLinkInput) => void,
  { confirmTimerRef, answerWaitersRef }: TeamLinkCommandRefs,
) {
  // Stryker disable next-line CallExpression: equivalent — the Team link always emits `clearConfirmTimer` just before `armConfirmTimer`
  clearTimer(confirmTimerRef);
  confirmTimerRef.current = setTimeout(() => {
    confirmTimerRef.current = null;
    answerWaitersRef.current.get(command.attempt)?.(NOT_CONNECTED_RESULT);
    dispatch({ type: 'answerTimedOut', attempt: command.attempt });
  }, SUBMIT_CONFIRM_TIMEOUT_MS);
}

function scheduleJoinRetry(
  command: CommandOf<'scheduleJoinRetry'>,
  dispatch: (input: TeamLinkInput) => void,
  { joinRetryTimerRef }: TeamLinkCommandRefs,
) {
  clearTimer(joinRetryTimerRef);
  joinRetryTimerRef.current = setTimeout(() => {
    joinRetryTimerRef.current = null;
    dispatch({ type: 'joinRetryDue', connectionId: command.connectionId });
  }, command.delayMs);
}

function sendLeave(
  command: CommandOf<'sendLeave'>,
  _dispatch: (input: TeamLinkInput) => void,
  { connectionRef }: TeamLinkCommandRefs,
) {
  const payload: LeaveSessionPayload = { teamId: command.teamId };
  // Best-effort: the team is leaving whether or not the server hears it.
  void connectionRef.current?.emitWithAck(SOCKET_EVENTS.LEAVE_SESSION, payload);
}

const COMMAND_RUNNERS: {
  [Type in TeamLinkCommand['type']]: CommandRunner<CommandOf<Type>>;
} = {
  sendJoin,
  sendAnswer,
  armConfirmTimer,
  clearConfirmTimer: (_command, _dispatch, { confirmTimerRef }) =>
    clearTimer(confirmTimerRef),
  forceReconnect: (_command, _dispatch, { connectionRef }) =>
    connectionRef.current?.forceReconnect(),
  scheduleJoinRetry,
  toast: (command) => showToast(command),
  writeIdentity: (command) => writeIdentity(command.identity),
  clearIdentity: (command) => clearStoredSession(command.scope === 'all'),
  sendLeave,
  goToJoinScreen: (_command, _dispatch, { goToJoinScreenRef }) =>
    goToJoinScreenRef.current(),
};

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
  const joinRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What each answer attempt's caller is waiting for.
  const answerWaitersRef = useRef(new Map<number, (r: AckResult) => void>());
  const latestAnswerRef = useRef<Promise<AckResult> | null>(null);
  const [seenQuestions, setSeenQuestions] = useState<SeenQuestions>({});

  // A range, not next-line: Stryker only honours a comment that leads a node, and nothing leads the `[]` after this callback's closing brace. Equivalent — `dispatch` reads only refs and state setters, so a padded list never changes how it behaves.
  // Stryker disable ArrayDeclaration: see above
  const dispatch = useCallback(function dispatch(input: TeamLinkInput) {
    const step = teamLink(linkRef.current, input);
    linkRef.current = step.state;
    setLink(step.state);
    for (const command of step.commands) {
      runTeamLinkCommand(command, dispatch, {
        connectionRef,
        goToJoinScreenRef,
        confirmTimerRef,
        joinRetryTimerRef,
        answerWaitersRef,
        latestAnswerRef,
      });
    }
  }, []);
  // Stryker restore ArrayDeclaration

  const bindSocket = useCallback(
    (socket: RoomSocket<'players'>) => {
      const onStateReceived = (payload: StateViewByRoom['players']) => {
        setSeenQuestions((current) => mergeSeenQuestions(current, payload));
        // From the socket, not the snapshot: a snapshot kept across a
        // reconnect would show a stale status before the new connection's own.
        dispatch({ type: 'statusSeen', status: payload.progress.status });
      };
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
      socket.on(SOCKET_EVENTS.TEAM_PLAYER_COUNT_SYNCED, (payload) =>
        dispatch({
          type: 'playerCountSynced',
          playerCount: payload.playerCount,
        }),
      );
      socket.on(SOCKET_EVENTS.TEAM_JOKER_SYNCED, (payload) =>
        dispatch({ type: 'jokerSynced', joker: payload.joker }),
      );
      socket.on(SOCKET_EVENTS.TEAM_SIDE_SYNCED, (payload) =>
        dispatch({ type: 'sideSynced', sideId: payload.sideId }),
      );
      socket.on(SOCKET_EVENTS.TEAM_PURCHASES_SYNCED, (payload) =>
        dispatch({ type: 'purchasesSynced', payload }),
      );
      socket.on(SOCKET_EVENTS.TEAM_ROOM_READY_SYNCED, (payload) =>
        dispatch({ type: 'roomReadySynced', payload }),
      );
      socket.on(SOCKET_EVENTS.BONUS_AWARDED, (payload) =>
        dispatch({ type: 'bonusAwarded', payload }),
      );
      socket.on(SOCKET_EVENTS.TEAM_BONUS_AWARDS_SYNCED, (payload) =>
        dispatch({
          type: 'bonusAwardsSynced',
          bonusAwards: payload.bonusAwards,
        }),
      );
      socket.on(SOCKET_EVENTS.COIN_AWARDED, (payload) =>
        dispatch({ type: 'coinAwarded', payload }),
      );
      socket.on(SOCKET_EVENTS.TEAM_COINS_SYNCED, (payload) =>
        dispatch({ type: 'coinsSynced', payload }),
      );
      socket.on(SOCKET_EVENTS.SESSION_CLOSED, () =>
        dispatch({ type: 'sessionClosed' }),
      );
      socket.on(SOCKET_EVENTS.TEAM_KICKED, () => dispatch({ type: 'kicked' }));
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `dispatch` never changes, so an emptied list still binds each socket once
    [dispatch],
  );

  const {
    snapshot,
    socketConnection,
    connectionError: socketConnectionError,
    connectionIssue,
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

  // A range, not next-line, for the same reason as `dispatch`. Equivalent — `emitWithAck`, `forceReconnect` and Next's `router` never change, so an emptied list sets the same refs once.
  // Stryker disable ArrayDeclaration: see above
  useEffect(() => {
    connectionRef.current = { emitWithAck, forceReconnect };
    goToJoinScreenRef.current = () => router.push('/play');
  }, [emitWithAck, forceReconnect, router]);
  // Stryker restore ArrayDeclaration

  useClearTimersOnUnmount(confirmTimerRef, joinRetryTimerRef);
  useLinkFollowsConnection({
    identityKey,
    socketConnection,
    socketConnectionError,
    link,
    linkRef,
    dispatch,
    setSeenQuestions,
  });
  const actions = useTeamLinkActions(emitWithAck, dispatch);

  const submitAnswer = useCallback(
    (questionId: number, teamId: number, value: string) => {
      latestAnswerRef.current = null;
      dispatch({ type: 'answerSubmitted', questionId, teamId, value });
      return latestAnswerRef.current ?? Promise.resolve(NOT_CONNECTED_RESULT);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `dispatch` never changes, so `submitAnswer` is the same function either way
    [dispatch],
  );

  const setNameInput = useCallback(
    (value: string) => dispatch({ type: 'nameTyped', value }),
    // Stryker disable next-line ArrayDeclaration: equivalent — `dispatch` never changes, so `setNameInput` is the same function either way
    [dispatch],
  );
  const setCodeInput = useCallback(
    (value: string) => dispatch({ type: 'gameCodeTyped', value }),
    // Stryker disable next-line ArrayDeclaration: equivalent — `dispatch` never changes, so `setCodeInput` is the same function either way
    [dispatch],
  );
  const setTeamCodeInput = useCallback(
    (value: string) => dispatch({ type: 'teamCodeTyped', value }),
    // Stryker disable next-line ArrayDeclaration: equivalent — `dispatch` never changes, so `setTeamCodeInput` is the same function either way
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
    // Stryker disable next-line ArrayDeclaration: equivalent — `dispatch` never changes, so `handleLogOut` is the same function either way
    [dispatch],
  );

  const connectionError =
    link.joinError ?? link.kickNotice ?? socketConnectionError;

  return {
    join: {
      team: link.team,
      needsJoinForm: needsJoinForm({
        teamName: link.teamName,
        activeJoinCode: link.activeJoinCode,
        hasView: Boolean(snapshot),
        connectionError,
        hasTeam: Boolean(link.team),
      }),
      connectionError,
      isReconnecting:
        link.joinError === null &&
        link.kickNotice === null &&
        connectionIssue === 'reconnecting',
      forceReconnect,
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
    },
    game: snapshot
      ? {
          ...teamGameFields(link, snapshot),
          seenQuestions,
          submitAnswer,
          ...actions,
        }
      : undefined,
  };
}

/** What the Team link state gives a joined phone to play with. */
function teamGameFields(
  link: TeamLinkState,
  snapshot: StateViewByRoom['players'],
) {
  return {
    view: viewWithSeat(snapshot, link.isLinked),
    myAnswers: link.myAnswers,
    myBonusAwards: link.myBonusAwards,
    myRoundRatings: link.myRoundRatings,
    myFeedback: link.myFeedback,
    mySessionRatings: link.mySessionRatings,
    myPlayerCount: link.myPlayerCount,
    roundRatingsEpoch: link.roundRatingsEpoch,
    myJoker: link.myJoker,
    mySideId: link.mySideId,
    myPurchases: link.myPurchases,
    roomReadyQuestionIds: link.roomReadyQuestionIds,
  } satisfies Partial<TeamLinkGame>;
}

function useClearTimersOnUnmount(
  confirmTimerRef: TimerRef,
  joinRetryTimerRef: TimerRef,
) {
  useEffect(
    () => () => {
      // Stryker disable next-line CallExpression: equivalent — unmounting already settles any waiting answer and its dispatch goes nowhere, so a timer left running changes nothing visible
      clearTimer(confirmTimerRef);
      clearTimer(joinRetryTimerRef);
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — an unmount cleanup; the refs are stable, so it never re-runs, same as none
    [confirmTimerRef, joinRetryTimerRef],
  );
}

/** Feeds the connection's comings and goings into the Team link. */
function useLinkFollowsConnection({
  identityKey,
  socketConnection,
  socketConnectionError,
  link,
  linkRef,
  dispatch,
  setSeenQuestions,
}: {
  identityKey: ReturnType<typeof useGameConnection>['identityKey'];
  socketConnection: ReturnType<typeof useGameConnection>['socketConnection'];
  socketConnectionError: string | null;
  link: TeamLinkState;
  linkRef: RefObject<TeamLinkState>;
  dispatch: (input: TeamLinkInput) => void;
  setSeenQuestions: (seen: SeenQuestions) => void;
}) {
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
  }, [identityKey, dispatch, linkRef]);

  // A range, not next-line, for the same reason as `dispatch`. Equivalent — `dispatch` never changes, so an emptied list still reads the stored identity once on mount.
  // Stryker disable ArrayDeclaration: see above
  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored identity can only
    // be read after mount.
    dispatch({ type: 'storageRead', stored: readStoredIdentity() });
  }, [dispatch]);
  // Stryker restore ArrayDeclaration

  const connectionCountRef = useRef({ count: 0, last: socketConnection });
  useEffect(() => {
    if (!socketConnection) {
      // Stryker disable next-line ConditionalExpression: equivalent — with no connection held, `disconnected` only restates null/false fields, and a new identity clears the rest
      if (linkRef.current.connection) dispatch({ type: 'disconnected' });
      return;
    }
    const counter = connectionCountRef.current;
    // Stryker disable next-line ConditionalExpression: equivalent — this effect only runs when `socketConnection` changes, so the two always differ here
    if (counter.last !== socketConnection) {
      // Stryker disable next-line AssignmentOperator: equivalent — connection ids are only compared for equality, so counting down tells connections apart just as well
      counter.count += 1;
      counter.last = socketConnection;
    }
    dispatch({
      type: 'connected',
      connectionId: counter.count,
      socketId: socketConnection.socketId,
    });
  }, [socketConnection, dispatch, linkRef]);

  useEffect(() => {
    // A refused connection (e.g. an unknown game code) never gets as far as a
    // join, so no join result will arrive to release the guard.
    if (socketConnectionError) dispatch({ type: 'connectionRefused' });
  }, [socketConnectionError, dispatch]);
}

/** The team's requests that wait for the server's verdict. */
function useTeamLinkActions(
  emitWithAck: EmitWithAck,
  dispatch: (input: TeamLinkInput) => void,
) {
  const rateRound = useCallback(
    async (roundId: number, stars: number) => {
      const payload: RateRoundPayload = { roundId, stars };
      const result = await emitWithAck(SOCKET_EVENTS.RATE_ROUND, payload);
      if (result.success) dispatch({ type: 'ratingSaved', roundId, stars });
      return result;
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` and `dispatch` never change, so `rateRound` is the same function either way
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
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` and `dispatch` never change, so `sendFeedback` is the same function either way
    [emitWithAck, dispatch],
  );

  const rateSession = useCallback(
    async (rating: RateSessionPayload) => {
      const result = await emitWithAck(SOCKET_EVENTS.RATE_SESSION, rating);
      if (result.success) dispatch({ type: 'sessionRatingSaved', rating });
      return result;
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` and `dispatch` never change, so `rateSession` is the same function either way
    [emitWithAck, dispatch],
  );

  const setPlayerCount = useCallback(
    async (playerCount: number) => {
      const payload: SetPlayerCountPayload = { playerCount };
      const result = await emitWithAck(SOCKET_EVENTS.SET_PLAYER_COUNT, payload);
      if (result.success) dispatch({ type: 'playerCountSaved', playerCount });
      return result;
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` and `dispatch` never change, so `setPlayerCount` is the same function either way
    [emitWithAck, dispatch],
  );

  const pickJoker = useCallback(
    async (roundId: number) => {
      const payload: PickJokerPayload = { roundId };
      const result = await emitWithAck(SOCKET_EVENTS.PICK_JOKER, payload);
      if (result.success) {
        dispatch({ type: 'jokerSaved', joker: { roundId, source: 'chosen' } });
      }
      return result;
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` and `dispatch` never change, so `pickJoker` is the same function either way
    [emitWithAck, dispatch],
  );

  const pickSide = useCallback(
    (sideId: string) =>
      emitWithAck(SOCKET_EVENTS.PICK_SIDE, {
        sideId,
      } satisfies PickSidePayload),
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` never changes, so the callback is the same function either way
    [emitWithAck],
  );

  /** Buys a power-up; the purchase and the coins left arrive as a sync, so nothing is dispatched here. */
  const buyPowerUp = useCallback(
    (powerUp: PowerUpId, questionId: number) =>
      emitWithAck(SOCKET_EVENTS.BUY_POWER_UP, { powerUp, questionId }),
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` never changes, so the callback is the same function either way
    [emitWithAck],
  );

  /** Buys an extra joker for a round; like `buyPowerUp`, the sync carries the result. */
  const buyExtraJoker = useCallback(
    (roundId: number) =>
      emitWithAck(SOCKET_EVENTS.BUY_POWER_UP, {
        powerUp: 'extra_joker',
        roundId,
      }),
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` never changes, so the callback is the same function either way
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
    // Stryker disable next-line ArrayDeclaration: equivalent — `emitWithAck` never changes, so `submitShowdownGuess` is the same function either way
    [emitWithAck],
  );

  return {
    rateRound,
    sendFeedback,
    rateSession,
    setPlayerCount,
    pickJoker,
    pickSide,
    buyPowerUp,
    buyExtraJoker,
    submitShowdownGuess,
  };
}
