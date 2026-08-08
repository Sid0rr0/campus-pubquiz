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

describe('DisplayPage — media rendering', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('renders a picture question as an image', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r2q1',
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          points: 3,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const image = screen.getByTestId('question-image');
    expect(image).toHaveAttribute('src', 'https://example.com/landmark.jpg');
    expect(screen.queryByTestId('question-audio')).not.toBeInTheDocument();
  });

  it('renders an audio question as an autoplaying audio player, not an image', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r2q2',
          type: 'audio',
          prompt: 'Name this song.',
          mediaUrl: 'https://example.com/song.mp3',
          points: 3,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const audio = screen.getByTestId('question-audio');
    expect(audio).toHaveAttribute('src', 'https://example.com/song.mp3');
    expect(audio).toHaveAttribute('autoplay');
    expect(audio).toHaveAttribute('controls');
    expect(screen.queryByTestId('question-image')).not.toBeInTheDocument();
  });

  it('renders media_url on a multiple_choice/free_text question too, not just picture/audio', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r3q1',
          type: 'multiple_choice',
          prompt: 'Which flag is this?',
          mediaUrl: 'https://example.com/flag.jpg',
          options: ['France', 'Italy'],
          points: 2,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('question-image')).toHaveAttribute(
      'src',
      'https://example.com/flag.jpg',
    );
  });

  it('renders a YouTube media_url as an embedded iframe with the clip start/end, not an image', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r4q1',
          type: 'picture',
          prompt: 'Name this music video.',
          mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
          mediaStartSeconds: 82,
          mediaEndSeconds: 140,
          points: 3,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const iframe = screen.getByTestId('question-youtube');
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0&modestbranding=1&start=82&end=140',
    );
    expect(screen.queryByTestId('question-image')).not.toBeInTheDocument();
  });
});
