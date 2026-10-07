'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  usePlayerGame,
  type UsePlayerGameResult,
} from '@/app/lib/use-player-game';
import {
  initialTeamLink,
  teamLink,
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

const KICKED_MESSAGE = 'You were removed from this team by the quiz master';

const STORAGE_KEY_BY_IDENTITY_FIELD = {
  teamName: TEAM_NAME_STORAGE_KEY,
  gameCode: JOIN_CODE_STORAGE_KEY,
  teamToken: TEAM_TOKEN_STORAGE_KEY,
  teamCode: TEAM_CODE_STORAGE_KEY,
} as const;

export interface UseTeamLinkResult extends Omit<
  UsePlayerGameResult,
  'sendJoin' | 'socketConnection'
> {
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

/**
 * Runs the Team link with React for /play and the home page's join panel:
 * feeds the socket's events and the team's taps into the module, keeps its
 * state, and carries out its commands. Answers and the team's data still come
 * from the player hook underneath.
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
  const sendJoinRef = useRef<UsePlayerGameResult['sendJoin'] | null>(null);
  // A join's refusal arrives later and re-enters the module.
  const dispatchRef = useRef<(input: TeamLinkInput) => void>(() => undefined);

  const dispatch = useCallback((input: TeamLinkInput) => {
    const step = teamLink(linkRef.current, input);
    linkRef.current = step.state;
    setLink(step.state);
    for (const command of step.commands) {
      switch (command.type) {
        case 'sendJoin':
          void sendJoinRef.current?.(command.payload).then((result) => {
            if (!result.success) {
              dispatchRef.current({
                type: 'joinRefused',
                connectionId: command.connectionId,
                reason: result.error,
              });
            }
          });
          break;
        case 'writeIdentity':
          writeIdentity(command.identity);
          break;
        case 'clearIdentity':
          clearStoredSession(command.scope === 'all');
          break;
        case 'openConnection':
          // The player hook below opens it from `activeJoinCode` and `attempt`.
          break;
        default: {
          const unhandled: never = command;
          throw new Error(`Unhandled team link command: ${String(unhandled)}`);
        }
      }
    }
  }, []);

  const {
    sendJoin,
    team,
    kicked,
    sessionClosed,
    snapshot,
    socketConnection,
    connectionError: playerConnectionError,
    leaveSession,
    ...player
  } = usePlayerGame(
    Boolean(link.activeJoinCode),
    link.activeJoinCode ?? undefined,
    link.attempt,
  );

  useEffect(() => {
    sendJoinRef.current = sendJoin;
    dispatchRef.current = dispatch;
  }, [sendJoin, dispatch]);

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
    if (playerConnectionError) dispatch({ type: 'connectionRefused' });
  }, [playerConnectionError, dispatch]);

  const status = snapshot?.progress.status;
  useEffect(() => {
    if (status) dispatch({ type: 'statusSeen', status });
  }, [status, dispatch]);

  useEffect(() => {
    if (team) dispatch({ type: 'joinAccepted', payload: team });
  }, [team, dispatch]);

  useEffect(() => {
    // The admin closed this session server-side — its token and game code are
    // stale, so the team goes back to a fresh join screen with its name and
    // team code kept.
    if (!sessionClosed) return;
    dispatch({ type: 'identityReset', clearAll: false, gameCode: '' });
    router.push('/play');
  }, [sessionClosed, dispatch, router]);

  useEffect(() => {
    // The admin kicked this team: everything stored goes, so a refresh can't
    // silently rejoin. Runs in an effect so it also applies when a component
    // mounts already kicked.
    if (!kicked) return;
    dispatch({ type: 'identityReset', clearAll: true, gameCode: '' });
    router.push('/play');
  }, [kicked, dispatch, router]);

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
  const handleLogOut = useCallback(() => {
    // Tell the server this team is intentionally leaving while the socket is
    // still connected, so it doesn't linger on /control. Best-effort.
    if (team) void leaveSession(team.teamId);
    dispatch({ type: 'identityReset', clearAll: false, gameCode: codeFromUrl });
  }, [codeFromUrl, team, leaveSession, dispatch]);

  return {
    ...player,
    snapshot,
    team,
    kicked,
    sessionClosed,
    leaveSession,
    connectionError:
      link.joinError ?? (kicked ? KICKED_MESSAGE : playerConnectionError),
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
