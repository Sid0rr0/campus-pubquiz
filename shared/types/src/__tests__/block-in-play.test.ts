import { describe, expect, it } from 'vitest';
import {
  getBlockInPlay,
  getBlockInPlayIds,
  getBlockRoundIndexes,
  getLastPastBlockIds,
  getPastBlockIds,
} from '../block-in-play';
import { progressAt, roundOf } from './session-progress-fixtures';

// Round 0 (ids 1, 2) has no break after it, so it shares a block with round 1
// (ids 3, 4). Round 2 is kahoot: each of ids 5, 6, 7 is its own block.
const rounds = [
  roundOf(0, [1, 2], { breakAfter: false }),
  roundOf(1, [3, 4]),
  roundOf(2, [5, 6, 7], { kahootMode: true }),
];

describe('the block in play', () => {
  it('is empty before any block has started', () => {
    expect(getBlockInPlay(rounds, progressAt('lobby'))).toEqual([]);
    expect(getBlockInPlay(rounds, progressAt('rules'))).toEqual([]);
  });

  it('is empty on a fresh block where nothing is opened yet', () => {
    expect(
      getBlockInPlay(
        rounds,
        progressAt('round_intro', { furthestOpenIndex: -1 }),
      ),
    ).toEqual([]);
  });

  it('runs to the furthest opened question while answering, not the one on screen', () => {
    const progress = progressAt('question_open', {
      roundIndex: 0,
      questionIndex: 0,
      furthestOpenIndex: 2,
    });

    expect(getBlockInPlay(rounds, progress)).toEqual([
      { roundIndex: 0, questionIndex: 0, questionId: 1 },
      { roundIndex: 0, questionIndex: 1, questionId: 2 },
      { roundIndex: 1, questionIndex: 0, questionId: 3 },
    ]);
  });

  it('is the whole block once it has locked', () => {
    const progress = progressAt('break', {
      roundIndex: 1,
      questionIndex: 1,
      furthestOpenIndex: 3,
    });

    expect(getBlockInPlayIds(rounds, progress)).toEqual([1, 2, 3, 4]);
  });

  it('is the block up to the question on screen at ended', () => {
    const progress = progressAt('ended', {
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: 3,
    });

    expect(getBlockInPlayIds(rounds, progress)).toEqual([1, 2, 3]);
  });

  it('is a single question inside a kahoot round', () => {
    const progress = progressAt('question_open', {
      roundIndex: 2,
      questionIndex: 1,
      furthestOpenIndex: 0,
    });

    expect(getBlockInPlayIds(rounds, progress)).toEqual([6]);
  });
});

describe('the rounds of a block', () => {
  it('lists every round a block spans, from the round of its first question', () => {
    expect(getBlockRoundIndexes(rounds, 1)).toEqual([0, 1]);
  });

  it('lists the round of a block that starts mid-way through the quiz', () => {
    expect(getBlockRoundIndexes(rounds, 3)).toEqual([1]);
  });

  it('lists just the kahoot round for one of its questions', () => {
    expect(getBlockRoundIndexes(rounds, 6)).toEqual([2]);
  });

  it('is empty when no question has that id', () => {
    expect(getBlockRoundIndexes(rounds, 99)).toEqual([]);
  });
});

describe('the past blocks', () => {
  it('has none at the first block', () => {
    expect(getPastBlockIds(rounds, progressAt('question_open'))).toEqual([]);
    expect(getLastPastBlockIds(rounds, progressAt('question_open'))).toEqual(
      [],
    );
  });

  it('holds every earlier round and the kahoot questions before the current one', () => {
    const progress = progressAt('question_open', {
      roundIndex: 2,
      questionIndex: 2,
    });

    expect(getPastBlockIds(rounds, progress)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('holds only the questions before the block in a kahoot round entered at its first question', () => {
    const progress = progressAt('question_open', {
      roundIndex: 2,
      questionIndex: 0,
    });

    expect(getPastBlockIds(rounds, progress)).toEqual([1, 2, 3, 4]);
  });

  it('names the block played just before the current one', () => {
    expect(
      getLastPastBlockIds(
        rounds,
        progressAt('question_open', { roundIndex: 2, questionIndex: 0 }),
      ),
    ).toEqual([1, 2, 3, 4]);
    expect(
      getLastPastBlockIds(
        rounds,
        progressAt('question_open', { roundIndex: 2, questionIndex: 2 }),
      ),
    ).toEqual([6]);
  });
});
