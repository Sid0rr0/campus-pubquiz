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
  useGameSocket,
  type UseGameSocketResult,
} from '@/app/lib/use-game-socket';
import {
  JOIN_CODE_STORAGE_KEY,
  TEAM_CODE_STORAGE_KEY,
  TEAM_NAME_STORAGE_KEY,
  TEAM_TOKEN_STORAGE_KEY,
  clearStoredSession,
  normalizeJoinCode,
  storedJoinOptions,
} from '@/app/lib/team-storage';

export interface UseTeamJoinResult extends UseGameSocketResult {
  teamName: string | null;
  nameInput: string;
  setNameInput: (value: string) => void;
  codeInput: string;
  setCodeInput: (value: string) => void;
  teamCodeInput: string;
  setTeamCodeInput: (value: string) => void;
  hasStoredIdentity: boolean;
  /** The join code this socket is actually connecting/connected with, or null when none is known yet — lets consumers tell "genuinely mid-connection" apart from "no session to reconnect to" even while teamName is already restored from storage. */
  activeJoinCode: string | null;
  handleJoin: (event: SubmitEvent<HTMLFormElement>) => void;
  handleLogOut: () => void;
}

/**
 * Owns the team-join lifecycle shared by the home page and /play: restoring a
 * stored identity on mount, connecting the socket once a join code is known,
 * persisting the team token/code once accepted, and resubmitting on retry.
 */
export function useTeamJoin(codeFromUrl: string): UseTeamJoinResult {
  const router = useRouter();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState(codeFromUrl);
  const [teamCodeInput, setTeamCodeInput] = useState('');
  const [hasStoredIdentity, setHasStoredIdentity] = useState(false);
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(
    codeFromUrl || null,
  );
  // Bumped on every form submission so the join effect below re-fires even
  // when the submitted name/code are unchanged from the last attempt — e.g.
  // retrying after a name-collision error with only the team code field
  // corrected, where teamName/activeJoinCode wouldn't otherwise change.
  const [joinAttempt, setJoinAttempt] = useState(0);
  // Always holds the latest typed team code without making the join effect
  // below re-fire on every keystroke (it should only fire on an actual
  // identity/session/attempt change).
  const teamCodeInputRef = useRef(teamCodeInput);
  useEffect(() => {
    teamCodeInputRef.current = teamCodeInput;
  });
  // Guards against a double-tap on the join button sending two JOIN_PLAYERS
  // requests before React re-renders past the form: for a brand-new team
  // name, the second request loses the race against the first's just-created
  // row and comes back "already registered" even though the first request
  // succeeded — leaving the error banner up over an otherwise-connected
  // game view. A ref (not state) so the very next synchronous click, before
  // any re-render, still sees the guard.
  const joinInFlightRef = useRef(false);

  // Passing joinAttempt as the retry key forces a brand-new socket on every
  // resubmission, even when the join code text is unchanged (e.g. a
  // QR-prefilled or previously-typed code that turned out to be unknown) —
  // the prior attempt's socket was disconnected server-side and won't
  // reconnect on its own, so reusing it here would silently drop the join.
  const socket = useGameSocket(
    'players',
    Boolean(activeJoinCode),
    activeJoinCode ?? undefined,
    joinAttempt,
  );
  const {
    team,
    joinTeam,
    sessionClosed,
    kicked,
    reconnectedAt,
    connectionError,
  } = socket;

  useEffect(() => {
    // A join attempt has settled — either the team is confirmed (JOIN_ACCEPTED)
    // or the server rejected it (an 'exception', surfaced as connectionError).
    // Either way the next tap should be able to send a fresh request.
    if (team || connectionError) {
      joinInFlightRef.current = false;
    }
  }, [team, connectionError]);

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored team name can only
    // be read after mount - this is the "synchronize with an external system"
    // case React's own docs carve out as a legitimate effect.
    const storedName = window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(storedName);
    setHasStoredIdentity(
      Boolean(window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY)),
    );
    if (storedName) {
      const storedOptions = storedJoinOptions();
      // Pre-fills the join form in case this reconnect attempt fails and we
      // fall back to showing it - the team shouldn't have to retype everything.
      setNameInput(storedName);
      if (storedOptions.joinCode) {
        setCodeInput(storedOptions.joinCode);
        // Only fills the gap when the URL didn't already pin a code — the URL
        // is the stronger signal (e.g. a fresh QR scan for a different game).
        setActiveJoinCode(
          (current) => current ?? storedOptions.joinCode ?? null,
        );
      }
      if (storedOptions.teamCode) {
        setTeamCodeInput(storedOptions.teamCode);
      }
    }
    // The actual joinTeam call happens in the effect below, once the socket
    // for activeJoinCode has had a chance to connect — calling it here would
    // race the socket's own connecting effect when the code only came from
    // storage (see the effect below for the full explanation).
  }, []);

  // Tracks the `reconnectedAt` value a join has already been sent for, so a
  // single connection only ever sends one JOIN_PLAYERS — see the effect
  // below for why this is needed.
  const sentForReconnectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Fires once this connection's identity (team name + session code) is
    // known, whichever of the join form / stored identity / URL supplied it —
    // and again on every joinAttempt bump, so resubmitting the form with the
    // same name/code (e.g. only the team code field corrected after a
    // collision error) still re-sends the join instead of being a no-op.
    // Also re-fires on every `reconnectedAt` change: the server only
    // associates a socket with a team while handling JOIN_PLAYERS, and drops
    // that association on disconnect — a transport-level auto-reconnect
    // (network blip, phone waking up) gets a fresh socket id that the server
    // has never seen, so without resending JOIN_PLAYERS here the team would
    // silently be unable to submit answers until a full page reload forced
    // this same effect to run again from scratch. Deliberately excludes
    // teamCodeInput itself from its deps (read via a ref instead) so
    // retyping the team code alone doesn't re-fire this join.
    //
    // A fresh join (identity just became known) and this same socket's own
    // 'connect' event (which bumps reconnectedAt) both land within moments
    // of each other on a brand-new socket — without the dedupe below, both
    // would independently fire this effect and send two JOIN_PLAYERS
    // requests for the same brand-new team name; the second loses the race
    // against the first's just-created row and comes back "already
    // registered" even though the name was genuinely new. reconnectedAt is
    // only non-null once the socket has actually connected (real
    // useGameSocket usage — some tests mock it as undefined and skip this
    // gate entirely, sending as soon as identity is known), and it gets a
    // fresh value on every connect (first-time or reconnect), so gating on
    // "already sent for this exact reconnectedAt" collapses both triggers
    // into a single send per connection while still resending on a genuine
    // transport reconnect.
    if (!teamName || !activeJoinCode) return;
    if (reconnectedAt === null) return;
    if (sentForReconnectedAtRef.current === reconnectedAt) return;
    sentForReconnectedAtRef.current = reconnectedAt;
    const storedOptions = storedJoinOptions();
    joinTeam(teamName, {
      teamToken: storedOptions.teamToken,
      teamCode: teamCodeInputRef.current.trim() || storedOptions.teamCode,
      joinCode: activeJoinCode,
    });
  }, [teamName, activeJoinCode, joinAttempt, reconnectedAt, joinTeam]);

  useEffect(() => {
    if (team) {
      window.localStorage.setItem(TEAM_TOKEN_STORAGE_KEY, team.teamToken);
      window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, team.teamCode);
    }
  }, [team]);

  // A fresh join (no team code typed in) only just learned its team code
  // from the server — mirror it into the field now, the same way the
  // mount-time prefill already keeps nameInput in sync with storage, so the
  // form shows it correctly if it ever reappears (log out, retry). Adjusted
  // during render rather than in an Effect.
  const [prevTeam, setPrevTeam] = useState(team);
  if (team !== prevTeam) {
    setPrevTeam(team);
    if (team) {
      setTeamCodeInput(team.teamCode);
    }
  }

  useEffect(() => {
    // The admin closed this session server-side — its token/join code are now
    // stale, so drop them and send the team back to a fresh /play join screen
    // rather than letting the next action surface an opaque server error.
    if (!sessionClosed) return;
    joinInFlightRef.current = false;
    clearStoredSession();
    router.push('/play');
  }, [sessionClosed, router]);

  // Team name and team code deliberately survive so the form stays prefilled
  // for joining another game as this same team. Adjusted during render
  // rather than in an Effect.
  const [prevSessionClosed, setPrevSessionClosed] = useState(sessionClosed);
  if (sessionClosed !== prevSessionClosed) {
    setPrevSessionClosed(sessionClosed);
    if (sessionClosed) {
      setTeamName(null);
      setCodeInput('');
      setHasStoredIdentity(false);
      setActiveJoinCode(null);
    }
  }

  useEffect(() => {
    // The admin kicked this team — its token/join code are now stale (kicking
    // deletes the roster row server-side), so drop them and send the team
    // back to a fresh /play join screen instead of leaving it stuck on a
    // frozen game view. Clearing the join code (not just the token) also
    // stops the reconnect-on-mount effect above from silently rejoining on
    // the next refresh — the team has to go through the join form again,
    // same as the admin intended by kicking it. clearStoredSession(true)
    // wipes the stored name/team code too (unlike logout/session-closed,
    // which deliberately keep them), so the form fields reset here as well
    // rather than showing the now-kicked team's stale values. Resetting
    // state in the effect itself (not the render-adjustment pattern used
    // elsewhere in this file) so it still runs when a component mounts
    // already kicked, not only on a live false→true transition.
    if (!kicked) return;
    joinInFlightRef.current = false;
    clearStoredSession(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(null);
    setCodeInput('');
    setHasStoredIdentity(false);
    setActiveJoinCode(null);
    setNameInput('');
    setTeamCodeInput('');
    router.push('/play');
  }, [kicked, router]);

  function handleJoin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joinInFlightRef.current) return;
    const trimmedName = nameInput.trim();
    const normalizedCode = normalizeJoinCode(codeInput);
    if (!trimmedName || !normalizedCode) return;
    joinInFlightRef.current = true;
    window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, trimmedName);
    window.localStorage.setItem(JOIN_CODE_STORAGE_KEY, normalizedCode);
    setTeamName(trimmedName);
    setActiveJoinCode(normalizedCode);
    setJoinAttempt((count) => count + 1);
  }

  // Stable across renders (unlike a plain function redeclared on every call)
  // since SiteHeader's PlayerMenuProvider bridge depends on this reference
  // to avoid re-publishing on every unrelated re-render of this hook.
  const handleLogOut = useCallback(() => {
    // Team name and team code deliberately survive logout — only the token
    // and join code (this specific game session) are cleared, so the join
    // form stays prefilled for playing as this team again another night.
    clearStoredSession();
    joinInFlightRef.current = false;
    setTeamName(null);
    setCodeInput(codeFromUrl);
    setHasStoredIdentity(false);
    setActiveJoinCode(codeFromUrl || null);
  }, [codeFromUrl]);

  return {
    ...socket,
    teamName,
    nameInput,
    setNameInput,
    codeInput,
    setCodeInput,
    teamCodeInput,
    setTeamCodeInput,
    hasStoredIdentity,
    activeJoinCode,
    handleJoin,
    handleLogOut,
  };
}
