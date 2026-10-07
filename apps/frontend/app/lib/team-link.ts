import { formatBonusAwardToast } from '@/app/lib/bonus-categories';
import { NOT_CONNECTED_MESSAGE } from '@/app/lib/connection-messages';
import { normalizeJoinCode } from '@/app/lib/team-storage';
import type {
  AckResult,
  AnswerReceivedPayload,
  GameStatus,
  JoinAcceptedPayload,
  JoinPlayersPayload,
  RoundRatingView,
  SubmitAnswerPayload,
  TeamAnswerView,
  TeamBonusAwardView,
  TeamFeedbackView,
  Verdict,
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

/** A team's own graded answer to one question — absent from the map entirely until grading happens (at submit when the answer is graded automatically, on admin grading otherwise). */
export interface MyAnswerGrade {
  pointsAwarded: number;
  gradedAt: string;
  /** How the answer was judged — the same verdict the quiz master sees. */
  verdict: Verdict | null;
}

const EMPTY_FEEDBACK: TeamFeedbackView = { comment: '', topics: [] };

function buildMyAnswers(answers: TeamAnswerView[]): Record<number, string> {
  return Object.fromEntries(
    answers.map((answer) => [answer.questionId, answer.value]),
  );
}

function toGrade(answer: {
  pointsAwarded: number;
  gradedAt: string;
  verdict: Verdict | null;
}): MyAnswerGrade {
  return {
    pointsAwarded: answer.pointsAwarded,
    gradedAt: answer.gradedAt,
    verdict: answer.verdict,
  };
}

function buildMyAnswerGrades(
  answers: TeamAnswerView[],
): Record<number, MyAnswerGrade> {
  return Object.fromEntries(
    answers.flatMap((answer) =>
      answer.gradedAt === null
        ? []
        : [
            [
              answer.questionId,
              toGrade({ ...answer, gradedAt: answer.gradedAt }),
            ],
          ],
    ),
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
  /** The team's own saved answers by question id. */
  myAnswers: Record<number, string>;
  myAnswerGrades: Record<number, MyAnswerGrade>;
  /** Every bonus award this team has received so far this session, in award order. */
  myBonusAwards: TeamBonusAwardView[];
  /** What the join carried plus every rating the server acknowledged since. */
  myRoundRatings: Record<number, number>;
  myFeedback: TeamFeedbackView;
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
  | { type: 'statusSeen'; status: GameStatus }
  | { type: 'kicked' }
  | { type: 'sessionClosed' }
  // A new socket identity: the previous team's data and pending answer go.
  | { type: 'identityChanged' }
  | { type: 'answerReceived'; payload: AnswerReceivedPayload }
  | { type: 'teamAnswersSynced'; answers: TeamAnswerView[] }
  | { type: 'bonusAwarded'; payload: TeamBonusAwardView }
  | { type: 'answerResult'; attempt: number; result: AckResult }
  | { type: 'answerTimedOut'; attempt: number }
  | { type: 'ratingSaved'; roundId: number; stars: number }
  | { type: 'feedbackSaved'; feedback: TeamFeedbackView }
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
  | { type: 'openConnection'; gameCode: string; attempt: number }
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

function withStoredIdentity(
  state: TeamLinkState,
  stored: StoredIdentity,
): TeamLinkState {
  const base: TeamLinkState = {
    ...state,
    hasStoredIdentity: Boolean(stored.teamToken),
    storedTeamToken: stored.teamToken,
    storedTeamCode: stored.teamCode,
  };
  if (!stored.teamName) return base;
  // The URL wins over what this phone stored: a fresh QR scan for a specific
  // game or team beats whatever last played on this device.
  return {
    ...base,
    teamName: stored.teamName,
    nameInput: state.nameInput || stored.teamName,
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
  myAnswerGrades: {},
  myBonusAwards: [],
  myRoundRatings: {},
  myFeedback: EMPTY_FEEDBACK,
  roundRatingsEpoch: 0,
  pendingAnswer: null,
} satisfies Partial<TeamLinkState>;

export function initialTeamLink(entry: TeamLinkEntry): TeamLinkState {
  const urlGameCode = entry.url.gameCode ?? '';
  const base: TeamLinkState = {
    urlGameCode,
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
    kickNotice: null,
    confirmedTeamId: null,
    lastStatus: null,
    ...EMPTY_TEAM_DATA,
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
  return {
    state: {
      ...state,
      teamName,
      activeJoinCode: gameCode,
      attempt,
      isJoinInFlight: true,
      joinError: null,
      kickNotice: null,
      // A fresh connection opens, so nothing carries over from the old one.
      connection: null,
      joinSentFor: null,
      linkedSocketId: null,
      lastStatus: null,
    },
    commands: [
      { type: 'writeIdentity', identity: { teamName, gameCode } },
      { type: 'openConnection', gameCode, attempt },
    ],
  };
}

/**
 * The one rule for leaving a session. Kick clears everything stored and shows
 * the notice; session close and logout keep the name and team code so the form
 * stays prefilled. All three release the join guard and clear the join error.
 */
function leaveSession(
  state: TeamLinkState,
  options: { clearAll: boolean; gameCode: string; kickNotice: string | null },
): TeamLinkState {
  const { clearAll, gameCode, kickNotice } = options;
  return {
    ...state,
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
    joinError: null,
    kickNotice,
    confirmedTeamId: null,
  };
}

function leaveSessionStep(
  state: TeamLinkState,
  options: {
    clearAll: boolean;
    gameCode: string;
    kickNotice: string | null;
    /** Logout stays on the page, whose URL already carries the game code to go back to. */
    shouldNavigate: boolean;
    leaveTeamId?: number | null;
  },
): TeamLinkStep {
  const commands: TeamLinkCommand[] = [];
  // The leave goes first, while the socket is still connected.
  if (options.leaveTeamId != null) {
    commands.push({ type: 'sendLeave', teamId: options.leaveTeamId });
  }
  commands.push({
    type: 'clearIdentity',
    scope: options.clearAll ? 'all' : 'session',
  });
  if (options.shouldNavigate) commands.push({ type: 'goToJoinScreen' });
  return { state: leaveSession(state, options), commands };
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

function step(state: TeamLinkState): TeamLinkStep {
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
  const answers = payload.answers ?? [];
  const accepted: TeamLinkState = {
    ...state,
    isJoinInFlight: false,
    joinError: null,
    confirmedTeamId: payload.teamId,
    linkedSocketId: state.connection?.socketId ?? null,
    storedTeamToken: payload.teamToken,
    storedTeamCode: payload.teamCode,
    teamCodeInput: payload.teamCode,
    team: payload,
    isLinked: true,
    myAnswers: buildMyAnswers(answers),
    myAnswerGrades: buildMyAnswerGrades(answers),
    myBonusAwards: payload.bonusAwards ?? [],
    myRoundRatings: buildMyRoundRatings(payload.roundRatings ?? []),
    myFeedback: payload.feedback ?? EMPTY_FEEDBACK,
    roundRatingsEpoch: state.roundRatingsEpoch + 1,
  };
  const storeIdentity: TeamLinkCommand = {
    type: 'writeIdentity',
    identity: { teamToken: payload.teamToken, teamCode: payload.teamCode },
  };
  const resend = accepted.pendingAnswer
    ? transmitAnswer(accepted, accepted.pendingAnswer)
    : step(accepted);
  return {
    state: resend.state,
    commands: [storeIdentity, ...resend.commands],
  };
}

function receiveAnswerResult(
  state: TeamLinkState,
  attempt: number,
  result: AckResult,
): TeamLinkStep {
  // A superseded send says nothing about the answer now pending.
  if (attempt !== state.answerAttempt) return step(state);
  // An answer that never left the socket stays pending for the rejoin; there
  // is no dead socket to force a reconnect on.
  if (!result.success && result.error === NOT_CONNECTED_MESSAGE) {
    return { state, commands: [CLEAR_TIMER] };
  }
  return {
    state: { ...state, pendingAnswer: null },
    commands: result.success
      ? [CLEAR_TIMER]
      : [CLEAR_TIMER, { type: 'toast', tone: 'error', message: result.error }],
  };
}

function receiveAnswer(
  state: TeamLinkState,
  payload: AnswerReceivedPayload,
): TeamLinkStep {
  const myAnswerGrades =
    payload.gradedAt === null
      ? state.myAnswerGrades
      : {
          ...state.myAnswerGrades,
          [payload.questionId]: toGrade({
            ...payload,
            gradedAt: payload.gradedAt,
          }),
        };
  return step({
    ...state,
    myAnswers: { ...state.myAnswers, [payload.questionId]: payload.value },
    myAnswerGrades,
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

export function teamLink(
  state: TeamLinkState,
  input: TeamLinkInput,
): TeamLinkStep {
  switch (input.type) {
    case 'storageRead':
      // A kick already cleared what this would restore.
      if (state.kickNotice) return step(state);
      return joinOncePerConnection(withStoredIdentity(state, input.stored));
    case 'connected': {
      const isNewConnection = state.connection?.id !== input.connectionId;
      const unlinked = isNewConnection ? unlink(state) : step(state);
      const join = joinOncePerConnection({
        ...unlinked.state,
        connection: { id: input.connectionId, socketId: input.socketId },
      });
      return {
        state: join.state,
        commands: [...unlinked.commands, ...join.commands],
      };
    }
    case 'disconnected':
      return unlink({ ...state, connection: null });
    case 'connectionRefused':
      return step({ ...state, isJoinInFlight: false });
    case 'joinAccepted':
      if (state.kickNotice) return step(state);
      return acceptJoin(state, input.payload);
    case 'identityChanged':
      return {
        state: { ...state, ...EMPTY_TEAM_DATA },
        commands: state.pendingAnswer ? [CLEAR_TIMER] : [],
      };
    case 'answerReceived':
      return receiveAnswer(state, input.payload);
    case 'teamAnswersSynced':
      return step({
        ...state,
        myAnswers: buildMyAnswers(input.answers),
        myAnswerGrades: buildMyAnswerGrades(input.answers),
      });
    case 'bonusAwarded':
      return awardBonus(state, input.payload);
    case 'answerResult':
      return receiveAnswerResult(state, input.attempt, input.result);
    case 'answerTimedOut':
      if (input.attempt !== state.answerAttempt) return step(state);
      return {
        state: { ...state, isLinked: false },
        commands: [{ type: 'forceReconnect' }],
      };
    case 'ratingSaved':
      return step({
        ...state,
        myRoundRatings: {
          ...state.myRoundRatings,
          [input.roundId]: input.stars,
        },
      });
    case 'feedbackSaved':
      return step({ ...state, myFeedback: input.feedback });
    case 'joinRefused':
      // An answer to a join on an earlier connection says nothing about this one.
      if (input.connectionId !== state.joinSentFor) return step(state);
      return step({
        ...state,
        isJoinInFlight: false,
        joinError: input.reason,
      });
    case 'statusSeen':
      return seeStatus(state, input.status);
    case 'kicked':
      return leaveSessionStep(state, {
        clearAll: true,
        gameCode: '',
        kickNotice: KICK_NOTICE,
        shouldNavigate: true,
      });
    case 'sessionClosed':
      return leaveSessionStep(state, {
        clearAll: false,
        gameCode: '',
        kickNotice: null,
        shouldNavigate: true,
      });
    case 'logoutRequested':
      return leaveSessionStep(state, {
        clearAll: false,
        gameCode: state.urlGameCode,
        kickNotice: null,
        shouldNavigate: false,
        leaveTeamId: state.confirmedTeamId,
      });
    case 'nameTyped':
      return step({ ...state, nameInput: input.value });
    case 'gameCodeTyped':
      return step({ ...state, codeInput: input.value });
    case 'teamCodeTyped':
      return step({ ...state, teamCodeInput: input.value });
    case 'joinSubmitted':
      return submitJoin(state);
    case 'answerSubmitted':
      return submitAnswer(state, {
        questionId: input.questionId,
        teamId: input.teamId,
        value: input.value,
      });
    default: {
      const unhandled: never = input;
      throw new Error(
        `Unhandled team link input: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
