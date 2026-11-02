import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionView } from '@campus-pubquiz/types';
import { ClosestGuessRevealScreen } from '@/app/components/closest-guess-reveal-screen';
import { QuestionDisplay } from '@/app/display/question-display';

const QUESTION_IMAGE = 'https://example.com/question.png';
const ANSWER_IMAGE = 'https://example.com/answer.png';
const ANSWER_SOUND = 'https://example.com/answer.mp3';
const ANSWER_VIDEO = 'https://youtu.be/dQw4w9WgXcQ';

const QUESTION: QuestionView = {
  id: 1,
  type: 'free_text',
  prompt: 'Whose flag is this?',
  points: 3,
};

function isRaised(testId: string): boolean {
  return screen.getByTestId(testId).closest('.fixed.inset-0') !== null;
}

function renderReveal(
  fields: Partial<QuestionView> & { answerMediaUrl?: string },
  isFullscreen = true,
) {
  return (
    <QuestionDisplay
      question={{ ...QUESTION, answer: 'France', ...fields }}
      mediaTestIdPrefix="reveal"
      isFullscreen={isFullscreen}
    />
  );
}

describe('fullscreen at reveal', () => {
  beforeEach(() => {
    const originalConsoleError = console.error.bind(console);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [first] = args;
      const message = first instanceof Error ? first.message : String(first);
      if (message.includes('Iframe page loading is disabled')) return;
      originalConsoleError(...args);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('raises the answer image when it is the only image', () => {
    render(renderReveal({ answerMediaUrl: ANSWER_IMAGE }));

    expect(isRaised('reveal-answer-image')).toBe(true);
  });

  it('raises the answer image, not the question image, when there are both', () => {
    render(
      renderReveal({ mediaUrl: QUESTION_IMAGE, answerMediaUrl: ANSWER_IMAGE }),
    );

    expect(isRaised('reveal-answer-image')).toBe(true);
    expect(isRaised('reveal-image')).toBe(false);
  });

  it('keeps the answer image element when fullscreen is toggled', () => {
    const fields = { answerMediaUrl: ANSWER_IMAGE };
    const { rerender } = render(renderReveal(fields, false));
    const image = screen.getByTestId('reveal-answer-image');
    expect(isRaised('reveal-answer-image')).toBe(false);

    rerender(renderReveal(fields, true));

    expect(screen.getByTestId('reveal-answer-image')).toBe(image);
    expect(isRaised('reveal-answer-image')).toBe(true);
  });

  it('raises the question image beside a sound answer, keeping the sound', () => {
    render(
      renderReveal({ mediaUrl: QUESTION_IMAGE, answerMediaUrl: ANSWER_SOUND }),
    );

    expect(isRaised('reveal-image')).toBe(true);
    expect(screen.getByTestId('reveal-answer-audio')).toBeInTheDocument();
  });

  it('keeps an answer video playing when fullscreen is toggled beside a portrait question image', () => {
    const asked = (
      <QuestionDisplay
        question={{ ...QUESTION, mediaUrl: QUESTION_IMAGE }}
        mediaTestIdPrefix="reveal"
      />
    );
    const { rerender } = render(asked);
    const image = screen.getByTestId('reveal-image');
    Object.defineProperty(image, 'naturalWidth', { value: 600 });
    Object.defineProperty(image, 'naturalHeight', { value: 900 });
    fireEvent.load(image);
    const fields = { mediaUrl: QUESTION_IMAGE, answerMediaUrl: ANSWER_VIDEO };
    rerender(renderReveal(fields, false));
    const iframe = screen.getByTestId('reveal-answer-youtube');

    rerender(renderReveal(fields, true));

    expect(screen.getByTestId('reveal-answer-youtube')).toBe(iframe);
    expect(isRaised('reveal-answer-youtube')).toBe(true);
  });
});

describe('closest-guess answer media', () => {
  const closestGuess = {
    minGuess: null,
    maxGuess: null,
    closestGuesses: [],
  } as unknown as Parameters<
    typeof ClosestGuessRevealScreen
  >[0]['closestGuess'];

  function renderScreen(props: {
    mediaReplayToken?: number;
    isMediaPaused?: boolean;
  }) {
    return (
      <ClosestGuessRevealScreen
        prompt="How tall?"
        correctAnswer="42"
        answerMediaUrl={ANSWER_SOUND}
        closestGuess={closestGuess}
        mediaTestIdPrefix="reveal"
        {...props}
      />
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replays and pauses the answer sound', () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const { rerender } = render(renderScreen({ mediaReplayToken: 0 }));
    const audio = screen.getByTestId<HTMLAudioElement>('reveal-answer-audio');
    audio.currentTime = 30;

    rerender(renderScreen({ mediaReplayToken: 1 }));

    expect(audio.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);

    rerender(renderScreen({ mediaReplayToken: 1, isMediaPaused: true }));

    expect(pause).toHaveBeenCalledTimes(1);
  });
});
