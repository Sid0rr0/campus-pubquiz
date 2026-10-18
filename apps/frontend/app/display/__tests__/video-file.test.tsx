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
