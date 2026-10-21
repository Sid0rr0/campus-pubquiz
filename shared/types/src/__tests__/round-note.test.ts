import { describe, expect, it } from 'vitest';
import { getDisplayRoundNote, getRoundNoteOnAir } from '../round-note';
import type { OnAirScreen } from '../on-air-screen';
import type { SessionState } from '../session-state';

const session = {
  seededGame: {
    rounds: [
      { title: 'Music', note: 'Play the jingle.', showNoteOnScreen: true },
    ],
  },
} as unknown as SessionState;

describe('getRoundNoteOnAir', () => {
  const noted: OnAirScreen[] = [
    { kind: 'round_title', roundIndex: 0 },
    { kind: 'break_round_title', roundIndex: 0, questionId: null },
    { kind: 'reveal_intro', roundIndex: 0, questionId: null },
  ];

  it.each(noted)('gives the round note on $kind', (screen) => {
    expect(getRoundNoteOnAir(session, screen)).toBe('Play the jingle.');
  });

  it.each([
    { kind: 'break_round_title', roundIndex: null, questionId: null },
    { kind: 'reveal_intro', roundIndex: null, questionId: null },
  ] as OnAirScreen[])('gives null on $kind with no round', (screen) => {
    expect(getRoundNoteOnAir(session, screen)).toBeNull();
  });

  it('gives null on a question', () => {
    expect(
      getRoundNoteOnAir(session, {
        kind: 'question',
        roundIndex: 0,
        questionIndex: 0,
        questionId: 1,
      }),
    ).toBeNull();
  });

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
