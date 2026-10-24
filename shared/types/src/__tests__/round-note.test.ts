import { describe, expect, it } from 'vitest';
import { getDisplayRoundNote, getHostOnlyText } from '../round-note';
import type { SeededRound, SessionState } from '../session-state';

const session = {
  seededGame: {
    rounds: [
      { title: 'Music', note: 'Play the jingle.', showNoteOnScreen: true },
      { title: 'Film', note: 'Host only.', showNoteOnScreen: false },
      { title: 'Quiet', showNoteOnScreen: true },
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

  it('puts the note on the break round intro too', () => {
    expect(
      getDisplayRoundNote(session, {
        kind: 'break_round_title',
        roundIndex: 0,
        questionId: null,
      }),
    ).toBe('Play the jingle.');
  });

  it('keeps a note off the big screen when its round does not show it', () => {
    expect(
      getDisplayRoundNote(session, { kind: 'round_title', roundIndex: 1 }),
    ).toBe('');
  });
});

describe('getDisplayRoundNote without a note', () => {
  it('is empty for a round that shows its note but has none', () => {
    expect(
      getDisplayRoundNote(session, { kind: 'round_title', roundIndex: 2 }),
    ).toBe('');
  });
});

describe('getHostOnlyText', () => {
  const rounds = [
    { title: 'Music', note: 'Play the jingle.' },
    { title: 'Film', questionNotesById: { 7: 'Pause at the title card.' } },
  ] as unknown as SeededRound[];

  it('finds a question note in whichever round holds it', () => {
    expect(
      getHostOnlyText(rounds, {
        kind: 'question',
        roundIndex: 1,
        questionIndex: 0,
        questionId: 7,
      }).questionNotes,
    ).toBe('Pause at the title card.');
  });

  it('is empty for a round intro that points at no round in the quiz', () => {
    expect(
      getHostOnlyText(rounds, { kind: 'round_title', roundIndex: 5 }),
    ).toEqual({ roundNote: '', questionNotes: '' });
  });
});
