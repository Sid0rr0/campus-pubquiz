import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// The vitest config turns iframe page loading off, so happy-dom logs a
// NotSupportedError each time the YouTube embed mounts. That is expected here
// (the specs only inspect the iframe element), so drop exactly that message
// and let every other console.error through.
const IFRAME_LOADING_DISABLED = 'Iframe page loading is disabled';

function isIframeLoadingDisabledError(args: readonly unknown[]): boolean {
  const [first] = args;
  const message = first instanceof Error ? first.message : String(first);
  return message.includes(IFRAME_LOADING_DISABLED);
}

describe('DisplayPage — media rendering', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    const originalConsoleError = console.error.bind(console);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (isIframeLoadingDisabledError(args)) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
                type: 'free_text',
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
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0&modestbranding=1&enablejsapi=1&start=82&end=140',
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
                type: 'free_text',
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
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&controls=0&modestbranding=1&enablejsapi=1',
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

  it('remounts a YouTube answer at reveal when mediaReplayToken changes', () => {
    const revealQuestion = {
      type: 'free_text' as const,
      prompt: 'Name this music video.',
      answer: 'Never Gonna Give You Up',
      answerMediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
      points: 3,
    };
    function showReveal(mediaReplayToken: number) {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          rounds: [{ questions: [revealQuestion] }],
          progress: { status: 'reveal', revealIndex: 0, mediaReplayToken },
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
    }
    showReveal(1);
    const { rerender } = render(<DisplayPage />);
    const iframeBeforeReplay = screen.getByTestId('reveal-answer-youtube');

    showReveal(2);
    rerender(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-youtube')).not.toBe(
      iframeBeforeReplay,
    );
  });

  describe('media pause', () => {
    const youtubeQuestion = {
      type: 'free_text' as const,
      prompt: 'Name this music video.',
      mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
      points: 3,
    };
    const audioQuestion = {
      type: 'free_text' as const,
      prompt: 'Name this song.',
      mediaUrl: 'https://example.com/song.mp3',
      points: 3,
    };

    function showQuestion(
      question: typeof youtubeQuestion | typeof audioQuestion,
      isMediaPaused?: boolean,
    ) {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          rounds: [{ questions: [question] }],
          progress: { status: 'question_open', isMediaPaused },
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
    }

    function spyOnYoutubeCommands() {
      const postMessage = vi.fn();
      vi.spyOn(
        HTMLIFrameElement.prototype,
        'contentWindow',
        'get',
      ).mockReturnValue({ postMessage } as unknown as Window);
      return postMessage;
    }

    function commandMessage(func: string): string {
      return JSON.stringify({ event: 'command', func, args: [] });
    }

    it('enables the YouTube JS API on the question iframe so it can be paused', () => {
      showQuestion(youtubeQuestion);
      render(<DisplayPage />);

      expect(
        screen.getByTestId('question-youtube').getAttribute('src'),
      ).toContain('enablejsapi=1');
    });

    it('pauses and resumes the YouTube player without remounting the iframe', () => {
      const postMessage = spyOnYoutubeCommands();
      showQuestion(youtubeQuestion, false);
      const { rerender } = render(<DisplayPage />);
      const iframe = screen.getByTestId('question-youtube');
      expect(postMessage).not.toHaveBeenCalled();

      showQuestion(youtubeQuestion, true);
      rerender(<DisplayPage />);
      expect(postMessage).toHaveBeenLastCalledWith(
        commandMessage('pauseVideo'),
        'https://www.youtube-nocookie.com',
      );

      showQuestion(youtubeQuestion, false);
      rerender(<DisplayPage />);
      expect(postMessage).toHaveBeenLastCalledWith(
        commandMessage('playVideo'),
        'https://www.youtube-nocookie.com',
      );
      expect(screen.getByTestId('question-youtube')).toBe(iframe);
    });

    it('pauses a YouTube player that loads while the game is already paused (reconnect)', () => {
      const postMessage = spyOnYoutubeCommands();
      showQuestion(youtubeQuestion, true);
      render(<DisplayPage />);

      fireEvent.load(screen.getByTestId('question-youtube'));

      expect(postMessage).toHaveBeenCalledWith(
        commandMessage('pauseVideo'),
        'https://www.youtube-nocookie.com',
      );
    });

    describe('video file', () => {
      const videoQuestion = {
        type: 'free_text' as const,
        prompt: 'Name this film.',
        mediaUrl: 'https://example.com/clip.mp4',
        points: 3,
      };

      function showVideo(progress: Record<string, unknown>) {
        mockUseGame.mockReturnValue({
          snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
            rounds: [{ questions: [videoQuestion] }],
            progress: { status: 'question_open', ...progress },
          }),
          connectionError: null,
          sendAction: vi.fn(),
        });
      }

      it('pauses and resumes the <video> without remounting it', () => {
        const pause = vi
          .spyOn(HTMLMediaElement.prototype, 'pause')
          .mockImplementation(() => undefined);
        const play = vi
          .spyOn(HTMLMediaElement.prototype, 'play')
          .mockResolvedValue(undefined);
        showVideo({ isMediaPaused: false });
        const { rerender } = render(<DisplayPage />);
        const video = screen.getByTestId('question-video');
        expect(pause).not.toHaveBeenCalled();

        showVideo({ isMediaPaused: true });
        rerender(<DisplayPage />);
        expect(pause).toHaveBeenCalledTimes(1);

        showVideo({ isMediaPaused: false });
        rerender(<DisplayPage />);
        expect(play).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('question-video')).toBe(video);
      });

      it('ignores a rejected play() when resuming', async () => {
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
          () => undefined,
        );
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
          new Error('NotAllowedError'),
        );
        showVideo({ isMediaPaused: true });
        const { rerender } = render(<DisplayPage />);

        showVideo({ isMediaPaused: false });
        rerender(<DisplayPage />);
        await Promise.resolve();

        expect(screen.getByTestId('question-video')).toBeTruthy();
      });

      it('honours a standing pause once the video has loaded', () => {
        const pause = vi
          .spyOn(HTMLMediaElement.prototype, 'pause')
          .mockImplementation(() => undefined);
        showVideo({ isMediaPaused: true });
        render(<DisplayPage />);
        pause.mockClear();

        fireEvent.loadedMetadata(screen.getByTestId('question-video'));

        expect(pause).toHaveBeenCalledTimes(1);
      });

      it('seeks to the start and plays on mediaReplayToken change, without remounting', () => {
        const play = vi
          .spyOn(HTMLMediaElement.prototype, 'play')
          .mockResolvedValue(undefined);
        showVideo({ mediaReplayToken: 1 });
        const { rerender } = render(<DisplayPage />);
        const video = screen.getByTestId('question-video') as HTMLVideoElement;
        video.currentTime = 42;
        expect(play).not.toHaveBeenCalled();

        showVideo({ mediaReplayToken: 2 });
        rerender(<DisplayPage />);

        expect(video.currentTime).toBe(0);
        expect(play).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('question-video')).toBe(video);
      });

      it('keeps the same <video> element when toggling media fullscreen', () => {
        showVideo({ isMediaFullscreen: false });
        const { rerender } = render(<DisplayPage />);
        const video = screen.getByTestId('question-video');

        showVideo({ isMediaFullscreen: true });
        rerender(<DisplayPage />);

        expect(screen.getByTestId('question-video')).toBe(video);
      });
    });

    it('pauses and resumes an audio player', () => {
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      showQuestion(audioQuestion, false);
      const { rerender } = render(<DisplayPage />);
      expect(pause).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();

      showQuestion(audioQuestion, true);
      rerender(<DisplayPage />);
      expect(pause).toHaveBeenCalledTimes(1);

      showQuestion(audioQuestion, false);
      rerender(<DisplayPage />);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it('pauses an audio player that mounts while the game is already paused (reconnect)', () => {
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      showQuestion(audioQuestion, true);
      render(<DisplayPage />);

      expect(pause).toHaveBeenCalled();
    });
  });
});
