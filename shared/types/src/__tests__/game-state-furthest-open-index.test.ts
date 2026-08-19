import { describe, expect, it } from 'vitest';
import { getNextGameState, type GameContext } from '../game-state';
import { lobby, twoRoundsWithBreakAfterSecond } from './game-state-fixtures';

describe('getNextGameState — furthestOpenIndex tracking', () => {
  it("carries furthestOpenIndex forward as ADVANCE opens questions, and doesn't shrink it when Previous walks back", () => {
    let progress = getNextGameState(
      { ...lobby, status: 'rules' },
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // round_intro(0,0)
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // question_open(0,0), furthest 0
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // question_open(0,1), furthest 1
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // round_intro(1,0), furthest still 1 (no break)
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // question_open(1,0), furthest 2
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // question_open(1,1), furthest 3

    const steppedBack = getNextGameState(
      progress,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(steppedBack).toMatchObject({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: 3, // unchanged — question (1,1) stays open even though the display stepped back off it
    });
  });

  it('resets furthestOpenIndex to -1 (nothing opened yet) once a new block starts after the previous block is fully revealed', () => {
    const twoSingleQuestionBlocks: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: true },
      ],
    };
    let progress = getNextGameState(
      { ...lobby, status: 'rules' },
      'ADVANCE',
      twoSingleQuestionBlocks,
    ); // round_intro(0)
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // question_open(0,0), furthest 0
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // locking
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // break
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // reveal_intro (round 0)
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // reveal
    const nextBlockIntro = getNextGameState(
      progress,
      'ADVANCE',
      twoSingleQuestionBlocks,
    ); // round_intro(1) — new block

    expect(nextBlockIntro).toMatchObject({
      status: 'round_intro',
      roundIndex: 1,
      furthestOpenIndex: -1,
    });
  });

  it("keeps furthestOpenIndex pointing at an already-opened question when Previous steps back into that round's intro card", () => {
    let progress = getNextGameState(
      { ...lobby, status: 'rules' },
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // round_intro(0,0)
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // question_open(0,0), furthest 0
    progress = getNextGameState(
      progress,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    ); // question_open(0,1), furthest 1

    const backToFirstQuestion = getNextGameState(
      progress,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(backToFirstQuestion).toMatchObject({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
    });
    const backToIntroCard = getNextGameState(
      backToFirstQuestion,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    // Distinguishable from a fresh round_intro (furthestOpenIndex -1): this
    // round's first question was genuinely opened, so it stays at least 0.
    expect(backToIntroCard).toMatchObject({
      status: 'round_intro',
      roundIndex: 0,
      furthestOpenIndex: 1,
    });
  });
});
