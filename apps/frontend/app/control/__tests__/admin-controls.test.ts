import { describe, expect, it } from 'vitest';
import type { AdminStatePayload } from '@campus-pubquiz/types';
import { getAdminControls } from '@/app/control/admin-controls';

function viewWith(
  status: string,
  mediaUrl?: string,
): Parameters<typeof getAdminControls>[0] {
  return {
    progress: { status },
    currentQuestion: mediaUrl ? { mediaUrl } : undefined,
    leaderboard: [],
    onAirScreen: { kind: 'question' },
    revealQuestions: [],
  } as unknown as Pick<
    AdminStatePayload,
    | 'progress'
    | 'currentQuestion'
    | 'leaderboard'
    | 'onAirScreen'
    | 'revealQuestions'
  >;
}

function revealViewWith(
  question: Record<string, unknown>,
  onAirQuestionId: number | null = 7,
): Parameters<typeof getAdminControls>[0] {
  return {
    progress: { status: 'reveal' },
    currentQuestion: null,
    leaderboard: [],
    onAirScreen: { kind: 'reveal', roundIndex: 0, questionId: onAirQuestionId },
    revealQuestions: [
      { id: 6, revealKind: 'answer', answerMediaUrl: 'https://youtu.be/other' },
      { id: 7, revealKind: 'answer', ...question },
    ],
  } as unknown as Parameters<typeof getAdminControls>[0];
}

describe('getAdminControls — at reveal', () => {
  it.each([
    ['YouTube', 'https://youtu.be/dQw4w9WgXcQ'],
    ['an mp4 video file', 'https://example.com/clip.mp4'],
  ])('shows Play again and Pause for an answer %s', (_kind, url) => {
    const controls = getAdminControls(revealViewWith({ answerMediaUrl: url }));
    expect(controls.canReplayMedia).toBe(true);
    expect(controls.canPauseMedia).toBe(true);
  });

  it('shows Pause but not Play again for an answer audio clip', () => {
    const controls = getAdminControls(
      revealViewWith({ answerMediaUrl: 'https://example.com/song.mp3' }),
    );
    expect(controls.canPauseMedia).toBe(true);
    expect(controls.canReplayMedia).toBe(false);
  });

  it('shows neither for an answer image', () => {
    const controls = getAdminControls(
      revealViewWith({ answerMediaUrl: 'https://example.com/flag.jpg' }),
    );
    expect(controls.canPauseMedia).toBe(false);
    expect(controls.canReplayMedia).toBe(false);
  });

  it('follows the question video when the reveal has no answer media', () => {
    const controls = getAdminControls(
      revealViewWith({ mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
    );
    expect(controls.canPauseMedia).toBe(true);
    expect(controls.canReplayMedia).toBe(true);
  });

  it('prefers the answer image over a question video that the reveal replaces', () => {
    const controls = getAdminControls(
      revealViewWith({
        mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        answerMediaUrl: 'https://example.com/flag.jpg',
      }),
    );
    expect(controls.canPauseMedia).toBe(false);
  });

  it('reads the question on air, not another in the block', () => {
    const controls = getAdminControls(revealViewWith({}, 7));
    expect(controls.canPauseMedia).toBe(false);
  });

  it('shows neither on the reveal intro or when no reveal question is on air', () => {
    const view = revealViewWith(
      { answerMediaUrl: 'https://youtu.be/dQw4w9WgXcQ' },
      null,
    );
    expect(getAdminControls(view).canPauseMedia).toBe(false);
    expect(
      getAdminControls({
        ...view,
        onAirScreen: { kind: 'reveal_intro', roundIndex: 0, questionId: 7 },
      }).canPauseMedia,
    ).toBe(false);
  });

  it('shows neither for a closest-guess reveal, whose answer media arrives mid-walk', () => {
    const view = revealViewWith({
      revealKind: 'closest_guess',
      answerMediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(getAdminControls(view).canPauseMedia).toBe(false);
  });
});

describe('getAdminControls — canPauseMedia', () => {
  it.each([
    ['YouTube', 'https://youtu.be/dQw4w9WgXcQ'],
    ['an mp3', 'https://example.com/song.mp3'],
  ])('is true for an open question with %s media', (_kind, url) => {
    expect(getAdminControls(viewWith('question_open', url)).canPauseMedia).toBe(
      true,
    );
  });

  it('is false for an image', () => {
    expect(
      getAdminControls(
        viewWith('question_open', 'https://example.com/photo.jpg'),
      ).canPauseMedia,
    ).toBe(false);
  });

  it('is false without media or when the question is not open', () => {
    expect(getAdminControls(viewWith('question_open')).canPauseMedia).toBe(
      false,
    );
    expect(
      getAdminControls(viewWith('reveal', 'https://youtu.be/dQw4w9WgXcQ'))
        .canPauseMedia,
    ).toBe(false);
  });

  it('is true for an open question with a video file', () => {
    expect(
      getAdminControls(
        viewWith('question_open', 'https://example.com/clip.mp4'),
      ).canPauseMedia,
    ).toBe(true);
  });
});

describe('getAdminControls — canReplayMedia', () => {
  it.each([
    ['YouTube', 'https://youtu.be/dQw4w9WgXcQ'],
    ['an mp4 video file', 'https://example.com/clip.mp4'],
  ])('is true for an open question with %s media', (_kind, url) => {
    expect(
      getAdminControls(viewWith('question_open', url)).canReplayMedia,
    ).toBe(true);
  });

  it.each([
    ['an mp3', 'https://example.com/song.mp3'],
    ['an image', 'https://example.com/photo.jpg'],
  ])('is false for %s', (_kind, url) => {
    expect(
      getAdminControls(viewWith('question_open', url)).canReplayMedia,
    ).toBe(false);
  });
});
