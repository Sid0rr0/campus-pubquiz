import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QuestionDisplay,
  type QuestionDisplayQuestion,
} from '@/app/display/question-display';

// The vitest config turns iframe page loading off, so happy-dom logs a
// NotSupportedError each time a YouTube embed mounts; drop only that.
const IFRAME_LOADING_DISABLED = 'Iframe page loading is disabled';
const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

const YOUTUBE: QuestionDisplayQuestion = {
  type: 'free_text',
  prompt: 'Name this video.',
  mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
};
const AUDIO: QuestionDisplayQuestion = {
  type: 'free_text',
  prompt: 'Name this song.',
  mediaUrl: 'https://example.com/song.mp3',
};
const VIDEO: QuestionDisplayQuestion = {
  type: 'free_text',
  prompt: 'Name this film.',
  mediaUrl: 'https://example.com/clip.mp4',
};
const ANSWER_VIDEO: QuestionDisplayQuestion = {
  type: 'free_text',
  prompt: 'Name this film.',
  mediaUrl: 'https://example.com/poster.jpg',
  answerMediaUrl: 'https://example.com/answer.webm',
  answer: 'Alien',
};

function command(func: string): string {
  return JSON.stringify({ event: 'command', func, args: [] });
}

function show(
  question: QuestionDisplayQuestion,
  props: { isDisplaySoundMuted?: boolean; isMediaPaused?: boolean },
) {
  return (
    <QuestionDisplay
      question={question}
      mediaTestIdPrefix="question"
      {...props}
    />
  );
}

describe('big-screen mute on question media', () => {
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

  function spyOnYoutube() {
    const postMessage = vi.fn();
    vi.spyOn(
      HTMLIFrameElement.prototype,
      'contentWindow',
      'get',
    ).mockReturnValue({ postMessage } as unknown as Window);
    return postMessage;
  }

  describe('YouTube', () => {
    it('mutes and unmutes the player without pausing it or remounting', () => {
      const postMessage = spyOnYoutube();
      const { rerender } = render(
        show(YOUTUBE, { isDisplaySoundMuted: false }),
      );
      const iframe = screen.getByTestId('question-youtube');
      expect(postMessage).not.toHaveBeenCalled();

      rerender(show(YOUTUBE, { isDisplaySoundMuted: true }));
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenLastCalledWith(
        command('mute'),
        YOUTUBE_ORIGIN,
      );

      rerender(show(YOUTUBE, { isDisplaySoundMuted: false }));
      expect(postMessage).toHaveBeenLastCalledWith(
        command('unMute'),
        YOUTUBE_ORIGIN,
      );
      expect(screen.getByTestId('question-youtube')).toBe(iframe);
    });

    it('re-sends a standing mute once the embed has loaded', () => {
      const postMessage = spyOnYoutube();
      render(show(YOUTUBE, { isDisplaySoundMuted: true }));
      postMessage.mockClear();

      fireEvent.load(screen.getByTestId('question-youtube'));

      expect(postMessage).toHaveBeenCalledWith(command('mute'), YOUTUBE_ORIGIN);
    });

    it('does not send mute on load when the screen is not muted', () => {
      const postMessage = spyOnYoutube();
      render(show(YOUTUBE, { isDisplaySoundMuted: false }));

      fireEvent.load(screen.getByTestId('question-youtube'));

      expect(postMessage).not.toHaveBeenCalled();
    });

    it('leaves pause and mute independent, in either order', () => {
      const postMessage = spyOnYoutube();
      const { rerender } = render(show(YOUTUBE, {}));

      rerender(show(YOUTUBE, { isMediaPaused: true }));
      rerender(
        show(YOUTUBE, { isMediaPaused: true, isDisplaySoundMuted: true }),
      );
      rerender(
        show(YOUTUBE, { isMediaPaused: false, isDisplaySoundMuted: true }),
      );
      rerender(
        show(YOUTUBE, { isMediaPaused: false, isDisplaySoundMuted: false }),
      );

      expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
        command('pauseVideo'),
        command('mute'),
        command('playVideo'),
        command('unMute'),
      ]);
    });
  });

  describe.each([
    ['audio', AUDIO, 'question-audio'],
    ['video file', VIDEO, 'question-video'],
  ])('%s', (_name, question, testId) => {
    function element(): HTMLMediaElement {
      return screen.getByTestId(testId) as HTMLMediaElement;
    }

    it('sets muted without pausing, and unmuting reverses it', () => {
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      const { rerender } = render(
        show(question, { isDisplaySoundMuted: false }),
      );
      const media = element();
      expect(media.muted).toBe(false);

      rerender(show(question, { isDisplaySoundMuted: true }));
      expect(element().muted).toBe(true);

      rerender(show(question, { isDisplaySoundMuted: false }));
      expect(element().muted).toBe(false);
      expect(element()).toBe(media);
      expect(pause).not.toHaveBeenCalled();
    });

    it('is muted from the start when the mute is already on', () => {
      render(show(question, { isDisplaySoundMuted: true }));

      expect(element().muted).toBe(true);
    });

    it('stays muted through a pause and resume', () => {
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
        () => undefined,
      );
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { rerender } = render(
        show(question, { isDisplaySoundMuted: true }),
      );

      rerender(
        show(question, { isDisplaySoundMuted: true, isMediaPaused: true }),
      );
      expect(element().muted).toBe(true);

      rerender(
        show(question, { isDisplaySoundMuted: true, isMediaPaused: false }),
      );
      expect(element().muted).toBe(true);
    });
  });

  it('mutes media that mounts later, such as the next question', () => {
    const { rerender } = render(
      show(
        { ...YOUTUBE, mediaUrl: 'https://example.com/a.jpg' },
        {
          isDisplaySoundMuted: true,
        },
      ),
    );

    rerender(show(VIDEO, { isDisplaySoundMuted: true }));

    expect(
      (screen.getByTestId('question-video') as HTMLVideoElement).muted,
    ).toBe(true);
  });

  it('mutes a hidden video', () => {
    render(
      show({ ...VIDEO, isVideoHidden: true }, { isDisplaySoundMuted: true }),
    );

    expect(
      (screen.getByTestId('question-video') as HTMLVideoElement).muted,
    ).toBe(true);
  });

  it('mutes the reveal video-file answer', () => {
    const { rerender } = render(
      show(ANSWER_VIDEO, { isDisplaySoundMuted: false }),
    );
    expect(
      (screen.getByTestId('question-answer-video') as HTMLVideoElement).muted,
    ).toBe(false);

    rerender(show(ANSWER_VIDEO, { isDisplaySoundMuted: true }));

    expect(
      (screen.getByTestId('question-answer-video') as HTMLVideoElement).muted,
    ).toBe(true);
  });
});
