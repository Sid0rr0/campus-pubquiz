import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import type {
  BlockRevealQuestionView,
  ClosestGuessRevealData,
} from '../question-views';
import {
  assembleDisplayScreen,
  describeSessionDisplayScreen,
  trimOnAirQuestion,
} from '../session-display-screen';
import type { SessionState } from '../session-state';
import { buildSnapshot } from '../session-snapshot';
import { lobby } from './game-state-fixtures';
import { closestGuessQuestion, round, sessionWith } from './session-fixtures';

const SUMMARY: ClosestGuessRevealData = {
  hasSubmissions: true,
  minGuess: '10',
  maxGuess: '90',
  closestGuesses: [{ teamName: 'Team A', value: '50' }],
};

function revealView(
  id: number,
  guessed = true,
): BlockRevealQuestionView & { id: number } {
  return {
    ...closestGuessQuestion(id),
    revealKind: 'closest_guess',
    closestGuess: guessed ? SUMMARY : { hasSubmissions: false },
  } as unknown as BlockRevealQuestionView & { id: number };
}

function progressAt(
  status: GameProgress['status'],
  revealIndex = 0,
): GameProgress {
  return { ...lobby, status, revealIndex };
}

describe('trimOnAirQuestion', () => {
  const views = [revealView(10), revealView(11)];

  it('shows only the on-air question as far as its step has got, in reveal', () => {
    const [earlier, onAir] = trimOnAirQuestion(
      views,
      progressAt('reveal', 1),
      0,
    );

    expect(earlier).toBe(views[0]);
    expect(onAir).toMatchObject({
      revealKind: 'closest_guess_pending',
      closestGuess: { hasSubmissions: true },
    });
    expect(onAir).not.toHaveProperty('answer');
  });

  it('leaves the later questions of the block whole too', () => {
    const [onAir, later] = trimOnAirQuestion(views, progressAt('reveal', 0), 0);

    expect(onAir).toMatchObject({ revealKind: 'closest_guess_pending' });
    expect(later).toBe(views[1]);
  });

  it('sends every question whole outside reveal, whatever the step', () => {
    const trimmed = trimOnAirQuestion(views, progressAt('break', 0), 0);

    expect(trimmed[0]).toBe(views[0]);
    expect(trimmed[1]).toBe(views[1]);
  });

  it('shows more of the on-air question as the step advances', () => {
    const [onAir] = trimOnAirQuestion(views, progressAt('reveal', 0), 3);

    expect(onAir).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
    });
    expect(onAir).not.toHaveProperty('closestGuess.closestGuesses');
  });
});

describe('describeSessionDisplayScreen', () => {
  const rounds = [round(1, [10, 11], { title: 'Alpha' })];

  function revealSession(step: number): SessionState {
    return sessionWith(
      [
        round(1, [10, 11], {
          questions: [closestGuessQuestion(10), closestGuessQuestion(11)],
        }),
      ],
      {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 1,
        furthestOpenIndex: 1,
      },
      {
        revealStep: step,
        closestGuessSummaries: { 10: SUMMARY, 11: SUMMARY },
      },
    );
  }

  it('names the lobby screen in the lobby', () => {
    expect(describeSessionDisplayScreen(sessionWith(rounds))).toEqual({
      kind: 'lobby',
    });
  });

  it('carries the open question on the question screen', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith(rounds, {
        status: 'question_open',
        furthestOpenIndex: 0,
      }),
    );

    expect(screen).toMatchObject({
      kind: 'question',
      question: { id: 10, prompt: 'Question 10' },
    });
  });

  it('holds the closest-guess answer back at the first reveal step', () => {
    const screen = describeSessionDisplayScreen(revealSession(0));

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { id: 10, revealKind: 'closest_guess_pending' },
    });
    expect(screen).not.toHaveProperty('question.answer');
  });

  it('carries the answer once the reveal has stepped to it', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith(
        [
          round(1, [10], {
            questions: [closestGuessQuestion(10)],
          }),
        ],
        {
          status: 'reveal',
          roundIndex: 0,
          questionIndex: 0,
          furthestOpenIndex: 0,
        },
        { revealStep: 3, closestGuessSummaries: { 10: SUMMARY } },
      ),
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { id: 10, revealKind: 'closest_guess', answer: '55' },
    });
  });

  it('sends a non-closest-guess reveal whole', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith([round(1, [10])], {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 0,
        furthestOpenIndex: 0,
      }),
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { id: 10, answer: 'Answer 10' },
    });
  });
});

describe('assembleDisplayScreen', () => {
  it('draws the screen it is given on air, not the one the session implies', () => {
    const session = sessionWith([round(1, [10])], {
      status: 'question_open',
      furthestOpenIndex: 0,
    });

    const screen = assembleDisplayScreen(
      session,
      buildSnapshot(session),
      { kind: 'rules' },
      0,
    );

    expect(screen).toEqual({ kind: 'rules' });
  });

  it('trims the on-air reveal question to the step it is given', () => {
    const session = sessionWith(
      [round(1, [10], { questions: [closestGuessQuestion(10)] })],
      {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 0,
        furthestOpenIndex: 0,
      },
      { revealStep: 4, closestGuessSummaries: { 10: SUMMARY } },
    );

    const screen = assembleDisplayScreen(
      session,
      buildSnapshot(session),
      { kind: 'reveal', roundIndex: 0, questionId: 10 },
      0,
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { revealKind: 'closest_guess_pending' },
    });
  });
});
