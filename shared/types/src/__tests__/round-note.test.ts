import { describe, expect, it } from 'vitest';
import { getDisplayRoundNote } from '../round-note';
import type { SessionState } from '../session-state';

const session = {
  seededGame: {
    rounds: [
      { title: 'Music', note: 'Play the jingle.', showNoteOnScreen: true },
    ],
  },
} as unknown as SessionState;

describe('getDisplayRoundNote', () => {
  it('never puts the note on the big screen on the reveal intro', () => {
    expect(
      getDisplayRoundNote(session, {
        kind: 'reveal_intro',
        roundIndex: 0,
        questionId: null,
      }),
    ).toBe('');
    expect(
      getDisplayRoundNote(session, { kind: 'round_title', roundIndex: 0 }),
    ).toBe('Play the jingle.');
  });
});
