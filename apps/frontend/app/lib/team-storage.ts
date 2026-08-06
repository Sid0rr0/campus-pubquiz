import type { JoinTeamOptions } from '@/app/lib/use-game-socket';

export const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';
export const TEAM_TOKEN_STORAGE_KEY = 'campus-pubquiz-team-token';
export const TEAM_CODE_STORAGE_KEY = 'campus-pubquiz-team-code';
export const JOIN_CODE_STORAGE_KEY = 'campus-pubquiz-join-code';

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}

export function storedJoinOptions(): JoinTeamOptions {
  return {
    teamToken: window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY) ?? undefined,
    teamCode: window.localStorage.getItem(TEAM_CODE_STORAGE_KEY) ?? undefined,
    joinCode: window.localStorage.getItem(JOIN_CODE_STORAGE_KEY) ?? undefined,
  };
}

export function clearStoredIdentity(): void {
  window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY);
  window.localStorage.removeItem(TEAM_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TEAM_CODE_STORAGE_KEY);
  window.localStorage.removeItem(JOIN_CODE_STORAGE_KEY);
}
