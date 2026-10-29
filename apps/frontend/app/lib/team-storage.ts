import type { StoredIdentity } from '@/app/lib/team-link';

export const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';
export const TEAM_TOKEN_STORAGE_KEY = 'campus-pubquiz-team-token';
export const TEAM_CODE_STORAGE_KEY = 'campus-pubquiz-team-code';
export const JOIN_CODE_STORAGE_KEY = 'campus-pubquiz-join-code';

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}

export function readStoredIdentity(): StoredIdentity {
  return {
    teamName: window.localStorage.getItem(TEAM_NAME_STORAGE_KEY),
    teamToken: window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY) ?? undefined,
    teamCode: window.localStorage.getItem(TEAM_CODE_STORAGE_KEY) ?? undefined,
    gameCode: window.localStorage.getItem(JOIN_CODE_STORAGE_KEY) ?? undefined,
  };
}

/**
 * Clears only the session-scoped identity (this game's auth token + join
 * code) on logout or session close — team name and team code deliberately
 * survive so the join form stays prefilled for playing as this team again,
 * another night or another game.
 */
export function clearStoredSession(clearAll: boolean = false): void {
  window.localStorage.removeItem(TEAM_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(JOIN_CODE_STORAGE_KEY);
  if (clearAll) {
    window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY);
    window.localStorage.removeItem(TEAM_CODE_STORAGE_KEY);
  }
}

/** Remembers the team code typed on /team. A different code than the stored one means a different team, so the stored name goes too: the join form must not pair one team's name with another's code. */
export function saveTeamCode(code: string): void {
  const stored = window.localStorage.getItem(TEAM_CODE_STORAGE_KEY);
  if (stored?.toLowerCase() !== code.toLowerCase()) {
    window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY);
  }
  window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, code);
}

/** Forgets the saved team (code and name) but keeps any live game link, so a phone mid-game still plays on. */
export function forgetSavedTeam(): void {
  window.localStorage.removeItem(TEAM_CODE_STORAGE_KEY);
  window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY);
}
