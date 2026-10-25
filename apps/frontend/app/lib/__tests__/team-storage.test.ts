import { beforeEach, describe, expect, it } from 'vitest';
import { clearStoredSession, normalizeJoinCode } from '@/app/lib/team-storage';

function seedIdentity() {
  window.localStorage.setItem('campus-pubquiz-team-name', 'Quizzy');
  window.localStorage.setItem('campus-pubquiz-team-token', 'tok');
  window.localStorage.setItem('campus-pubquiz-team-code', 'code');
  window.localStorage.setItem('campus-pubquiz-join-code', 'JOIN');
}

describe('clearStoredSession', () => {
  beforeEach(() => window.localStorage.clear());

  it('clears only the token and join code by default', () => {
    seedIdentity();
    clearStoredSession();
    expect(window.localStorage.getItem('campus-pubquiz-team-token')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe(
      'Quizzy',
    );
    expect(window.localStorage.getItem('campus-pubquiz-team-code')).toBe(
      'code',
    );
  });

  it('also clears the team name and team code when asked to clear all', () => {
    seedIdentity();
    clearStoredSession(true);
    expect(window.localStorage.length).toBe(0);
  });
});

describe('normalizeJoinCode', () => {
  it('trims surrounding whitespace and uppercases the code', () => {
    expect(normalizeJoinCode(' abcdef ')).toBe('ABCDEF');
  });

  it('leaves an already-normalized code unchanged', () => {
    expect(normalizeJoinCode('BOLD-AMBER-OTTER')).toBe('BOLD-AMBER-OTTER');
  });

  it('returns an empty string when given only whitespace', () => {
    expect(normalizeJoinCode('   ')).toBe('');
  });
});
