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
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg role="img" aria-label={title} data-testid="qr-code" data-value={value} />
  ),
}));

const revealQuestions = [
  {
    id: 'r1q1',
    type: 'multiple_choice' as const,
    prompt: 'Capital of France?',
    options: ['Paris', 'London'],
    points: 2,
    answer: 'Paris',
    roundNumber: 1,
    questionNumberInRound: 1,
  },
  {
    id: 'r1q2',
    type: 'free_text' as const,
    prompt: 'Largest planet?',
    points: 2,
    answer: 'Jupiter',
    roundNumber: 1,
    questionNumberInRound: 2,
  },
];

describe('DisplayPage — reveal', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
  });

  it('shows the current reveal question with its correct answer, same layout as when it was asked', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
        revealQuestions,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);
    expect(screen.getByText('London')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.queryByText('Largest planet?')).not.toBeInTheDocument();
  });

  it('shows the second reveal question when revealIndex advances', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 1 }),
        currentQuestion: null,
        revealQuestions,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Largest planet?')).toBeInTheDocument();
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
    expect(screen.getByText(/round 1.*question 2/i)).toBeInTheDocument();
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it('shows media for picture and audio reveal questions', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
        revealQuestions: [
          {
            id: 'r2q1',
            type: 'picture',
            prompt: 'Which landmark?',
            mediaUrl: 'https://example.com/landmark.jpg',
            points: 3,
            answer: 'Eiffel Tower',
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-image')).toHaveAttribute(
      'src',
      'https://example.com/landmark.jpg',
    );
  });

  it('shows only answer_media_url on reveal when a question has both it and its own media_url', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
        revealQuestions: [
          {
            id: 'r2q1',
            type: 'picture',
            prompt: 'Which landmark?',
            mediaUrl: 'https://example.com/landmark.jpg',
            points: 3,
            answer: 'Eiffel Tower',
            answerMediaUrl: 'https://example.com/eiffel-plaque.jpg',
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-image')).toHaveAttribute(
      'src',
      'https://example.com/eiffel-plaque.jpg',
    );
    expect(screen.queryByTestId('reveal-image')).not.toBeInTheDocument();
  });

  it('shows an answer_media_url image on reveal for a free_text question, independent of type', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
        revealQuestions: [
          {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name this flag.',
            points: 3,
            answer: 'France',
            answerMediaUrl: 'https://example.com/france-flag.jpg',
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-image')).toHaveAttribute(
      'src',
      'https://example.com/france-flag.jpg',
    );
  });

  it('renders an answer_media_url ending in an audio extension as audio, not an image', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
        revealQuestions: [
          {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name this flag.',
            points: 3,
            answer: 'France',
            answerMediaUrl: 'https://example.com/anthem.mp3',
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-audio')).toHaveAttribute(
      'src',
      'https://example.com/anthem.mp3',
    );
    expect(screen.queryByTestId('reveal-answer-image')).not.toBeInTheDocument();
  });
});
