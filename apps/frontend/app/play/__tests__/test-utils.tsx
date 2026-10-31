import { vi } from 'vitest';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { needsJoinForm } from '@/app/lib/join-gate';
import { mergeSeenQuestions } from '@/app/lib/seen-questions';
import type { TeamLinkGame, TeamLinkJoin } from '@/app/lib/use-team-link';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

/** The questions the Team link would have gathered from the one view a phone is sent for `session`. */
export function seenQuestionsOf(session: SessionDescription) {
  return mergeSeenQuestions({}, roomView(SOCKET_ROOMS.PLAYERS, session));
}

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';

/**
 * `join` overrides, typed against the real join part. `team` is the one
 * exception: tests describe a team by the few fields a screen reads, so it
 * takes a partial, loosely typed payload (many fixtures use a string `teamId`).
 */
type JoinOverrides = Partial<Omit<TeamLinkJoin, 'team'>> & {
  team?: Record<string, unknown> | null;
};

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
  join?: JoinOverrides;
  game?: Partial<TeamLinkGame>;
} = {}): { join: TeamLinkJoin; game: TeamLinkGame | undefined } {
  const game: TeamLinkGame | undefined = session
    ? {
        view: roomView(SOCKET_ROOMS.PLAYERS, session),
        submitAnswer: vi.fn(),
        submitShowdownGuess: vi.fn(),
        myAnswers: {},
        myAnswerGrades: {},
        myBonusAwards: [],
        myRoundRatings: {},
        myFeedback: { comment: '', topics: [] },
        // Most screens are tested for a team that already reported its count;
        // the player count tests pass null.
        myPlayerCount: 3,
        setPlayerCount: vi.fn().mockResolvedValue({ success: true }),
        myJoker: null,
        pickJoker: vi.fn().mockResolvedValue({ success: true }),
        myPurchases: [],
        roomReadyQuestionIds: [],
        buyPowerUp: vi.fn().mockResolvedValue({ success: true }),
        buyExtraJoker: vi.fn().mockResolvedValue({ success: true }),
        sendFeedback: vi.fn().mockResolvedValue({ success: true }),
        mySessionRatings: { pacing: null, feltDifficulty: null },
        rateSession: vi.fn().mockResolvedValue({ success: true }),
        roundRatingsEpoch: 0,
        rateRound: vi.fn().mockResolvedValue({ success: true }),
        seenQuestions: {},
        ...gameOverrides,
      }
    : undefined;
  // The lazily read fields below start as placeholders and are replaced by
  // getters, so a field a test does not override is read on access.
  const join: TeamLinkJoin = {
    connectionError: null,
    isReconnecting: false,
    forceReconnect: vi.fn(),
    teamName: null,
    hasStoredIdentity: false,
    activeJoinCode: null,
    needsJoinForm: false,
    nameInput: '',
    setNameInput: vi.fn(),
    codeInput: '',
    setCodeInput: vi.fn(),
    teamCodeInput: '',
    setTeamCodeInput: vi.fn(),
    handleJoin: vi.fn(),
    handleLogOut: vi.fn(),
    ...joinOverrides,
    team: (joinOverrides.team ?? null) as TeamLinkJoin['team'],
  };
  const storedName = () => window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
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
        teamName: join.teamName,
        activeJoinCode: join.activeJoinCode,
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
  overrides: JoinOverrides,
  key: keyof TeamLinkJoin,
  read: () => T,
): PropertyDescriptor {
  return {
    enumerable: true,
    get: () => (key in overrides ? overrides[key] : read()),
  };
}
