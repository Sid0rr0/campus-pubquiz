import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  DEFAULT_SESSION_SETTINGS,
  getNextGameState,
  LOBBY_PROGRESS,
  SOCKET_ROOMS,
  type GameProgress,
  type GameStatus,
} from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef, mockPlay, mockFireConfetti } = vi.hoisted(
  () => ({
    mockUseGame: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    mockPlay: vi.fn(),
    mockFireConfetti: vi.fn(),
  }),
);

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('@/app/lib/confetti', () => ({ fireConfetti: mockFireConfetti }));

vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { play: mockPlay, unlock: vi.fn(), setMuted: vi.fn() },
}));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const ROUNDS = [
  {
    questions: [
      { id: 1, prompt: 'Capital of France?', answer: 'Paris' },
      { id: 2, prompt: 'Largest planet?', answer: 'Jupiter' },
    ],
  },
  {
    questions: [{ id: 3, prompt: 'Smallest prime?', answer: '2' }],
  },
];

const STANDINGS = [
  { teamName: 'Gold Team', totalPoints: 40 },
  { teamName: 'Silver Team', totalPoints: 30 },
  { teamName: 'Bronze Team', totalPoints: 20 },
  { teamName: 'Fourth Team', totalPoints: 10 },
];

/** Every progress an Advance walk visits, from the lobby to the ended screen. */
const WALK: GameProgress[] = (() => {
  const context = {
    rounds: [
      { questionCount: 2, breakAfter: true },
      { questionCount: 1, breakAfter: true },
    ],
    showRoundOverview: DEFAULT_SESSION_SETTINGS.showRoundOverview,
  };
  // The walk turns the leaderboard on between rounds; the screens under it are
  // what these tests are about.
  const open = (progress: GameProgress): GameProgress => ({
    ...progress,
    isLeaderboardVisible: false,
  });
  const visited = [
    open(getNextGameState(LOBBY_PROGRESS, 'START_QUIZ', context)),
  ];
  while (visited[visited.length - 1].status !== 'ended') {
    visited.push(
      open(getNextGameState(visited[visited.length - 1], 'ADVANCE', context)),
    );
  }
  return visited;
})();

function at(
  progress: Partial<GameProgress>,
  more: SessionDescription = {},
): SessionDescription {
  return {
    rounds: ROUNDS,
    leaderboard: STANDINGS,
    progress,
    timers: { questionLockAt: 1_000 },
    ...more,
  };
}

/** The views of a stretch of the walk, from the first progress with `from` to the first with `to`. */
function advanceFrom(from: GameStatus, to: GameStatus): SessionDescription[] {
  const start = WALK.findIndex((progress) => progress.status === from);
  const end = WALK.findIndex(
    (progress, index) => index > start && progress.status === to,
  );
  return WALK.slice(start, end + 1).map((progress) => at(progress));
}

function show(
  description: SessionDescription,
  connectionError: unknown = null,
) {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, description),
    connectionError,
    sendAction: vi.fn(),
  });
}

/** Renders the first view, then each next one as a live update. */
function watch(...views: SessionDescription[]) {
  show(views[0]);
  const { rerender } = render(<DisplayPage />);
  for (const view of views.slice(1)) {
    show(view);
    rerender(<DisplayPage />);
  }
}

function played() {
  return mockPlay.mock.calls.map(([name]) => name);
}

function count(name: string) {
  return played().filter((played) => played === name).length;
}

function covered(view: SessionDescription): SessionDescription {
  return {
    ...view,
    progress: { ...view.progress, isJoinOverlayVisible: true },
  };
}

describe('DisplayPage — sounds follow the Display screen', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockPlay.mockClear();
    mockFireConfetti.mockClear();
  });

  describe('round sting', () => {
    it('plays on Advance onto a round intro', () => {
      watch(...advanceFrom('rules', 'round_intro'));

      expect(played()).toEqual(['sting']);
    });

    it('stays silent on the break round intro and on the reveal intro', () => {
      watch(...advanceFrom('break_intro', 'reveal_intro'));

      expect(count('sting')).toBe(0);
    });
  });

  describe('reveal sting', () => {
    it('plays once for each revealed answer', () => {
      const reveals = WALK.filter(
        (progress) => progress.status === 'reveal',
      ).length;

      watch(...advanceFrom('reveal_intro', 'ended'));

      expect(count('reveal')).toBe(reveals);
      expect(reveals).toBe(3);
    });

    it('stays silent for the steps of a closest-guess reveal', () => {
      const reveal = at(
        { status: 'reveal', questionIndex: 0, revealIndex: 0 },
        {
          rounds: [
            {
              questions: [
                {
                  id: 1,
                  type: 'closest_guess' as const,
                  prompt: 'How many beans?',
                  answer: '500',
                  closestGuess: { hasSubmissions: false, closestGuesses: [] },
                },
              ],
            },
          ],
          closestGuessRevealStep: 0,
        },
      );

      watch(reveal, { ...reveal, closestGuessRevealStep: 1 });

      expect(played()).toEqual([]);
    });
  });

  describe('time-up', () => {
    it('plays once at the lock and not again through the break', () => {
      watch(...advanceFrom('locking', 'reveal'));

      expect(count('timeUp')).toBe(1);
    });

    it('stays silent from one question to the next and into locking', () => {
      watch(...advanceFrom('question_open', 'locking'));

      expect(played()).toEqual([]);
    });
  });

  describe('fanfare and confetti', () => {
    it('fire when the quiz ends', () => {
      watch(...advanceFrom('reveal_intro', 'ended').slice(-2));

      expect(count('fanfare')).toBe(1);
      expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    });

    it('fire nothing more when the final leaderboard already crowned the winner', () => {
      const lastReveal = at(WALK[WALK.length - 2]);
      const finalBoard = (leaderboardRevealCount: number) =>
        at(
          { status: 'ended', isLeaderboardVisible: true },
          { leaderboardRevealCount },
        );

      watch(lastReveal, finalBoard(3), finalBoard(4));
      const celebrations = count('fanfare');
      show(at({ status: 'ended' }));
      // The leaderboard played its own fanfare; the ended screen adds none.
      expect(celebrations).toBe(1);
      expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    });

    it('do not replay after an end-of-quiz showdown returns to the ended screen', () => {
      const ended = at({ status: 'ended' });
      const showdown = at(
        { status: 'ended' },
        {
          showdown: {
            round: {
              id: 900,
              question: 'How many people are in this room?',
              answer: '40',
              participants: [
                { teamId: 1, teamName: 'Gold Team', seatIndex: 0, guess: null },
                {
                  teamId: 2,
                  teamName: 'Silver Team',
                  seatIndex: 1,
                  guess: null,
                },
              ],
              winnerTeamId: null,
              isTie: false,
              resolved: false,
            },
          },
        },
      );

      watch(at(WALK[WALK.length - 2]), ended, showdown, ended);

      expect(count('fanfare')).toBe(1);
      expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    });
  });

  describe('silence', () => {
    it('on Previous', () => {
      watch(...advanceFrom('rules', 'ended').reverse());

      expect(played()).toEqual([]);
    });

    it('on the first snapshot after a load', () => {
      watch(at(WALK[WALK.length - 2]));

      expect(played()).toEqual([]);
    });

    it('on the first snapshot after a reconnect', () => {
      const [before, after] = advanceFrom('rules', 'round_intro').slice(-2);
      show(before);
      const { rerender } = render(<DisplayPage />);
      show(before, new Error('dropped'));
      rerender(<DisplayPage />);

      show(after);
      rerender(<DisplayPage />);

      expect(played()).toEqual([]);
    });

    it('when an overlay is toggled on and off', () => {
      const reveal = at(WALK.find((progress) => progress.status === 'reveal')!);

      watch(
        reveal,
        {
          ...reveal,
          progress: { ...reveal.progress, isLeaderboardVisible: true },
        },
        covered(reveal),
        reveal,
      );

      expect(played()).toEqual([]);
    });

    it('for moves made while an overlay covers the screen', () => {
      const walk = advanceFrom('locking', 'ended');

      watch(...walk.map(covered), walk[walk.length - 1]);

      expect(played()).toEqual([]);
      expect(mockFireConfetti).not.toHaveBeenCalled();
    });
  });
});
