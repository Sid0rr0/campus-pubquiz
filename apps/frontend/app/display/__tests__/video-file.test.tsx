import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QuestionDisplay,
  type QuestionDisplayQuestion,
} from '@/app/display/question-display';

// The vitest config turns iframe page loading off, so happy-dom logs a
// NotSupportedError each time a YouTube embed mounts; drop only that.
const IFRAME_LOADING_DISABLED = 'Iframe page loading is disabled';

const CLIP_URL = 'https://cdn.example.com/clip.mp4';
const OTHER_CLIP_URL = 'https://cdn.example.com/answer.webm?token=1';
const YOUTUBE_URL = 'https://youtu.be/dQw4w9WgXcQ';

const BASE: QuestionDisplayQuestion = {
  type: 'free_text',
  prompt: 'Name this film.',
};

function question(
  overrides: Partial<QuestionDisplayQuestion>,
): QuestionDisplayQuestion {
  return { ...BASE, ...overrides };
}

describe('video file on the big screen', () => {
  beforeEach(() => {
    const originalConsoleError = console.error.bind(console);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [first] = args;
      const message = first instanceof Error ? first.message : String(first);
      if (message.includes(IFRAME_LOADING_DISABLED)) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an .mp4 media_url as a controls-free inline video, not an image', () => {
    render(
      <QuestionDisplay
        question={question({ mediaUrl: CLIP_URL })}
        mediaTestIdPrefix="question"
      />,
    );

    const video = screen.getByTestId('question-video');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', CLIP_URL);
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('controls');
    expect(screen.queryByTestId('question-image')).not.toBeInTheDocument();
  });

  it('does not autoplay when the session disables autoplayMedia', () => {
    render(
      <QuestionDisplay
        question={question({ mediaUrl: CLIP_URL })}
        mediaTestIdPrefix="question"
        autoplayMedia={false}
      />,
    );

    expect(screen.getByTestId('question-video')).not.toHaveAttribute(
      'autoplay',
    );
  });

  it('keeps the same video element when toggling fullscreen', () => {
    const { rerender } = render(
      <QuestionDisplay
        question={question({ mediaUrl: CLIP_URL })}
        mediaTestIdPrefix="question"
      />,
    );
    const video = screen.getByTestId('question-video');

    rerender(
      <QuestionDisplay
        question={question({ mediaUrl: CLIP_URL })}
        mediaTestIdPrefix="question"
        isFullscreen
      />,
    );

    expect(screen.getByTestId('question-video')).toBe(video);
  });

  describe('clips', () => {
    const CLIPPED = {
      mediaUrl: CLIP_URL,
      mediaStartSeconds: 82,
      mediaEndSeconds: 140,
      revealStartSeconds: 150,
      revealEndSeconds: 165,
    };

    it('carries the question clip as a media fragment while asked', () => {
      render(
        <QuestionDisplay
          question={question(CLIPPED)}
          mediaTestIdPrefix="question"
        />,
      );

      expect(screen.getByTestId('question-video')).toHaveAttribute(
        'src',
        `${CLIP_URL}#t=82,140`,
      );
    });

    it('carries the reveal clip at reveal', () => {
      render(
        <QuestionDisplay
          question={question({ ...CLIPPED, answer: 'Alien' })}
          mediaTestIdPrefix="reveal"
        />,
      );

      expect(screen.getByTestId('reveal-video')).toHaveAttribute(
        'src',
        `${CLIP_URL}#t=150,165`,
      );
    });

    it('accepts either bound alone, and no fragment when the clip is empty', () => {
      const { rerender } = render(
        <QuestionDisplay
          question={question({ mediaUrl: CLIP_URL, mediaEndSeconds: 9 })}
          mediaTestIdPrefix="question"
        />,
      );
      expect(screen.getByTestId('question-video')).toHaveAttribute(
        'src',
        `${CLIP_URL}#t=,9`,
      );

      rerender(
        <QuestionDisplay
          question={question({ mediaUrl: CLIP_URL, mediaStartSeconds: 5 })}
          mediaTestIdPrefix="question"
        />,
      );
      expect(screen.getByTestId('question-video')).toHaveAttribute(
        'src',
        `${CLIP_URL}#t=5`,
      );

      rerender(
        <QuestionDisplay
          question={question({ mediaUrl: CLIP_URL })}
          mediaTestIdPrefix="question"
        />,
      );
      expect(screen.getByTestId('question-video')).toHaveAttribute(
        'src',
        CLIP_URL,
      );
    });

    it('carries the reveal clip on a file answer video', () => {
      render(
        <QuestionDisplay
          question={question({
            mediaUrl: CLIP_URL,
            answerMediaUrl: OTHER_CLIP_URL,
            revealStartSeconds: 3,
            revealEndSeconds: 8,
            answer: 'Alien',
          })}
          mediaTestIdPrefix="reveal"
        />,
      );

      expect(screen.getByTestId('reveal-answer-video')).toHaveAttribute(
        'src',
        `${OTHER_CLIP_URL}#t=3,8`,
      );
    });
  });

  describe('hidden video', () => {
    it('covers the playing video while asked and lifts the cover at reveal without remounting', () => {
      const hidden = { mediaUrl: CLIP_URL, isVideoHidden: true as const };
      const { rerender } = render(
        <QuestionDisplay
          question={question(hidden)}
          mediaTestIdPrefix="question"
        />,
      );
      const video = screen.getByTestId('question-video');
      expect(screen.getByTestId('question-video-cover')).toBeInTheDocument();

      rerender(
        <QuestionDisplay
          question={question({ ...hidden, answer: 'Alien' })}
          mediaTestIdPrefix="question"
        />,
      );

      expect(
        screen.queryByTestId('question-video-cover'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('question-video')).toBe(video);
    });
  });

  describe('at reveal', () => {
    it('plays the question video again when there is no answer media', () => {
      const { rerender } = render(
        <QuestionDisplay
          question={question({ mediaUrl: CLIP_URL })}
          mediaTestIdPrefix="question"
        />,
      );
      const video = screen.getByTestId('question-video');

      rerender(
        <QuestionDisplay
          question={question({ mediaUrl: CLIP_URL, answer: 'Alien' })}
          mediaTestIdPrefix="question"
        />,
      );

      expect(screen.getByTestId('question-video')).not.toBe(video);
    });

    it('replaces a file question video with a file answer video', () => {
      render(
        <QuestionDisplay
          question={question({
            mediaUrl: CLIP_URL,
            answerMediaUrl: OTHER_CLIP_URL,
            answer: 'Alien',
          })}
          mediaTestIdPrefix="reveal"
        />,
      );

      expect(screen.queryByTestId('reveal-video')).not.toBeInTheDocument();
      expect(screen.getByTestId('reveal-answer-video')).toHaveAttribute(
        'src',
        OTHER_CLIP_URL,
      );
    });

    it('replaces a YouTube question video with a file answer video', () => {
      render(
        <QuestionDisplay
          question={question({
            mediaUrl: YOUTUBE_URL,
            answerMediaUrl: CLIP_URL,
            answer: 'Alien',
          })}
          mediaTestIdPrefix="reveal"
        />,
      );

      expect(screen.queryByTestId('reveal-youtube')).not.toBeInTheDocument();
      expect(screen.getByTestId('reveal-answer-video')).toBeInTheDocument();
    });

    it('replaces a file question video with a YouTube answer video', () => {
      render(
        <QuestionDisplay
          question={question({
            mediaUrl: CLIP_URL,
            answerMediaUrl: YOUTUBE_URL,
            answer: 'Alien',
          })}
          mediaTestIdPrefix="reveal"
        />,
      );

      expect(screen.queryByTestId('reveal-video')).not.toBeInTheDocument();
      expect(screen.getByTestId('reveal-answer-youtube')).toBeInTheDocument();
    });

    it('keeps the side-by-side layout for an image question with a file answer video', () => {
      render(
        <QuestionDisplay
          question={question({
            mediaUrl: 'https://example.com/poster.jpg',
            answerMediaUrl: CLIP_URL,
            answer: 'Alien',
          })}
          mediaTestIdPrefix="reveal"
        />,
      );

      expect(screen.getByTestId('reveal-image')).toBeInTheDocument();
      expect(screen.getByTestId('reveal-answer-video')).toBeInTheDocument();
    });
  });

  describe('pause and play again', () => {
    const REVEAL_CLIPPED = {
      mediaUrl: CLIP_URL,
      mediaStartSeconds: 82,
      mediaEndSeconds: 140,
      revealStartSeconds: 150,
      revealEndSeconds: 165,
      answer: 'Alien',
    };
    const ANSWER_VIDEO = {
      mediaUrl: 'https://example.com/poster.jpg',
      answerMediaUrl: OTHER_CLIP_URL,
      revealStartSeconds: 3,
      revealEndSeconds: 8,
      answer: 'Alien',
    };

    function renderWith(
      overrides: Partial<QuestionDisplayQuestion>,
      props: { mediaReplayToken?: number; isMediaPaused?: boolean },
    ) {
      return (
        <QuestionDisplay
          question={question(overrides)}
          mediaTestIdPrefix="reveal"
          {...props}
        />
      );
    }

    it('seeks the question video to the reveal clip start on play again at reveal', () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      const { rerender } = render(
        renderWith(REVEAL_CLIPPED, { mediaReplayToken: 1 }),
      );
      const video = screen.getByTestId('reveal-video') as HTMLVideoElement;
      video.currentTime = 160;

      rerender(renderWith(REVEAL_CLIPPED, { mediaReplayToken: 2 }));

      expect(video.currentTime).toBe(150);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it('seeks the question video to 0 on play again at reveal when no clip is set', () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const plain = { mediaUrl: CLIP_URL, mediaStartSeconds: 82, answer: 'A' };
      const { rerender } = render(renderWith(plain, { mediaReplayToken: 1 }));
      const video = screen.getByTestId('reveal-video') as HTMLVideoElement;
      video.currentTime = 30;

      rerender(renderWith(plain, { mediaReplayToken: 2 }));

      expect(video.currentTime).toBe(0);
    });

    it('seeks a file answer video to the reveal clip start on play again', () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      const { rerender } = render(
        renderWith(ANSWER_VIDEO, { mediaReplayToken: 1 }),
      );
      const video = screen.getByTestId(
        'reveal-answer-video',
      ) as HTMLVideoElement;
      video.currentTime = 6;

      rerender(renderWith(ANSWER_VIDEO, { mediaReplayToken: 2 }));

      expect(video.currentTime).toBe(3);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it('pauses and resumes a file answer video without remounting it', () => {
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      const { rerender } = render(
        renderWith(ANSWER_VIDEO, { isMediaPaused: false }),
      );
      const video = screen.getByTestId('reveal-answer-video');

      rerender(renderWith(ANSWER_VIDEO, { isMediaPaused: true }));
      expect(pause).toHaveBeenCalledTimes(1);

      rerender(renderWith(ANSWER_VIDEO, { isMediaPaused: false }));
      expect(play).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('reveal-answer-video')).toBe(video);
    });

    it('keeps a file answer video paused once it has loaded under a standing pause', () => {
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      render(renderWith(ANSWER_VIDEO, { isMediaPaused: true }));
      pause.mockClear();

      fireEvent.loadedMetadata(screen.getByTestId('reveal-answer-video'));

      expect(pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('load failure', () => {
    it('removes a question video that errors, keeping the prompt', () => {
      render(
        <QuestionDisplay
          question={question({ mediaUrl: CLIP_URL })}
          mediaTestIdPrefix="question"
        />,
      );

      fireEvent.error(screen.getByTestId('question-video'));

      expect(screen.queryByTestId('question-video')).not.toBeInTheDocument();
      expect(screen.getByText('Name this film.')).toBeInTheDocument();
    });

    it('removes an answer video that errors, keeping the answer', () => {
      render(
        <QuestionDisplay
          question={question({
            mediaUrl: 'https://example.com/poster.jpg',
            answerMediaUrl: CLIP_URL,
            answer: 'Alien',
          })}
          mediaTestIdPrefix="reveal"
        />,
      );

      fireEvent.error(screen.getByTestId('reveal-answer-video'));

      expect(
        screen.queryByTestId('reveal-answer-video'),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Name this film.')).toBeInTheDocument();
    });
  });
});
