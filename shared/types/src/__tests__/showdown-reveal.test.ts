import { describe, expect, it } from 'vitest';
import type { ActiveShowdownRoundState } from '../session-state';
import {
  buildActiveShowdownView,
  showdownRevealDescriptor,
} from '../showdown-reveal';

/** The participants are stored in reverse seat order: seat 2 first, then 1, then 0. */
function round(
  guesses: Record<number, string | null> = { 2: '30', 0: '10', 1: '20' },
): ActiveShowdownRoundState {
  return {
    id: 9,
    question: 'How many?',
    answer: '42',
    participants: Object.entries(guesses)
      .map(([seat, guess]) => ({
        teamId: 100 + Number(seat),
        teamName: `Team ${seat}`,
        seatIndex: Number(seat),
        guess,
      }))
      .reverse(),
    winnerTeamId: 101,
    isTie: true,
    resolved: true,
  };
}

describe('buildActiveShowdownView', () => {
  it('is null without a showdown round', () => {
    expect(buildActiveShowdownView(null, 0)).toBeNull();
  });

  it('lists the seats in seat order, whatever order they are stored in', () => {
    const view = buildActiveShowdownView(round(), 0);
    expect(view?.participants.map(({ seatIndex }) => seatIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(view?.participants[0]).toStrictEqual({
      teamId: 100,
      teamName: 'Team 0',
      seatIndex: 0,
      hasGuessed: true,
    });
  });

  it('keeps the stored participants untouched', () => {
    const stored = round();
    buildActiveShowdownView(stored, 0);
    expect(stored.participants.map(({ seatIndex }) => seatIndex)).toEqual([
      2, 1, 0,
    ]);
  });

  it('carries the round id and question at every step, with no answer before the final step', () => {
    const view = buildActiveShowdownView(round(), 3);
    expect(view).toMatchObject({ id: 9, question: 'How many?' });
    expect(view).not.toHaveProperty('answer');
    expect(view).not.toHaveProperty('winnerTeamId');
    expect(view).not.toHaveProperty('isTie');
  });

  it('shows the first N seats guesses at step N', () => {
    const guessesAt = (step: number) =>
      buildActiveShowdownView(round(), step)?.participants.map((participant) =>
        'guess' in participant ? participant.guess : null,
      );
    expect(guessesAt(0)).toEqual([null, null, null]);
    expect(guessesAt(1)).toEqual(['10', null, null]);
    expect(guessesAt(2)).toEqual(['10', '20', null]);
    expect(guessesAt(3)).toEqual(['10', '20', '30']);
  });

  it('shows the answer and winner from the step after the last seat', () => {
    expect(buildActiveShowdownView(round(), 4)).toMatchObject({
      answer: '42',
      winnerTeamId: 101,
      isTie: true,
    });
    expect(buildActiveShowdownView(round(), 5)).toMatchObject({
      answer: '42',
    });
  });

  it('flags who has guessed without leaking a guess that is not on air', () => {
    const view = buildActiveShowdownView(round({ 0: '10', 1: null }), 0);
    expect(view?.participants.map(({ hasGuessed }) => hasGuessed)).toEqual([
      true,
      false,
    ]);
    expect(view?.participants[0]).not.toHaveProperty('guess');
  });

  it('never shows a guess a seat has not made, even at the final step', () => {
    const view = buildActiveShowdownView(round({ 0: '10', 1: null }), 3);
    expect(view?.participants[1]).toStrictEqual({
      teamId: 101,
      teamName: 'Team 1',
      seatIndex: 1,
      hasGuessed: false,
    });
  });

  it('shows an empty-string guess as a guess', () => {
    const view = buildActiveShowdownView(round({ 0: '' }), 1);
    expect(view?.participants[0]).toMatchObject({
      hasGuessed: true,
      guess: '',
    });
  });
});

describe('showdownRevealDescriptor', () => {
  it('has a start step, one step per seat and a final step, holding at both ends', () => {
    expect(showdownRevealDescriptor(round())).toStrictEqual({
      stepCount: 5,
      atStart: 'hold',
      atEnd: 'hold',
      canStart: true,
    });
  });

  it('lets the first Advance wait until every seat has guessed', () => {
    expect(showdownRevealDescriptor(round({ 0: '10', 1: null })).canStart).toBe(
      false,
    );
    expect(showdownRevealDescriptor(round({ 0: '10', 1: '' })).canStart).toBe(
      true,
    );
  });

  it('needs no wait with no seats', () => {
    expect(showdownRevealDescriptor(round({})).canStart).toBe(true);
  });
});
