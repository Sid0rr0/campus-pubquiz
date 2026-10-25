import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  SOCKET_ROOMS,
  type ActiveShowdownRoundState,
} from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
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

const SHOWDOWN: ActiveShowdownRoundState = {
  id: 7,
  question: 'How tall is the Eiffel Tower?',
  answer: '330',
  participants: [
    { teamId: 1, teamName: 'The Quizzards', seatIndex: 0, guess: '300' },
    { teamId: 2, teamName: 'Second Place', seatIndex: 1, guess: null },
  ],
  winnerTeamId: null,
  isTie: false,
  resolved: false,
};

// Round 2 is the quiz's only break: round 1 flows into it, so "BREAK 1" follows round 2.
const breakAfterRoundTwoQuiz = [
  { breakAfter: false, questions: [{}] },
  { questions: [{}] },
];

/** The display view for the described session, drawn by the page. */
function showDisplay(description: SessionDescription) {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, description),
    connectionError: null,
    sendAction: vi.fn(),
  });
}

describe('DisplayPage — renders by the on-air screen kind', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the leaderboard for a leaderboard screen whatever status is underneath', () => {
    showDisplay({
      rounds: [{ questions: [{ prompt: 'Capital of France?' }] }],
      progress: { status: 'question_open', isLeaderboardVisible: true },
    });
    render(<DisplayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it('shows the break intro for a break with no reviewable question', () => {
    showDisplay({
      rounds: breakAfterRoundTwoQuiz,
      // revealIndex 5 is past the block, so there is no question to review.
      progress: { status: 'break', roundIndex: 1, revealIndex: 5 },
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
  });

  it('shows the showdown for an ended game with an active showdown', () => {
    showDisplay({
      progress: { status: 'ended' },
      showdown: { round: SHOWDOWN, revealStep: 0 },
    });
    render(<DisplayPage />);

    expect(screen.getByText('SHOWDOWN TIEBREAKER')).toBeInTheDocument();
    expect(screen.queryByText(/quiz complete/i)).not.toBeInTheDocument();
  });

  it('shows quiz complete for an ended game with no active showdown', () => {
    showDisplay({ progress: { status: 'ended' } });
    render(<DisplayPage />);

    expect(screen.getByText(/quiz complete/i)).toBeInTheDocument();
    expect(screen.queryByText('SHOWDOWN TIEBREAKER')).not.toBeInTheDocument();
  });

  describe('the feedback prompt', () => {
    const breakIntroSession = {
      rounds: breakAfterRoundTwoQuiz,
      progress: { status: 'break_intro' as const, roundIndex: 1 },
    };

    it('shows "Rate the rounds on your phone" on the break card when feedback is collected', () => {
      showDisplay({
        ...breakIntroSession,
        settings: { collectFeedback: true },
      });
      render(<DisplayPage />);

      expect(
        screen.getByText('Rate the rounds on your phone ★'),
      ).toBeInTheDocument();
    });

    it('draws no prompt on the break card when feedback is not collected', () => {
      showDisplay({
        ...breakIntroSession,
        settings: { collectFeedback: false },
      });
      render(<DisplayPage />);

      expect(screen.queryByText(/on your phone/i)).not.toBeInTheDocument();
    });

    it('shows the thank-you and "Tell us how it went on your phone" on the final screen when feedback is collected', () => {
      showDisplay({
        progress: { status: 'ended' },
        settings: { collectFeedback: true },
      });
      render(<DisplayPage />);

      expect(
        screen.getByText(
          "Thank you for playing today's pub quiz! Tell us how it went on your phone ★ See you next week!",
        ),
      ).toBeInTheDocument();
    });

    it('shows only the thank-you on the final screen when feedback is not collected', () => {
      showDisplay({
        progress: { status: 'ended' },
        settings: { collectFeedback: false },
      });
      render(<DisplayPage />);

      expect(
        screen.getByText(
          "Thank you for playing today's pub quiz! See you next week!",
        ),
      ).toBeInTheDocument();
    });

    it('draws no prompt on the final screen when feedback is not collected', () => {
      showDisplay({
        progress: { status: 'ended' },
        settings: { collectFeedback: false },
      });
      render(<DisplayPage />);

      expect(screen.queryByText(/on your phone/i)).not.toBeInTheDocument();
    });
  });

  it('draws an empty area for a blank screen (a locking screen the server could not resolve)', () => {
    showDisplay({
      rounds: [{ questions: [{ prompt: 'Capital of France?' }] }],
      progress: { status: 'locking' },
      timers: { questionLockAt: null },
    });

    expect(() => render(<DisplayPage />)).not.toThrow();
    expect(screen.queryByText(/lock/i)).not.toBeInTheDocument();
  });
});
