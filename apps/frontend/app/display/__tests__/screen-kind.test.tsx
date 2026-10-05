import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type {
  ActiveShowdownView,
  GameProgress,
  OnAirScreen,
  StateSnapshotPayload,
} from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
import { progress, question, displayView } from './test-utils';

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

const SHOWDOWN: ActiveShowdownView = {
  id: 7,
  question: 'How tall is the Eiffel Tower?',
  participants: [
    { teamId: 1, teamName: 'The Quizzards', seatIndex: 0, hasGuessed: true },
    { teamId: 2, teamName: 'Second Place', seatIndex: 1, hasGuessed: false },
  ],
};

// roundIndex 1 (round "2") is this fixture's only break.
const breakAfterRoundTwo = {
  blockCount: 1,
  topicsPerBlock: 2,
  breakRoundNumbers: [2],
  minQuestionsPerTopic: 1,
  maxQuestionsPerTopic: 1,
};

/** A snapshot whose on-air screen is set explicitly, so the page is shown to follow the screen's kind rather than the status underneath. */
function mockScreen(
  onAirScreen: OnAirScreen,
  snapshot: Partial<StateSnapshotPayload> & { progress: GameProgress },
) {
  mockUseGame.mockReturnValue({
    snapshot: { ...displayView(snapshot), onAirScreen },
    connectionError: null,
    sendAction: vi.fn(),
  });
}

describe('DisplayPage — renders by the on-air screen kind', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the leaderboard for a leaderboard screen whatever status is underneath', () => {
    mockScreen(
      { kind: 'leaderboard' },
      {
        progress: progress({ status: 'question_open' }),
        currentQuestion: question,
      },
    );
    render(<DisplayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it('shows the break intro for a break with no reviewable question', () => {
    mockScreen(
      { kind: 'break_intro', roundIndex: 1, isFeedbackPromptShown: false },
      {
        progress: progress({ status: 'break', roundIndex: 1 }),
        blockQuestions: [],
        quizStructure: breakAfterRoundTwo,
      },
    );
    render(<DisplayPage />);

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
  });

  it('shows the showdown for an ended game with an active showdown', () => {
    mockScreen(
      { kind: 'showdown', showdownId: SHOWDOWN.id },
      {
        progress: progress({ status: 'ended' }),
        activeShowdown: SHOWDOWN,
        showdownRevealStep: 0,
      },
    );
    render(<DisplayPage />);

    expect(screen.getByText('SHOWDOWN TIEBREAKER')).toBeInTheDocument();
    expect(screen.queryByText(/quiz complete/i)).not.toBeInTheDocument();
  });

  it('shows quiz complete for an ended game with no active showdown', () => {
    mockScreen(
      { kind: 'ended', isFeedbackPromptShown: false },
      { progress: progress({ status: 'ended' }), activeShowdown: null },
    );
    render(<DisplayPage />);

    expect(screen.getByText(/quiz complete/i)).toBeInTheDocument();
    expect(screen.queryByText('SHOWDOWN TIEBREAKER')).not.toBeInTheDocument();
  });

  describe('the feedback prompt', () => {
    const breakIntroState = {
      progress: progress({ status: 'break_intro', roundIndex: 1 }),
      blockQuestions: [],
      quizStructure: breakAfterRoundTwo,
    };

    it('shows "Rate the rounds on your phone" on the break card when the flag is true', () => {
      mockScreen(
        { kind: 'break_intro', roundIndex: 1, isFeedbackPromptShown: true },
        breakIntroState,
      );
      render(<DisplayPage />);

      expect(
        screen.getByText('Rate the rounds on your phone ★'),
      ).toBeInTheDocument();
    });

    it('draws no prompt on the break card when the flag is false', () => {
      mockScreen(
        { kind: 'break_intro', roundIndex: 1, isFeedbackPromptShown: false },
        breakIntroState,
      );
      render(<DisplayPage />);

      expect(screen.queryByText(/on your phone/i)).not.toBeInTheDocument();
    });

    it('shows "Tell us what you thought" on the final screen when the flag is true', () => {
      mockScreen(
        { kind: 'ended', isFeedbackPromptShown: true },
        { progress: progress({ status: 'ended' }), activeShowdown: null },
      );
      render(<DisplayPage />);

      expect(
        screen.getByText('Tell us what you thought — on your phone'),
      ).toBeInTheDocument();
    });

    it('draws no prompt on the final screen when the flag is false', () => {
      mockScreen(
        { kind: 'ended', isFeedbackPromptShown: false },
        { progress: progress({ status: 'ended' }), activeShowdown: null },
      );
      render(<DisplayPage />);

      expect(screen.queryByText(/on your phone/i)).not.toBeInTheDocument();
    });
  });

  it('draws nothing for a question screen with no current question yet', () => {
    mockScreen(
      { kind: 'question', roundIndex: 0, questionIndex: 0, questionId: null },
      {
        progress: progress({ status: 'question_open' }),
        currentQuestion: null,
      },
    );

    expect(() => render(<DisplayPage />)).not.toThrow();
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it('draws nothing for a locking screen with no lock deadline yet', () => {
    mockScreen(
      { kind: 'locking', roundIndex: 0, questionIndex: 0, questionId: 1 },
      {
        progress: progress({ status: 'locking' }),
        currentQuestion: question,
        questionLockAt: null,
      },
    );

    expect(() => render(<DisplayPage />)).not.toThrow();
    expect(screen.queryByText(/lock/i)).not.toBeInTheDocument();
  });
});
