import { formatBonusAwardToast } from '@/app/lib/bonus-categories';
import {
  NOT_CONNECTED_MESSAGE,
  isNotDelivered,
} from '@/app/lib/connection-messages';
import { normalizeJoinCode } from '@/app/lib/team-storage';
import {
  NOT_YOUR_TEAM_ANSWER_ERROR,
  isSeatTakenRefusal,
  type AckResult,
  type AnswerReceivedPayload,
  type GameStatus,
  type JoinAcceptedPayload,
  type JoinPlayersPayload,
  type CoinAwardedPayload,
  type PurchaseView,
  type RateSessionPayload,
  type RoundRatingView,
  type SubmitAnswerPayload,
  type TeamAnswerView,
  type TeamBonusAwardView,
  type TeamCoinsSyncedPayload,
  type TeamFeedbackView,
  type TeamJoker,
  type TeamPurchasesSyncedPayload,
  type TeamRoomReadySyncedPayload,
  type TeamSessionRatingsView,
  type Verdict,
} from '@campus-pubquiz/types';

/**
 * The Team link: a phone's link to its team in a live session. Plain
 * TypeScript — no React, no socket, no browser. Events (what the connection
 * and the server did) and intents (what the team did) go into `teamLink`; the
 * new state and the commands for the adapter to carry out come out.
 *
 * This module is the only place that decides to send a join.
 */

/** The notice a kicked team sees on the join screen. */
export const KICK_NOTICE = 'You were removed from this team by the quiz master';
/** Award toasts outlast the default so a team passing the phone around still sees them. */
export const BONUS_AWARD_TOAST_DURATION_MS = 8000;

/** A joker change toast stays long enough for the team to read which round it moved to. */
const JOKER_TOAST_MS = 6000;

/** How long a refused rejoin waits before asking again: the old socket holding the seat is gone once the server's ping timeout (~45 s) notices it. */
export const JOIN_RETRY_DELAY_MS = 3000;
/** Retries before a refused rejoin is shown as an error: together they outlast the ping timeout. */
export const MAX_JOIN_RETRIES = 20;

/** A team's own graded answer to one question — absent from the map entirely until grading happens (at submit when the answer is graded automatically, on admin grading otherwise). */
export interface MyAnswerGrade {
  pointsAwarded: number;
  gradedAt: string;
  /** How the answer was judged — the same verdict the quiz master sees. */
  verdict: Verdict | null;
}

const EMPTY_FEEDBACK: TeamFeedbackView = { comment: '', topics: [] };
const NO_SESSION_RATINGS: TeamSessionRatingsView = {
  pacing: null,
  feltDifficulty: null,
};

/** The clue a Clue question answer was locked in on and what it is worth there. */
export interface MyAnswerClue {
  clue: number;
  value: number;
}

/** A team's own answer to one question, as the server last said it. */
export interface MyAnswer {
  value: string;
  grade: MyAnswerGrade | null;
  clue: MyAnswerClue | null;
}

/** Builds the record from a `TeamAnswerView` or an `AnswerReceivedPayload`. */
function toMyAnswer(
  answer: Pick<
    TeamAnswerView,
    'value' | 'pointsAwarded' | 'gradedAt' | 'verdict' | 'clue' | 'clueValue'
  >,
): MyAnswer {
  const { value, pointsAwarded, gradedAt, verdict, clue, clueValue } = answer;
  return {
    value,
    grade: gradedAt === null ? null : { pointsAwarded, gradedAt, verdict },
    clue: clue && clueValue != null ? { clue, value: clueValue } : null,
  };
}

function buildMyAnswers(answers: TeamAnswerView[]): Record<number, MyAnswer> {
  return Object.fromEntries(
    answers.map((answer) => [answer.questionId, toMyAnswer(answer)]),
  );
}

function buildMyRoundRatings(
  ratings: RoundRatingView[],
): Record<number, number> {
  return Object.fromEntries(
    ratings.map((rating) => [rating.roundId, rating.stars]),
  );
}

/** What the phone remembered from an earlier visit (read from localStorage by the adapter). */
export interface StoredIdentity {
  teamName?: string | null;
  teamToken?: string;
  teamCode?: string;
  gameCode?: string;
}

/** What the phone arrived with: the URL's values and what it stored. */
export interface TeamLinkEntry {
  url: { gameCode?: string; teamCode?: string; name?: string };
  stored?: StoredIdentity;
}

export interface TeamLinkConnection {
  /** Counts connections, so a reconnect is told apart from the connection before it. */
  id: number;
  socketId: string | null;
}

export interface TeamLinkState {
  urlGameCode: string;
  urlTeamCode: string;
  urlName: string;
  teamName: string | null;
  nameInput: string;
  codeInput: string;
  teamCodeInput: string;
  /** The game code the connection is opened for, or null when none is known. */
  activeJoinCode: string | null;
  /** Bumped on every join submit so a fresh connection opens even for an unchanged code. */
  attempt: number;
  hasStoredIdentity: boolean;
  storedTeamToken: string | undefined;
  storedTeamCode: string | undefined;
  /** The live connection, or null while disconnected or while a fresh one opens. */
  connection: TeamLinkConnection | null;
  /** The connection a join was last sent on. */
  joinSentFor: number | null;
  isJoinInFlight: boolean;
  /** The socket id the server last registered this team on. */
  linkedSocketId: string | null;
  joinError: string | null;
  /** How many times in a row a refused rejoin has been retried on this connection. */
  joinRetries: number;
  /** Set while the team has been kicked and hasn't joined again. */
  kickNotice: string | null;
  /** The team the server last confirmed for this phone, or null when there is none. */
  confirmedTeamId: number | null;
  /** The last status seen on this connection, or null before the first. */
  lastStatus: GameStatus | null;
  /** What the server last said this team is (the last join accepted). */
  team: JoinAcceptedPayload | null;
  /** True while the server has this connection registered as the team's — false while disconnected or mid-rejoin, when answers can't be accepted. */
  isLinked: boolean;
  /** The team's own saved answers by question id: the server's last word on each. */
  myAnswers: Record<number, MyAnswer>;
  /** Every bonus award this team has received so far this session, in award order. */
  myBonusAwards: TeamBonusAwardView[];
  /** What the join carried plus every rating the server acknowledged since. */
  myRoundRatings: Record<number, number>;
  myFeedback: TeamFeedbackView;
  /** The team's pacing and felt-difficulty answers: what the join carried plus every answer the server acknowledged since. */
  mySessionRatings: TeamSessionRatingsView;
  /** How many players the server holds for this team, or null until one is reported. */
  myPlayerCount: number | null;
  /** The team's own joker as the server last said it (the join, a sync, or an acknowledged pick), or null while it has none. */
  myJoker: TeamJoker | null;
  /** The id of the team's own Versus side as the server last said it (the join, or a sync after a pick), or null while it has none. */
  mySideId: string | null;
  /** The team's own power-up purchases as the server last said them (the join, or a sync after a purchase); a 50/50's removed options stay hidden through them. */
  myPurchases: PurchaseView[];
  /** The questions on which the server says this team's Ask the room is ready (the join, then a sync as other teams answer). A flag only, never a count. */
  roomReadyQuestionIds: number[];
  /** Counts join payloads: when it changes, `myRoundRatings` was replaced wholesale. */
  roundRatingsEpoch: number;
  /** The latest answer the server hasn't acknowledged — resent after a rejoin. */
  pendingAnswer: SubmitAnswerPayload | null;
  /** Identifies the latest send, so a result for a superseded send is ignored. */
  answerAttempt: number;
}

export type TeamLinkInput =
  // Events
  | { type: 'storageRead'; stored: StoredIdentity }
  | { type: 'connected'; connectionId: number; socketId: string | null }
  | { type: 'disconnected' }
  | { type: 'connectionRefused' }
  | { type: 'joinAccepted'; payload: JoinAcceptedPayload }
  | { type: 'joinRefused'; connectionId: number; reason: string }
  // A refused rejoin's wait is over.
  | { type: 'joinRetryDue'; connectionId: number }
  | { type: 'statusSeen'; status: GameStatus }
  | { type: 'kicked' }
  | { type: 'sessionClosed' }
  // A new socket identity: the previous team's data and pending answer go.
  | { type: 'identityChanged' }
  | { type: 'answerReceived'; payload: AnswerReceivedPayload }
  | { type: 'teamAnswersSynced'; answers: TeamAnswerView[] }
  | { type: 'bonusAwarded'; payload: TeamBonusAwardView }
  // The quiz master gave (or took) coins: a toast and the new balance.
  | { type: 'coinAwarded'; payload: CoinAwardedPayload }
  // The team's coins changed without a new award (a bonus award went, the quiz left the lobby, the lobby settings changed).
  | { type: 'coinsSynced'; payload: TeamCoinsSyncedPayload }
  | { type: 'bonusAwardsSynced'; bonusAwards: TeamBonusAwardView[] }
  | { type: 'answerResult'; attempt: number; result: AckResult }
  // The answer never left the socket (not connected, or no acknowledgement in time).
  | { type: 'answerNotDelivered'; attempt: number }
  | { type: 'answerTimedOut'; attempt: number }
  | { type: 'ratingSaved'; roundId: number; stars: number }
  | { type: 'feedbackSaved'; feedback: TeamFeedbackView }
  | { type: 'sessionRatingSaved'; rating: RateSessionPayload }
  // The server told the team's phones its count changed.
  | { type: 'playerCountSynced'; playerCount: number }
  // The server acknowledged a count this phone sent.
  | { type: 'playerCountSaved'; playerCount: number }
  // The server told the team's phones its joker changed.
  | { type: 'jokerSynced'; joker: TeamJoker | null }
  // The server acknowledged a joker pick this phone sent.
  | { type: 'jokerSaved'; joker: TeamJoker }
  // The server told the team's phones its side changed (a pick, or Versus turned off).
  | { type: 'sideSynced'; sideId: string | null }
  // The server told the team's phones its purchases and coins after a purchase.
  | { type: 'purchasesSynced'; payload: TeamPurchasesSyncedPayload }
  // The server said whether Ask the room is ready on a question, after another team's answer.
  | { type: 'roomReadySynced'; payload: TeamRoomReadySyncedPayload }
  // Intents
  | { type: 'nameTyped'; value: string }
  | { type: 'gameCodeTyped'; value: string }
  | { type: 'teamCodeTyped'; value: string }
  | { type: 'joinSubmitted' }
  | { type: 'logoutRequested' }
  | {
      type: 'answerSubmitted';
      questionId: number;
      teamId: number;
      value: string;
    };

export type TeamLinkCommand =
  | { type: 'sendJoin'; payload: JoinPlayersPayload; connectionId: number }
  | {
      type: 'writeIdentity';
      identity: Pick<
        StoredIdentity,
        'teamName' | 'gameCode' | 'teamToken' | 'teamCode'
      >;
    }
  | { type: 'clearIdentity'; scope: 'session' | 'all' }
  | { type: 'sendLeave'; teamId: number }
  | { type: 'goToJoinScreen' }
  | { type: 'sendAnswer'; payload: SubmitAnswerPayload; attempt: number }
  | { type: 'armConfirmTimer'; attempt: number }
  | { type: 'clearConfirmTimer' }
  | { type: 'forceReconnect' }
  | { type: 'scheduleJoinRetry'; connectionId: number; delayMs: number }
  | {
      type: 'toast';
      tone: 'success' | 'neutral' | 'error';
      message: string;
      durationMs?: number;
    };

export interface TeamLinkStep {
  state: TeamLinkState;
  commands: TeamLinkCommand[];
}

/** The stored token belongs to the stored team in the stored game: a URL naming another one can't use it. */
function isStoredTokenForUrl(
  state: TeamLinkState,
  stored: StoredIdentity,
): boolean {
  const isSame = (url: string, storedValue: string | null | undefined) =>
    !url || !storedValue || url === storedValue;
  return (
    isSame(state.urlName, stored.teamName) &&
    isSame(state.urlTeamCode, stored.teamCode) &&
    isSame(
      normalizeJoinCode(state.urlGameCode),
      stored.gameCode && normalizeJoinCode(stored.gameCode),
    )
  );
}

function withStoredIdentity(
  state: TeamLinkState,
  stored: StoredIdentity,
): TeamLinkState {
  const base: TeamLinkState = {
    ...state,
    hasStoredIdentity: Boolean(stored.teamToken),
    storedTeamToken: isStoredTokenForUrl(state, stored)
      ? stored.teamToken
      : undefined,
    storedTeamCode: stored.teamCode,
  };
  return stored.teamName ? withStoredTeam(base, stored, stored.teamName) : base;
}

/** The URL wins over what this phone stored: a fresh QR scan for a specific game or team beats whatever last played on this device. */
function withStoredTeam(
  state: TeamLinkState,
  stored: StoredIdentity,
  storedName: string,
): TeamLinkState {
  return {
    ...state,
    teamName: state.urlName || storedName,
    nameInput: state.nameInput || storedName,
    codeInput: state.urlGameCode || stored.gameCode || state.codeInput,
    activeJoinCode: state.activeJoinCode ?? stored.gameCode ?? null,
    teamCodeInput: state.teamCodeInput || stored.teamCode || '',
  };
}

/** What a phone knows about its team before any join answers. */
const EMPTY_TEAM_DATA = {
  team: null,
  isLinked: false,
  myAnswers: {},
  myBonusAwards: [],
  myRoundRatings: {},
  myFeedback: EMPTY_FEEDBACK,
  mySessionRatings: NO_SESSION_RATINGS,
  myPlayerCount: null,
  myJoker: null,
  mySideId: null,
  myPurchases: [],
  roomReadyQuestionIds: [],
  pendingAnswer: null,
} satisfies Partial<TeamLinkState>;

/** Forgets the team's data. The epoch only ever counts up, so the clear itself changes it and a later join can't land back on a value already used. */
function clearTeamData(state: TeamLinkState): TeamLinkState {
  return {
    ...state,
    ...EMPTY_TEAM_DATA,
    roundRatingsEpoch: state.roundRatingsEpoch + 1,
    // A result or timeout for a send made before the clear says nothing now.
    answerAttempt: state.answerAttempt + 1,
  };
}

export function initialTeamLink(entry: TeamLinkEntry): TeamLinkState {
  const urlGameCode = entry.url.gameCode ?? '';
  const base: TeamLinkState = {
    urlGameCode,
    urlTeamCode: entry.url.teamCode ?? '',
    urlName: entry.url.name ?? '',
    teamName: null,
    nameInput: entry.url.name ?? '',
    codeInput: urlGameCode,
    teamCodeInput: entry.url.teamCode ?? '',
    activeJoinCode: urlGameCode || null,
    attempt: 0,
    hasStoredIdentity: false,
    storedTeamToken: undefined,
    storedTeamCode: undefined,
    connection: null,
    joinSentFor: null,
    isJoinInFlight: false,
    linkedSocketId: null,
    joinError: null,
    joinRetries: 0,
    kickNotice: null,
    confirmedTeamId: null,
    lastStatus: null,
    ...EMPTY_TEAM_DATA,
    roundRatingsEpoch: 0,
    answerAttempt: 0,
  };
  return entry.stored ? withStoredIdentity(base, entry.stored) : base;
}

/** Only a different earlier socket is worth naming — a rejoin on the same socket needs no handover. */
function handoverSocketId(state: TeamLinkState): string | undefined {
  const current = state.connection?.socketId ?? null;
  if (!state.linkedSocketId || state.linkedSocketId === current) {
    return undefined;
  }
  return state.linkedSocketId;
}

/** The one join sender: every join, whatever triggered it, goes through here. */
function sendJoin(state: TeamLinkState): TeamLinkStep {
  const { connection, teamName, activeJoinCode } = state;
  if (!connection || !teamName || !activeJoinCode) {
    return { state, commands: [] };
  }
  const payload: JoinPlayersPayload = {
    teamName,
    teamToken: state.storedTeamToken,
    teamCode: state.teamCodeInput.trim() || state.storedTeamCode,
    joinCode: activeJoinCode,
    previousSocketId: handoverSocketId(state),
  };
  return {
    state: { ...state, isJoinInFlight: true, joinSentFor: connection.id },
    commands: [{ type: 'sendJoin', payload, connectionId: connection.id }],
  };
}

/** Whether the phone already proved who it is (it was linked, or holds a token), so a seat-taken refusal can only be an old socket of its own. */
function isKnownTeam(state: TeamLinkState): boolean {
  return state.team !== null || Boolean(state.storedTeamToken);
}

/** A refusal of the join sent on the current connection: a rejoin refused only because an old socket still holds the seat is retried quietly; anything else is shown. */
function refuseJoin(
  state: TeamLinkState,
  connectionId: number,
  reason: string,
): TeamLinkStep {
  const isRetryable =
    isKnownTeam(state) &&
    (isSeatTakenRefusal(reason) ||
      isNotDelivered({ success: false, error: reason })) &&
    state.joinRetries < MAX_JOIN_RETRIES;
  if (!isRetryable) {
    return unchanged({ ...state, isJoinInFlight: false, joinError: reason });
  }
  return {
    state: {
      ...state,
      isJoinInFlight: false,
      joinRetries: state.joinRetries + 1,
    },
    commands: [
      { type: 'scheduleJoinRetry', connectionId, delayMs: JOIN_RETRY_DELAY_MS },
    ],
  };
}

function retryJoin(state: TeamLinkState, connectionId: number): TeamLinkStep {
  const isStillWaiting =
    state.connection?.id === connectionId &&
    !state.isLinked &&
    !state.isJoinInFlight;
  return isStillWaiting ? sendJoin(state) : unchanged(state);
}

function joinOncePerConnection(state: TeamLinkState): TeamLinkStep {
  if (!state.connection || state.joinSentFor === state.connection.id) {
    return { state, commands: [] };
  }
  return sendJoin(state);
}

function submitJoin(state: TeamLinkState): TeamLinkStep {
  if (state.isJoinInFlight) return { state, commands: [] };
  const teamName = state.nameInput.trim();
  const gameCode = normalizeJoinCode(state.codeInput);
  if (!teamName || !gameCode) return { state, commands: [] };
  const attempt = state.attempt + 1;
  // The stored token belongs to the stored team: sent with another name, the server would let it win and seat the phone as the old team.
  const isSameTeam =
    state.teamName?.trim().toLowerCase() === teamName.toLowerCase();
  return {
    state: {
      ...state,
      teamName,
      storedTeamToken: isSameTeam ? state.storedTeamToken : undefined,
      activeJoinCode: gameCode,
      attempt,
      isJoinInFlight: true,
      joinError: null,
      joinRetries: 0,
      kickNotice: null,
      // A fresh connection opens, so nothing carries over from the old one.
      connection: null,
      joinSentFor: null,
      linkedSocketId: null,
      lastStatus: null,
    },
    commands: [{ type: 'writeIdentity', identity: { teamName, gameCode } }],
  };
}

/** The ways a team's link to its session ends. */
type LeaveKind = 'kicked' | 'sessionClosed' | 'loggedOut';

interface LeaveRule {
  /** Kick clears the stored name and team code too; the others keep them so the form stays prefilled. */
  clearAll: boolean;
  kickNotice: string | null;
  /** Logout stays on the page, whose URL already carries the game code to go back to. */
  shouldNavigate: boolean;
}

const LEAVE_RULES: Record<LeaveKind, LeaveRule> = {
  kicked: { clearAll: true, kickNotice: KICK_NOTICE, shouldNavigate: true },
  sessionClosed: { clearAll: false, kickNotice: null, shouldNavigate: true },
  loggedOut: { clearAll: false, kickNotice: null, shouldNavigate: false },
};

/**
 * The one rule for leaving a session. All three kinds release the join guard,
 * clear the join error and forget the team, its link and its pending answer.
 */
function leaveSession(state: TeamLinkState, kind: LeaveKind): TeamLinkStep {
  const { clearAll, kickNotice } = LEAVE_RULES[kind];
  const gameCode = kind === 'loggedOut' ? state.urlGameCode : '';
  return {
    state: {
      ...clearTeamData(state),
      teamName: null,
      codeInput: gameCode,
      activeJoinCode: gameCode || null,
      hasStoredIdentity: false,
      storedTeamToken: undefined,
      storedTeamCode: clearAll ? undefined : state.storedTeamCode,
      nameInput: clearAll ? '' : state.nameInput,
      teamCodeInput: clearAll ? '' : state.teamCodeInput,
      isJoinInFlight: false,
      // An answer to a join sent before leaving says nothing about what follows.
      joinSentFor: null,
      linkedSocketId: null,
      lastStatus: null,
      joinError: null,
      joinRetries: 0,
      kickNotice,
      confirmedTeamId: null,
    },
    commands: leaveCommands(state, kind),
  };
}

function leaveCommands(
  state: TeamLinkState,
  kind: LeaveKind,
): TeamLinkCommand[] {
  const { clearAll, shouldNavigate } = LEAVE_RULES[kind];
  const commands: TeamLinkCommand[] = [];
  // The leave goes first, while the socket is still connected.
  if (kind === 'loggedOut' && state.confirmedTeamId != null) {
    commands.push({ type: 'sendLeave', teamId: state.confirmedTeamId });
  }
  if (state.pendingAnswer) commands.push(CLEAR_TIMER);
  commands.push({ type: 'clearIdentity', scope: clearAll ? 'all' : 'session' });
  if (shouldNavigate) commands.push({ type: 'goToJoinScreen' });
  return commands;
}

/** A status moving into the lobby from another one on the same connection is a session restart. */
function seeStatus(state: TeamLinkState, status: GameStatus): TeamLinkStep {
  const isRestart =
    status === 'lobby' &&
    state.lastStatus !== null &&
    state.lastStatus !== 'lobby';
  const next = { ...state, lastStatus: status };
  if (!isRestart || state.isJoinInFlight) return { state: next, commands: [] };
  return sendJoin(next);
}

function unchanged(state: TeamLinkState): TeamLinkStep {
  return { state, commands: [] };
}

const CLEAR_TIMER: TeamLinkCommand = { type: 'clearConfirmTimer' };

/** The connection went away: nothing is registered on it, and an unacknowledged answer waits for the rejoin. */
function unlink(state: TeamLinkState): TeamLinkStep {
  return {
    state: { ...state, isLinked: false },
    commands: state.pendingAnswer ? [CLEAR_TIMER] : [],
  };
}

function transmitAnswer(
  state: TeamLinkState,
  payload: SubmitAnswerPayload,
): TeamLinkStep {
  const attempt = state.answerAttempt + 1;
  return {
    state: { ...state, pendingAnswer: payload, answerAttempt: attempt },
    commands: [
      CLEAR_TIMER,
      { type: 'sendAnswer', payload, attempt },
      { type: 'armConfirmTimer', attempt },
    ],
  };
}

function submitAnswer(
  state: TeamLinkState,
  payload: SubmitAnswerPayload,
): TeamLinkStep {
  if (state.isLinked) return transmitAnswer(state, payload);
  return {
    state,
    commands: [
      { type: 'toast', tone: 'error', message: NOT_CONNECTED_MESSAGE },
    ],
  };
}

function acceptJoin(
  state: TeamLinkState,
  payload: JoinAcceptedPayload,
): TeamLinkStep {
  const accepted: TeamLinkState = {
    ...state,
    isJoinInFlight: false,
    joinError: null,
    joinRetries: 0,
    confirmedTeamId: payload.teamId,
    // The server decides who the phone is (a stored token can name another team than the one typed).
    teamName: payload.teamName,
    linkedSocketId: state.connection?.socketId ?? null,
    storedTeamToken: payload.teamToken,
    storedTeamCode: payload.teamCode,
    teamCodeInput: payload.teamCode,
    team: payload,
    isLinked: true,
    ...teamDataFromJoin(payload),
    roundRatingsEpoch: state.roundRatingsEpoch + 1,
  };
  const storeIdentity: TeamLinkCommand = {
    type: 'writeIdentity',
    identity: {
      teamName: payload.teamName,
      teamToken: payload.teamToken,
      teamCode: payload.teamCode,
    },
  };
  const resend = accepted.pendingAnswer
    ? transmitAnswer(accepted, accepted.pendingAnswer)
    : unchanged(accepted);
  return {
    state: resend.state,
    commands: [storeIdentity, ...resend.commands],
  };
}

/** What the accepted join tells the phone about its team's answers, awards and choices so far. */
function teamDataFromJoin(payload: JoinAcceptedPayload) {
  const answers = payload.answers ?? [];
  return {
    myAnswers: buildMyAnswers(answers),
    myBonusAwards: payload.bonusAwards ?? [],
    myRoundRatings: buildMyRoundRatings(payload.roundRatings ?? []),
    myFeedback: payload.feedback ?? EMPTY_FEEDBACK,
    mySessionRatings: payload.sessionRatings ?? NO_SESSION_RATINGS,
    myPlayerCount: payload.playerCount ?? null,
    myJoker: payload.joker ?? null,
    mySideId: payload.sideId ?? null,
    myPurchases: payload.purchases,
    roomReadyQuestionIds: payload.roomReadyQuestionIds,
  } satisfies Partial<TeamLinkState>;
}

function isSeatLostRefusal(result: AckResult): boolean {
  return !result.success && result.error === NOT_YOUR_TEAM_ANSWER_ERROR;
}

/**
 * The server says this socket doesn't hold the team's seat, though the phone
 * thought it did. The phone stops offering answers and joins again by itself;
 * the answer stays pending and goes out once the join is accepted.
 */
function rejoinAfterLostSeat(state: TeamLinkState): TeamLinkStep {
  const unlinked: TeamLinkState = { ...state, isLinked: false };
  const rejoin = state.isJoinInFlight
    ? unchanged(unlinked)
    : sendJoin(unlinked);
  return { state: rejoin.state, commands: [CLEAR_TIMER, ...rejoin.commands] };
}

function receiveAnswerResult(
  state: TeamLinkState,
  attempt: number,
  result: AckResult,
): TeamLinkStep {
  // A superseded send says nothing about the answer now pending.
  if (attempt !== state.answerAttempt) return unchanged(state);
  if (isSeatLostRefusal(result)) return rejoinAfterLostSeat(state);
  return {
    state: { ...state, pendingAnswer: null },
    commands: result.success
      ? [CLEAR_TIMER]
      : [CLEAR_TIMER, { type: 'toast', tone: 'error', message: result.error }],
  };
}

/** An answer that never left the socket stays pending for the rejoin; there is no dead socket to force a reconnect on. */
function keepAnswerPending(
  state: TeamLinkState,
  attempt: number,
): TeamLinkStep {
  if (attempt !== state.answerAttempt) return unchanged(state);
  return { state, commands: [CLEAR_TIMER] };
}

function receiveAnswer(
  state: TeamLinkState,
  payload: AnswerReceivedPayload,
): TeamLinkStep {
  return unchanged({
    ...state,
    myAnswers: {
      ...state.myAnswers,
      [payload.questionId]: toMyAnswer(payload),
    },
  });
}

function awardBonus(
  state: TeamLinkState,
  award: TeamBonusAwardView,
): TeamLinkStep {
  const message = formatBonusAwardToast(award);
  const toast: TeamLinkCommand =
    award.points > 0
      ? {
          type: 'toast',
          tone: 'success',
          message: `🎉 ${message}`,
          durationMs: BONUS_AWARD_TOAST_DURATION_MS,
        }
      : {
          type: 'toast',
          tone: 'neutral',
          message,
          durationMs: BONUS_AWARD_TOAST_DURATION_MS,
        };
  return {
    state: { ...state, myBonusAwards: [...state.myBonusAwards, award] },
    commands: [toast],
  };
}

/** The state with the team's coin balance replaced (the balance rides on the joined team). */
function withCoins(state: TeamLinkState, balance: number): TeamLinkState {
  return state.team
    ? { ...state, team: { ...state.team, coins: balance } }
    : state;
}

function awardCoins(
  state: TeamLinkState,
  { coins, reason, balance }: CoinAwardedPayload,
): TeamLinkStep {
  const amount = `${coins > 0 ? '+' : ''}${coins} ${Math.abs(coins) === 1 ? 'coin' : 'coins'}`;
  const message = reason ? `${amount}: ${reason}` : amount;
  return {
    state: withCoins(state, balance),
    commands: [
      {
        type: 'toast',
        tone: coins > 0 ? 'success' : 'neutral',
        message: coins > 0 ? `🪙 ${message}` : message,
        durationMs: BONUS_AWARD_TOAST_DURATION_MS,
      },
    ],
  };
}

/**
 * The server told the team's phones its joker. A joker the team did not pick
 * itself (the quiz master's change, a draw) that differs from the one held is
 * announced once; the team's own pick, and a joker already held (the pick
 * closing re-sends every joker), change the joker line quietly.
 */
function syncJoker(
  state: TeamLinkState,
  joker: TeamJoker | null,
): TeamLinkStep {
  const next = { ...state, myJoker: joker };
  const isChange =
    joker !== null &&
    (joker.roundId !== state.myJoker?.roundId ||
      // Stryker disable next-line OptionalChaining: equivalent — roundId is always a number, so with no held joker the first comparison is already true and this one is never reached
      joker.source !== state.myJoker?.source);
  if (!isChange || joker.source === 'chosen') return unchanged(next);
  const message =
    joker.source === 'drawn'
      ? 'A joker was drawn for your team'
      : 'Your joker was changed by the quiz master';
  return {
    state: next,
    commands: [
      { type: 'toast', tone: 'neutral', message, durationMs: JOKER_TOAST_MS },
    ],
  };
}

export function teamLink(
  state: TeamLinkState,
  input: TeamLinkInput,
): TeamLinkStep {
  const handle = INPUT_HANDLERS[input.type] as
    | ((state: TeamLinkState, input: TeamLinkInput) => TeamLinkStep)
    | undefined;
  if (!handle) {
    throw new Error(`Unhandled team link input: ${JSON.stringify(input)}`);
  }
  return handle(state, input);
}

type InputOf<Type extends TeamLinkInput['type']> = Extract<
  TeamLinkInput,
  { type: Type }
>;

function readStorage(
  state: TeamLinkState,
  input: InputOf<'storageRead'>,
): TeamLinkStep {
  // A kick already cleared what this would restore.
  if (state.kickNotice) return unchanged(state);
  return joinOncePerConnection(withStoredIdentity(state, input.stored));
}

function receiveJoinAccepted(
  state: TeamLinkState,
  input: InputOf<'joinAccepted'>,
): TeamLinkStep {
  if (state.kickNotice) return unchanged(state);
  return acceptJoin(state, input.payload);
}

function changeIdentity(state: TeamLinkState): TeamLinkStep {
  return {
    state: clearTeamData(state),
    commands: state.pendingAnswer ? [CLEAR_TIMER] : [],
  };
}

function timeOutAnswer(
  state: TeamLinkState,
  input: InputOf<'answerTimedOut'>,
): TeamLinkStep {
  if (input.attempt !== state.answerAttempt) return unchanged(state);
  return {
    state: { ...state, isLinked: false },
    commands: [{ type: 'forceReconnect' }],
  };
}

function receiveJoinRefused(
  state: TeamLinkState,
  input: InputOf<'joinRefused'>,
): TeamLinkStep {
  // An answer to a join on an earlier connection says nothing about this one.
  if (input.connectionId !== state.joinSentFor) return unchanged(state);
  return refuseJoin(state, input.connectionId, input.reason);
}

/** A (re)connected socket: a new connection unlinks the old one and joins once. */
function connect(
  state: TeamLinkState,
  input: Extract<TeamLinkInput, { type: 'connected' }>,
): TeamLinkStep {
  const isNewConnection = state.connection?.id !== input.connectionId;
  const unlinked = isNewConnection ? unlink(state) : unchanged(state);
  const join = joinOncePerConnection({
    ...unlinked.state,
    joinRetries: isNewConnection ? 0 : unlinked.state.joinRetries,
    // The first status on a new connection is a first status again.
    lastStatus: isNewConnection ? null : unlinked.state.lastStatus,
    connection: { id: input.connectionId, socketId: input.socketId },
  });
  return {
    state: join.state,
    commands: [...unlinked.commands, ...join.commands],
  };
}

function syncCoins(
  state: TeamLinkState,
  input: InputOf<'coinsSynced'>,
): TeamLinkStep {
  return unchanged(
    state.team
      ? {
          ...state,
          team: {
            ...state.team,
            coins: input.payload.balance,
            hasCarriedCoin: input.payload.hasCarriedCoin,
          },
        }
      : state,
  );
}

function syncPurchases(
  state: TeamLinkState,
  input: InputOf<'purchasesSynced'>,
): TeamLinkStep {
  return unchanged({
    ...state,
    myPurchases: input.payload.purchases,
    team: state.team && { ...state.team, coins: input.payload.coins },
  });
}

function syncRoomReady(
  state: TeamLinkState,
  input: InputOf<'roomReadySynced'>,
): TeamLinkStep {
  const { questionId, isReady } = input.payload;
  const others = state.roomReadyQuestionIds.filter((id) => id !== questionId);
  return unchanged({
    ...state,
    roomReadyQuestionIds: isReady ? [...others, questionId] : others,
  });
}

/** Each input's handler. Events (what the connection and the server did) and intents (what the team did); the plain record-keeping ones inline. */
const INPUT_HANDLERS: {
  [Type in TeamLinkInput['type']]: (
    state: TeamLinkState,
    input: InputOf<Type>,
  ) => TeamLinkStep;
} = {
  connected: connect,
  storageRead: readStorage,
  disconnected: (state) =>
    unlink({ ...state, connection: null, lastStatus: null }),
  connectionRefused: (state) => unchanged({ ...state, isJoinInFlight: false }),
  joinAccepted: receiveJoinAccepted,
  identityChanged: changeIdentity,
  answerReceived: (state, input) => receiveAnswer(state, input.payload),
  bonusAwarded: (state, input) => awardBonus(state, input.payload),
  coinAwarded: (state, input) => awardCoins(state, input.payload),
  answerResult: (state, input) =>
    receiveAnswerResult(state, input.attempt, input.result),
  answerNotDelivered: (state, input) => keepAnswerPending(state, input.attempt),
  answerTimedOut: timeOutAnswer,
  jokerSynced: (state, input) => syncJoker(state, input.joker),
  joinRefused: receiveJoinRefused,
  joinRetryDue: (state, input) => retryJoin(state, input.connectionId),
  statusSeen: (state, input) => seeStatus(state, input.status),
  kicked: (state) => leaveSession(state, 'kicked'),
  sessionClosed: (state) => leaveSession(state, 'sessionClosed'),
  logoutRequested: (state) => leaveSession(state, 'loggedOut'),
  joinSubmitted: (state) => submitJoin(state),
  answerSubmitted: (state, input) =>
    submitAnswer(state, {
      questionId: input.questionId,
      teamId: input.teamId,
      value: input.value,
    }),
  teamAnswersSynced: (state, input) =>
    unchanged({
      ...state,
      myAnswers: buildMyAnswers(input.answers),
    }),
  bonusAwardsSynced: (state, input) =>
    unchanged({ ...state, myBonusAwards: input.bonusAwards }),
  coinsSynced: syncCoins,
  ratingSaved: (state, input) =>
    unchanged({
      ...state,
      myRoundRatings: { ...state.myRoundRatings, [input.roundId]: input.stars },
    }),
  feedbackSaved: (state, input) =>
    unchanged({ ...state, myFeedback: input.feedback }),
  sessionRatingSaved: (state, input) =>
    unchanged({
      ...state,
      mySessionRatings: {
        ...state.mySessionRatings,
        [input.rating.scale]: input.rating.value,
      },
    }),
  playerCountSynced: (state, input) =>
    unchanged({ ...state, myPlayerCount: input.playerCount }),
  playerCountSaved: (state, input) =>
    unchanged({ ...state, myPlayerCount: input.playerCount }),
  jokerSaved: (state, input) => unchanged({ ...state, myJoker: input.joker }),
  sideSynced: (state, input) => unchanged({ ...state, mySideId: input.sideId }),
  purchasesSynced: syncPurchases,
  roomReadySynced: syncRoomReady,
  nameTyped: (state, input) => unchanged({ ...state, nameInput: input.value }),
  gameCodeTyped: (state, input) =>
    unchanged({ ...state, codeInput: input.value }),
  teamCodeTyped: (state, input) =>
    unchanged({ ...state, teamCodeInput: input.value }),
};
