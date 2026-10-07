import { normalizeJoinCode } from '@/app/lib/team-storage';
import type {
  GameStatus,
  JoinAcceptedPayload,
  JoinPlayersPayload,
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
  // Intents
  | { type: 'nameTyped'; value: string }
  | { type: 'gameCodeTyped'; value: string }
  | { type: 'teamCodeTyped'; value: string }
  | { type: 'joinSubmitted' }
  | { type: 'logoutRequested' };

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
  | { type: 'goToJoinScreen' };

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

export function teamLink(
  state: TeamLinkState,
  input: TeamLinkInput,
): TeamLinkStep {
  switch (input.type) {
    case 'storageRead':
      // A kick already cleared what this would restore.
      if (state.kickNotice) return step(state);
      return joinOncePerConnection(withStoredIdentity(state, input.stored));
    case 'connected':
      return joinOncePerConnection({
        ...state,
        connection: { id: input.connectionId, socketId: input.socketId },
      });
    case 'disconnected':
      return step({ ...state, connection: null });
    case 'connectionRefused':
      return step({ ...state, isJoinInFlight: false });
    case 'joinAccepted':
      if (state.kickNotice) return step(state);
      return {
        state: {
          ...state,
          confirmedTeamId: input.payload.teamId,
          isJoinInFlight: false,
          joinError: null,
          linkedSocketId: state.connection?.socketId ?? null,
          storedTeamToken: input.payload.teamToken,
          storedTeamCode: input.payload.teamCode,
          teamCodeInput: input.payload.teamCode,
        },
        commands: [
          {
            type: 'writeIdentity',
            identity: {
              teamToken: input.payload.teamToken,
              teamCode: input.payload.teamCode,
            },
          },
        ],
      };
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
    default: {
      const unhandled: never = input;
      throw new Error(
        `Unhandled team link input: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
