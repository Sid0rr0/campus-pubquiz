import { vi } from 'vitest';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { needsJoinForm } from '@/app/lib/join-gate';
import { mergeSeenQuestions } from '@/app/lib/seen-questions';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

/** The questions the Team link would have gathered from the one view a phone is sent for `session`. */
export function seenQuestionsOf(session: SessionDescription) {
  return mergeSeenQuestions({}, roomView(SOCKET_ROOMS.PLAYERS, session));
}

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';

/**
 * The result of the Team link adapter (`useTeamLink`) for a page test, in its
 * two parts. The joined game exists when the test describes a `session`: its
 * view is what the server would send a phone for that session (see
 * `roomView`) and the rest is the hook's own state: answers, grades, ratings
 * and the questions seen (empty unless a test passes
 * `seenQuestionsOf(session)`). Without a session there is no joined game.
 * A phone counts as joined when the test saved a team name in localStorage
 * (the `joinAsTeam` helpers) — the stand-in for the identity the real
 * adapter restores — so the `join` fields derived from it are read when the
 * page asks for them. `needsJoinForm` is derived from the same fields (and
 * read lazily too) unless a test overrides it. Tests override `join` or
 * `game` fields only.
 */
export function teamLinkResult({
  session,
  join: joinOverrides = {},
  game: gameOverrides = {},
}: {
  session?: SessionDescription;
  join?: Record<string, unknown>;
  game?: Record<string, unknown>;
} = {}) {
  const game = session
    ? {
        view: roomView(SOCKET_ROOMS.PLAYERS, session),
        submitAnswer: vi.fn(),
        submitShowdownGuess: vi.fn(),
        myAnswers: {},
        myAnswerGrades: {},
        myBonusAwards: [],
        myRoundRatings: {},
        myFeedback: { comment: '', topics: [] },
        sendFeedback: vi.fn().mockResolvedValue({ success: true }),
        roundRatingsEpoch: 0,
        rateRound: vi.fn().mockResolvedValue({ success: true }),
        seenQuestions: {},
        ...gameOverrides,
      }
    : undefined;
  const join = {
    connectionError: null,
    team: null,
    nameInput: '',
    setNameInput: vi.fn(),
    codeInput: '',
    setCodeInput: vi.fn(),
    teamCodeInput: '',
    setTeamCodeInput: vi.fn(),
    handleJoin: vi.fn(),
    handleLogOut: vi.fn(),
    ...joinOverrides,
  };
  const storedName = () => window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
  // The lazily read fields, as seen through the finished join part.
  const live = join as unknown as {
    teamName: string | null;
    activeJoinCode: string | null;
  };
  Object.defineProperties(join, {
    teamName: lazy(joinOverrides, 'teamName', storedName),
    hasStoredIdentity: lazy(joinOverrides, 'hasStoredIdentity', () =>
      Boolean(storedName()),
    ),
    activeJoinCode: lazy(joinOverrides, 'activeJoinCode', () =>
      storedName() ? 'ABCDEF' : null,
    ),
    needsJoinForm: lazy(joinOverrides, 'needsJoinForm', () =>
      needsJoinForm({
        teamName: live.teamName,
        activeJoinCode: live.activeJoinCode,
        hasView: Boolean(game),
        connectionError: join.connectionError,
        hasTeam: Boolean(join.team),
      }),
    ),
  });
  return { join, game };
}

/** A property an override sets wins; otherwise it is read on access. */
function lazy<T>(
  overrides: Record<string, unknown>,
  key: string,
  read: () => T,
): PropertyDescriptor {
  return {
    enumerable: true,
    get: () => (key in overrides ? overrides[key] : read()),
  };
}
