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
 * The result of the Team link adapter (`useTeamLink`) for a page test. The
 * snapshot is the view the server would send a phone for the `session` the
 * test describes (see `roomView`); everything else is the hook's own state:
 * answers, grades, ratings, the questions seen (empty unless a test passes
 * `seenQuestionsOf(session)`) and the reconnect marker. A phone counts as joined
 * when the test saved a team name in localStorage (the `joinAsTeam` helpers)
 * — the stand-in for the identity the real adapter restores — so those
 * fields are read when the page asks for them. `needsJoinForm` is derived
 * from the same fields (and read lazily too) unless a test overrides it.
 */
export function socketResult(
  overrides: { session?: SessionDescription } & Record<string, unknown> = {},
) {
  const { session, ...hookOverrides } = overrides;
  const snapshot = session ? roomView(SOCKET_ROOMS.PLAYERS, session) : null;
  const result = {
    snapshot,
    connectionError: null,
    team: null,
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
    nameInput: '',
    setNameInput: vi.fn(),
    codeInput: '',
    setCodeInput: vi.fn(),
    teamCodeInput: '',
    setTeamCodeInput: vi.fn(),
    handleJoin: vi.fn(),
    handleLogOut: vi.fn(),
    ...hookOverrides,
  };
  const storedName = () => window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
  // The lazily read fields, as seen through the finished result.
  const live = result as unknown as {
    teamName: string | null;
    activeJoinCode: string | null;
  };
  return Object.defineProperties(result, {
    teamName: lazy(hookOverrides, 'teamName', storedName),
    hasStoredIdentity: lazy(hookOverrides, 'hasStoredIdentity', () =>
      Boolean(storedName()),
    ),
    activeJoinCode: lazy(hookOverrides, 'activeJoinCode', () =>
      storedName() ? 'ABCDEF' : null,
    ),
    needsJoinForm: lazy(hookOverrides, 'needsJoinForm', () =>
      needsJoinForm({
        teamName: live.teamName,
        activeJoinCode: live.activeJoinCode,
        hasView: Boolean(result.snapshot),
        connectionError: result.connectionError,
        hasTeam: Boolean(result.team),
      }),
    ),
  });
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
