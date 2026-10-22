import { describe, expect, it } from 'vitest';
import {
  canChooseJoker,
  drawJoker,
  JOKER_PICK_SECONDS,
  pickableRounds,
} from '../joker';

const rounds = [
  { id: 10, questions: [{ id: 101 }, { id: 102 }] },
  { id: 20, questions: [{ id: 201 }] },
  { id: 30, questions: [{ id: 301 }] },
];

describe('pickableRounds', () => {
  it('offers every round before any question has opened', () => {
    expect(pickableRounds(rounds, []).map((round) => round.id)).toEqual([
      10, 20, 30,
    ]);
  });

  it('leaves out a round with any opened question', () => {
    expect(pickableRounds(rounds, [102]).map((round) => round.id)).toEqual([
      20, 30,
    ]);
  });

  it('offers nothing once every round has started', () => {
    expect(pickableRounds(rounds, [101, 201, 301])).toEqual([]);
  });
});

describe('drawJoker', () => {
  it('gives each pickable round an equal share of the random range', () => {
    const draw = (random: number) => drawJoker([10, 20, 30], () => random);
    expect(draw(0)).toBe(10);
    expect(draw(0.32)).toBe(10);
    expect(draw(0.34)).toBe(20);
    expect(draw(0.66)).toBe(20);
    expect(draw(0.67)).toBe(30);
    expect(draw(0.999)).toBe(30);
  });

  it('never returns a round outside the pickable ones', () => {
    for (let step = 0; step < 100; step++) {
      expect([20, 30]).toContain(drawJoker([20, 30], () => step / 100));
    }
  });

  it('returns null when nothing is pickable', () => {
    expect(drawJoker([], () => 0.5)).toBeNull();
  });
});

describe('canChooseJoker', () => {
  it('lets a team choose a pickable round while the pick is open', () => {
    expect(
      canChooseJoker({ isPickOpen: true, pickableRoundIds: [10, 20] }, 20),
    ).toBe(true);
  });

  it('refuses once the pick is closed', () => {
    expect(
      canChooseJoker({ isPickOpen: false, pickableRoundIds: [10, 20] }, 20),
    ).toBe(false);
  });

  it('refuses a round that has started', () => {
    expect(
      canChooseJoker({ isPickOpen: true, pickableRoundIds: [10] }, 20),
    ).toBe(false);
  });
});

describe('JOKER_PICK_SECONDS', () => {
  it('is one minute', () => {
    expect(JOKER_PICK_SECONDS).toBe(60);
  });
});
