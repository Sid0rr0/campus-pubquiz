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
  } as unknown as Pick<
    AdminStatePayload,
    'progress' | 'currentQuestion' | 'leaderboard'
  >;
}

describe('getAdminControls — canPauseMedia', () => {
  it.each([
    ['YouTube', 'https://youtu.be/dQw4w9WgXcQ'],
    ['audio', 'https://example.com/song.mp3'],
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

  it('keeps canReplayMedia YouTube-only', () => {
    expect(
      getAdminControls(
        viewWith('question_open', 'https://example.com/song.mp3'),
      ).canReplayMedia,
    ).toBe(false);
  });
});
