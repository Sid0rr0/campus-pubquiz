import { describe, expect, it } from 'vitest';
import { getNextGameStatus, IllegalGameTransitionError } from './game-state';

describe('getNextGameStatus', () => {
  it('starts the quiz from lobby', () => {
    expect(
      getNextGameStatus({ status: 'lobby', action: 'START_QUIZ', hasMoreQuestions: true }),
    ).toBe('question_open');
  });

  it('walks the full happy path from question_open to leaderboard', () => {
    expect(
      getNextGameStatus({ status: 'question_open', action: 'LOCK_ANSWERS', hasMoreQuestions: true }),
    ).toBe('locked');
    expect(
      getNextGameStatus({ status: 'locked', action: 'START_GRADING', hasMoreQuestions: true }),
    ).toBe('grading');
    expect(
      getNextGameStatus({ status: 'grading', action: 'REVEAL_ANSWER', hasMoreQuestions: true }),
    ).toBe('reveal');
    expect(
      getNextGameStatus({ status: 'reveal', action: 'SHOW_LEADERBOARD', hasMoreQuestions: true }),
    ).toBe('leaderboard');
  });

  it('moves back to question_open when more questions remain', () => {
    expect(
      getNextGameStatus({ status: 'leaderboard', action: 'NEXT_QUESTION', hasMoreQuestions: true }),
    ).toBe('question_open');
  });

  it('ends the quiz from leaderboard when no questions remain', () => {
    expect(
      getNextGameStatus({ status: 'leaderboard', action: 'NEXT_QUESTION', hasMoreQuestions: false }),
    ).toBe('ended');
  });

  it('ends the quiz from any state via END_QUIZ', () => {
    expect(
      getNextGameStatus({ status: 'question_open', action: 'END_QUIZ', hasMoreQuestions: true }),
    ).toBe('ended');
  });

  it('rejects an action that is not legal from the current state', () => {
    expect(() =>
      getNextGameStatus({ status: 'lobby', action: 'LOCK_ANSWERS', hasMoreQuestions: true }),
    ).toThrow(IllegalGameTransitionError);
  });

  it('rejects re-starting a quiz that is already open', () => {
    expect(() =>
      getNextGameStatus({ status: 'question_open', action: 'START_QUIZ', hasMoreQuestions: true }),
    ).toThrow(IllegalGameTransitionError);
  });

  it('rejects any action once the quiz has ended', () => {
    expect(() =>
      getNextGameStatus({ status: 'ended', action: 'START_QUIZ', hasMoreQuestions: true }),
    ).toThrow(IllegalGameTransitionError);
  });
});
