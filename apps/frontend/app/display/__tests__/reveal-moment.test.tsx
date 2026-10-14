import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { displaySounds } from '@/app/lib/display-sounds';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { play: vi.fn(), unlock: vi.fn(), setMuted: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/** The count is drawn twice (an animated copy and a static one for screen readers); tests read the static one. */
const SR_ONLY = { selector: '.sr-only' };

const FOUR_TEAMS = ['Ants', 'Bees', 'Cats', 'Dogs'].map((teamName) => ({
  teamName,
  totalPoints: 0,
}));

const ROUNDS = [
  {
    questions: [
      { id: 1, prompt: 'Capital of France?', answer: 'Paris' },
      { id: 2, prompt: 'Largest planet?', answer: 'Jupiter' },
    ],
  },
];

function atReveal(overrides: SessionDescription = {}): SessionDescription {
  return {
    rounds: ROUNDS,
    leaderboard: FOUR_TEAMS,
    progress: { status: 'reveal', questionIndex: 1, revealIndex: 0 },
    ...overrides,
  };
}

describe('DisplayPage — reveal moment', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    vi.mocked(displaySounds.play).mockClear();
  });

  function showDisplayAt(session: SessionDescription) {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, session),
      connectionError: null,
      sendAction: vi.fn(),
    });
  }

  describe('teams-correct count', () => {
    it('shows how many of the teams got the question right, with the close ones', () => {
      showDisplayAt(
        atReveal({ verdictTallies: { 1: { correct: 2, partial: 1 } } }),
      );

      render(<DisplayPage />);

      expect(screen.getByText('2 of 4 teams', SR_ONLY)).toBeInTheDocument();
      expect(screen.getByText('+1 close')).toBeInTheDocument();
    });

    it('leaves out "close" when no team was partly right', () => {
      showDisplayAt(
        atReveal({ verdictTallies: { 1: { correct: 3, partial: 0 } } }),
      );

      render(<DisplayPage />);

      expect(screen.getByText('3 of 4 teams', SR_ONLY)).toBeInTheDocument();
      expect(screen.queryByText(/close/)).not.toBeInTheDocument();
    });

    it('counts a question nobody got right as 0 of the teams', () => {
      showDisplayAt(atReveal());

      render(<DisplayPage />);

      expect(screen.getByText('0 of 4 teams', SR_ONLY)).toBeInTheDocument();
    });

    it('shows no count on a closest_guess reveal', () => {
      showDisplayAt(
        atReveal({
          rounds: [
            {
              questions: [
                {
                  id: 1,
                  type: 'closest_guess',
                  prompt: 'How many beans?',
                  answer: '500',
                  closestGuess: { hasSubmissions: false, closestGuesses: [] },
                },
              ],
            },
          ],
          progress: { status: 'reveal', questionIndex: 0, revealIndex: 0 },
        }),
      );

      render(<DisplayPage />);

      expect(screen.queryByText(/of 4 teams/)).not.toBeInTheDocument();
    });
  });

  describe('reveal sting', () => {
    it('plays no sting for the first snapshot, e.g. a reloaded big screen', () => {
      showDisplayAt(atReveal());

      render(<DisplayPage />);

      expect(displaySounds.play).not.toHaveBeenCalled();
    });

    it('plays the reveal sting when the quiz moves forward onto a revealed answer', () => {
      showDisplayAt(
        atReveal({
          progress: {
            status: 'reveal_intro',
            questionIndex: 1,
            revealIndex: 0,
          },
        }),
      );
      const { rerender } = render(<DisplayPage />);

      showDisplayAt(atReveal());
      rerender(<DisplayPage />);

      expect(displaySounds.play).toHaveBeenCalledWith('reveal');
    });

    it('plays no sting when the quiz master steps back with Previous', () => {
      showDisplayAt(
        atReveal({
          progress: { status: 'reveal', questionIndex: 1, revealIndex: 1 },
        }),
      );
      const { rerender } = render(<DisplayPage />);

      showDisplayAt(atReveal());
      rerender(<DisplayPage />);

      expect(displaySounds.play).not.toHaveBeenCalled();
    });
  });
});
