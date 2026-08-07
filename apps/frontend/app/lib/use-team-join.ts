'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useGameSocket, type UseGameSocketResult } from '@/app/lib/use-game-socket';
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
  handleJoin: (event: FormEvent<HTMLFormElement>) => void;
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
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(codeFromUrl || null);
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
  const { team, joinTeam, sessionClosed } = socket;

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored team name can only
    // be read after mount - this is the "synchronize with an external system"
    // case React's own docs carve out as a legitimate effect.
    const storedName = window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(storedName);
    setHasStoredIdentity(Boolean(window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY)));
    if (storedName) {
      const storedOptions = storedJoinOptions();
      // Pre-fills the join form in case this reconnect attempt fails and we
      // fall back to showing it - the team shouldn't have to retype everything.
      setNameInput(storedName);
      if (storedOptions.joinCode) {
        setCodeInput(storedOptions.joinCode);
        // Only fills the gap when the URL didn't already pin a code — the URL
        // is the stronger signal (e.g. a fresh QR scan for a different game).
        setActiveJoinCode((current) => current ?? storedOptions.joinCode ?? null);
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

  useEffect(() => {
    // Fires once this connection's identity (team name + session code) is
    // known, whichever of the join form / stored identity / URL supplied it —
    // and again on every joinAttempt bump, so resubmitting the form with the
    // same name/code (e.g. only the team code field corrected after a
    // collision error) still re-sends the join instead of being a no-op.
    // Deliberately excludes teamCodeInput itself from its deps (read via a
    // ref instead) so retyping the team code alone doesn't re-fire this join.
    if (!teamName || !activeJoinCode) return;
    const storedOptions = storedJoinOptions();
    joinTeam(teamName, {
      teamToken: storedOptions.teamToken,
      teamCode: teamCodeInputRef.current.trim() || storedOptions.teamCode,
      joinCode: activeJoinCode,
    });
  }, [teamName, activeJoinCode, joinAttempt, joinTeam]);

  useEffect(() => {
    if (team) {
      window.localStorage.setItem(TEAM_TOKEN_STORAGE_KEY, team.teamToken);
      window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, team.teamCode);
      // A fresh join (no team code typed in) only just learned its team code
      // from the server — mirror it into the field now, the same way the
      // mount-time prefill already keeps nameInput in sync with storage, so
      // the form shows it correctly if it ever reappears (log out, retry).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeamCodeInput(team.teamCode);
    }
  }, [team]);

  useEffect(() => {
    // The admin closed this session server-side — its token/join code are now
    // stale, so drop them and send the team back to a fresh /play join screen
    // rather than letting the next action surface an opaque server error.
    // Team name and team code deliberately survive so the form stays
    // prefilled for joining another game as this same team.
    if (!sessionClosed) return;
    clearStoredSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(null);
    setCodeInput('');
    setHasStoredIdentity(false);
    setActiveJoinCode(null);
    router.push('/play');
  }, [sessionClosed, router]);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nameInput.trim();
    const normalizedCode = normalizeJoinCode(codeInput);
    if (!trimmedName || !normalizedCode) return;
    window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, trimmedName);
    window.localStorage.setItem(JOIN_CODE_STORAGE_KEY, normalizedCode);
    setTeamName(trimmedName);
    setActiveJoinCode(normalizedCode);
    setJoinAttempt((count) => count + 1);
  }

  function handleLogOut() {
    // Team name and team code deliberately survive logout — only the token
    // and join code (this specific game session) are cleared, so the join
    // form stays prefilled for playing as this team again another night.
    clearStoredSession();
    setTeamName(null);
    setCodeInput(codeFromUrl);
    setHasStoredIdentity(false);
    setActiveJoinCode(codeFromUrl || null);
  }

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
    handleJoin,
    handleLogOut,
  };
}
