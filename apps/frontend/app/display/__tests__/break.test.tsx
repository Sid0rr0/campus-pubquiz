import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { progress } from './test-utils';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg
      role="img"
      aria-label={title}
      data-testid="qr-code"
      data-value={value}
    />
  ),
}));

// roundIndex 1 (round "2") is this fixture's only break — breakRoundNumbers
// is what getBreakNumber (display/page.tsx) reads to number "BREAK N".
const breakAfterRoundTwo = {
  blockCount: 1,
  topicsPerBlock: 2,
  breakRoundNumbers: [2],
  minQuestionsPerTopic: 1,
  maxQuestionsPerTopic: 1,
};

describe('DisplayPage — break', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows a "BREAK" title card once a round locks (break_intro)', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break_intro', roundIndex: 1 }),
        currentQuestion: null,
        quizStructure: breakAfterRoundTwo,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
  });

  const twoQuestionBlock = [
    {
      id: 23,
      type: 'picture' as const,
      prompt: 'Which landmark?',
      mediaUrl: 'https://example.com/landmark.jpg',
      points: 3,
      roundNumber: 2,
      questionNumberInRound: 1,
      roundTitle: 'World Landmarks',
    },
    {
      id: 24,
      type: 'free_text' as const,
      prompt: 'Name this flag.',
      points: 3,
      roundNumber: 2,
      questionNumberInRound: 2,
      roundTitle: 'World Landmarks',
    },
  ];

  it('keeps showing the generic BREAK card for break_intro even once block questions have loaded, never showing Q5 itself', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'break_intro',
          roundIndex: 1,
          revealIndex: 1,
        }),
        currentQuestion: null,
        blockQuestions: twoQuestionBlock,
        quizStructure: breakAfterRoundTwo,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
    expect(screen.queryByText('Name this flag.')).not.toBeInTheDocument();
  });

  it("shows the block's last question (no answer) immediately once break proper is entered (Previous from break_intro), without skipping it", () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        // revealIndex 1 is the last index of a 2-question block: the one
        // that just locked — it must show its own content, not a generic
        // card, so Previous steps to the second-to-last question next.
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 1 }),
        currentQuestion: null,
        blockQuestions: twoQuestionBlock,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Name this flag.')).toBeInTheDocument();
    expect(screen.queryByText('BREAK')).not.toBeInTheDocument();
  });

  it("shows the specific question (no answer) once Previous walks revealIndex off the entry position, matching question_open's layout", () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 0 }),
        currentQuestion: null,
        blockQuestions: twoQuestionBlock,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Which landmark?')).toBeInTheDocument();
    expect(screen.queryByText('Name this flag.')).not.toBeInTheDocument();
    expect(screen.queryByText('BREAK')).not.toBeInTheDocument();
    expect(screen.queryByText(/answer/i)).not.toBeInTheDocument();
  });

  it("shows the round's own title card once Previous crosses a round boundary during break review", () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'break_round_intro',
          roundIndex: 1,
          revealIndex: 0,
        }),
        currentQuestion: null,
        blockQuestions: twoQuestionBlock,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('World Landmarks')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.queryByText('Which landmark?')).not.toBeInTheDocument();
    expect(screen.queryByText('BREAK')).not.toBeInTheDocument();
  });
});
