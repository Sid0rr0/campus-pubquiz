import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
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

  it('renders a question with an image mediaUrl as an image', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Which landmark is shown?',
                mediaUrl: 'https://example.com/landmark.jpg',
                points: 3,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const image = screen.getByTestId('question-image');
    expect(image).toHaveAttribute('src', 'https://example.com/landmark.jpg');
    expect(screen.queryByTestId('question-audio')).not.toBeInTheDocument();
  });

  it('renders an audio question as an autoplaying audio player, not an image', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'audio',
                prompt: 'Name this song.',
                mediaUrl: 'https://example.com/song.mp3',
                points: 3,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
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

  it('renders media_url on a multiple_choice/free_text question too, not just audio', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'multiple_choice',
                prompt: 'Which flag is this?',
                mediaUrl: 'https://example.com/flag.jpg',
                options: ['France', 'Italy'],
                points: 2,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
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
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Name this music video.',
                mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
                mediaStartSeconds: 82,
                mediaEndSeconds: 140,
                points: 3,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
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

  it('does not autoplay an audio question when the session disables autoplayMedia', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'audio',
                prompt: 'Name this song.',
                mediaUrl: 'https://example.com/song.mp3',
                points: 3,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
        settings: { autoplayMedia: false },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const audio = screen.getByTestId('question-audio');
    expect(audio).toHaveAttribute('src', 'https://example.com/song.mp3');
    expect(audio).not.toHaveAttribute('autoplay');
  });

  it('sets the YouTube embed autoplay param to 0 when the session disables autoplayMedia', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Name this music video.',
                mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
                points: 3,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
        settings: { autoplayMedia: false },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('question-youtube')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&controls=0&modestbranding=1',
    );
  });

  it('keeps the same YouTube iframe element when toggling media fullscreen, so playback continues instead of restarting', () => {
    const openQuestion = {
      type: 'free_text' as const,
      prompt: 'Name this music video.',
      mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
      points: 3,
    };
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [openQuestion] }],
        progress: {
          status: 'question_open',
          isMediaFullscreen: false,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    const { rerender } = render(<DisplayPage />);
    const iframeBeforeToggle = screen.getByTestId('question-youtube');

    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [openQuestion] }],
        progress: {
          status: 'question_open',
          isMediaFullscreen: true,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    rerender(<DisplayPage />);

    expect(screen.getByTestId('question-youtube')).toBe(iframeBeforeToggle);
  });

  it('remounts the YouTube iframe when mediaReplayToken changes, restarting playback', () => {
    const openQuestion = {
      type: 'free_text' as const,
      prompt: 'Name this music video.',
      mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
      points: 3,
    };
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [openQuestion] }],
        progress: { status: 'question_open', mediaReplayToken: 1 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    const { rerender } = render(<DisplayPage />);
    const iframeBeforeReplay = screen.getByTestId('question-youtube');

    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [openQuestion] }],
        progress: { status: 'question_open', mediaReplayToken: 2 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    rerender(<DisplayPage />);

    expect(screen.getByTestId('question-youtube')).not.toBe(iframeBeforeReplay);
  });
});
