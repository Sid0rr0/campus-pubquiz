import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlockQuestionView, QuestionView } from '@campus-pubquiz/types';
import { BreakReviewScreen } from '@/app/display/break-review-screen';
import { QuestionDisplay } from '@/app/display/question-display';
import { QuestionOpenScreen } from '@/app/display/question-open-screen';

// The vitest config turns iframe page loading off, so happy-dom logs a
// NotSupportedError each time the YouTube embed mounts; drop only that.
const IFRAME_LOADING_DISABLED = 'Iframe page loading is disabled';

const QUESTION: QuestionView = {
  id: 1,
  type: 'free_text',
  prompt: 'Name this song.',
  mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
  points: 3,
};

const HIDDEN: QuestionView = { ...QUESTION, isVideoHidden: true };

const BLOCK_QUESTION: BlockQuestionView = {
  ...HIDDEN,
  roundNumber: 1,
  questionNumberInRound: 1,
  roundTitle: 'Music',
};

describe('hidden video on the big screen', () => {
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

  it('covers the mounted video while the question is asked', () => {
    render(
      <QuestionOpenScreen question={HIDDEN} answeredCount={0} totalTeams={0} />,
    );

    expect(screen.getByTestId('question-youtube')).toBeInTheDocument();
    expect(screen.getByTestId('question-video-cover')).toHaveTextContent('🎵');
  });

  it('covers the mounted video in break review', () => {
    render(<BreakReviewScreen question={BLOCK_QUESTION} />);

    expect(screen.getByTestId('break-youtube')).toBeInTheDocument();
    expect(screen.getByTestId('break-video-cover')).toBeInTheDocument();
  });

  it('uncovers the video at reveal, keeping the iframe', () => {
    render(
      <QuestionDisplay
        question={{ ...HIDDEN, answer: 'Never Gonna Give You Up' }}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(screen.getByTestId('reveal-youtube')).toBeInTheDocument();
    expect(screen.queryByTestId('reveal-video-cover')).not.toBeInTheDocument();
  });

  it('does not remount the iframe when the cover comes off at reveal', () => {
    const { rerender } = render(
      <QuestionDisplay question={HIDDEN} mediaTestIdPrefix="question" />,
    );
    const iframe = screen.getByTestId('question-youtube');

    rerender(
      <QuestionDisplay
        question={{ ...HIDDEN, answer: 'Never Gonna Give You Up' }}
        mediaTestIdPrefix="question"
      />,
    );

    expect(screen.getByTestId('question-youtube')).toBe(iframe);
    expect(
      screen.queryByTestId('question-video-cover'),
    ).not.toBeInTheDocument();
  });

  it('restarts a video that is not hidden when the answer comes in, even with the same src', () => {
    const { rerender } = render(
      <QuestionDisplay question={QUESTION} mediaTestIdPrefix="question" />,
    );
    const iframe = screen.getByTestId('question-youtube');

    rerender(
      <QuestionDisplay
        question={{ ...QUESTION, answer: 'Never Gonna Give You Up' }}
        mediaTestIdPrefix="question"
      />,
    );

    expect(screen.getByTestId('question-youtube')).not.toBe(iframe);
  });

  it('shows no cover for a video that is not hidden', () => {
    render(
      <QuestionOpenScreen
        question={QUESTION}
        answeredCount={0}
        totalTeams={0}
      />,
    );

    expect(screen.getByTestId('question-youtube')).toBeInTheDocument();
    expect(
      screen.queryByTestId('question-video-cover'),
    ).not.toBeInTheDocument();
  });
});
