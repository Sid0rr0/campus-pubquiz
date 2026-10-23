import { describe, expect, it } from 'vitest';
import {
  getAnsweredTeamIds,
  getBlockSeededQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getFurthestOpenPosition,
  getPastRevealedQuestions,
  getRevealQuestions,
  getUpcomingQuestionPositions,
} from '../block-questions';
import { DEFAULT_MARGIN } from '../margin';
import type { SeededQuestion } from '../question-views';
import {
  closestGuessQuestion,
  freeTextQuestion,
  round,
  sessionWith,
} from './session-fixtures';

function numberQuestion(
  id: number,
  overrides: Partial<SeededQuestion> = {},
): SeededQuestion {
  return {
    ...freeTextQuestion(id),
    type: 'number',
    answer: '42',
    ...overrides,
  } as unknown as SeededQuestion;
}

/** One block spanning two rounds: round 1 has no break after it. */
const TWO_ROUND_BLOCK = [
  round(1, [10, 11], { breakAfter: false }),
  round(2, [20, 21]),
];

describe('getCurrentRoundTitle', () => {
  it('is the title of the round the session stands in', () => {
    const session = sessionWith([round(1, [10]), round(2, [20])], {
      roundIndex: 1,
    });

    expect(getCurrentRoundTitle(session)).toBe('Round 2');
  });

  it('is empty when the session stands in no round', () => {
    const session = sessionWith([round(1, [10])], { roundIndex: 5 });

    expect(getCurrentRoundTitle(session)).toBe('');
  });
});

describe('getCurrentQuestion', () => {
  const rounds = [round(1, [10, 11])];

  it('is the open question, without its answer', () => {
    const session = sessionWith(rounds, {
      status: 'question_open',
      questionIndex: 1,
    });

    const question = getCurrentQuestion(session);

    expect(question).toMatchObject({ id: 11, prompt: 'Question 11' });
    expect(question).not.toHaveProperty('answer');
  });

  it('stays populated while the question is locking', () => {
    const session = sessionWith(rounds, { status: 'locking' });

    expect(getCurrentQuestion(session)?.id).toBe(10);
  });

  it('is null while no question is on air', () => {
    const session = sessionWith(rounds, { status: 'round_intro' });

    expect(getCurrentQuestion(session)).toBeNull();
  });

  it('is null when the question index names no question', () => {
    const session = sessionWith(rounds, {
      status: 'question_open',
      questionIndex: 9,
    });

    expect(getCurrentQuestion(session)).toBeNull();
  });

  it('is null when the round index names no round', () => {
    const session = sessionWith(rounds, {
      status: 'question_open',
      roundIndex: 9,
    });

    expect(getCurrentQuestion(session)).toBeNull();
  });
});

describe('getBlockSeededQuestions', () => {
  it('labels each question of a block with its round and its place in the round', () => {
    const session = sessionWith(TWO_ROUND_BLOCK, {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      furthestOpenIndex: 3,
    });

    expect(
      getBlockSeededQuestions(session).map((question) => ({
        id: question.id,
        roundNumber: question.roundNumber,
        questionNumberInRound: question.questionNumberInRound,
        roundTitle: question.roundTitle,
      })),
    ).toEqual([
      {
        id: 10,
        roundNumber: 1,
        questionNumberInRound: 1,
        roundTitle: 'Round 1',
      },
      {
        id: 11,
        roundNumber: 1,
        questionNumberInRound: 2,
        roundTitle: 'Round 1',
      },
      {
        id: 20,
        roundNumber: 2,
        questionNumberInRound: 1,
        roundTitle: 'Round 2',
      },
      {
        id: 21,
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Round 2',
      },
    ]);
  });

  it('numbers a partial run from its real place in the round', () => {
    const session = sessionWith(
      [round(1, [10, 11, 12], { kahootMode: true })],
      { status: 'break', questionIndex: 2, furthestOpenIndex: 0 },
    );

    expect(
      getBlockSeededQuestions(session).map((question) => [
        question.id,
        question.questionNumberInRound,
      ]),
    ).toEqual([[12, 3]]);
  });

  describe('margin', () => {
    const at = (question: SeededQuestion) =>
      sessionWith([round(1, [10], { questions: [question] })], {
        status: 'break',
      });

    it('gives a Number question its resolved default margin', () => {
      const [view] = getBlockSeededQuestions(at(numberQuestion(10)));

      expect(view.margin).toEqual(DEFAULT_MARGIN);
    });

    it('keeps the margin stored on a Number question', () => {
      const margin = { value: 3, unit: 'absolute' } as const;

      const [view] = getBlockSeededQuestions(
        at(numberQuestion(10, { margin })),
      );

      expect(view.margin).toEqual(margin);
    });

    it('leaves a question whose type has no margin without one', () => {
      const [view] = getBlockSeededQuestions(at(freeTextQuestion(10)));

      expect('margin' in view).toBe(false);
    });
  });

  describe('reveal kind', () => {
    const at = (question: SeededQuestion, summaries = {}) =>
      sessionWith(
        [round(1, [10], { questions: [question] })],
        { status: 'break' },
        { closestGuessSummaries: summaries },
      );

    it('reveals an ordinary question by its answer', () => {
      const [view] = getBlockSeededQuestions(at(freeTextQuestion(10)));

      expect(view).toMatchObject({ revealKind: 'answer', answer: 'Answer 10' });
      expect(view).not.toHaveProperty('closestGuess');
    });

    it('reveals a closest_guess question with the summary of its guesses', () => {
      const summary = {
        hasSubmissions: true,
        minGuess: '10',
        maxGuess: '90',
        closestGuesses: [{ teamName: 'Team A', value: '50' }],
      };

      const [view] = getBlockSeededQuestions(
        at(closestGuessQuestion(10), { 10: summary }),
      );

      expect(view).toMatchObject({
        revealKind: 'closest_guess',
        closestGuess: summary,
      });
    });

    it('reveals a closest_guess question nobody guessed on with an empty summary', () => {
      const [view] = getBlockSeededQuestions(at(closestGuessQuestion(10)));

      expect(view).toMatchObject({
        revealKind: 'closest_guess',
        closestGuess: { hasSubmissions: false, closestGuesses: [] },
      });
    });
  });
});

describe('getPastRevealedQuestions', () => {
  const placed = (session: ReturnType<typeof sessionWith>) =>
    getPastRevealedQuestions(session).map((question) => [
      question.id,
      question.roundNumber,
      question.questionNumberInRound,
      question.roundTitle,
    ]);

  it('is empty in the first block', () => {
    const session = sessionWith([round(1, [10]), round(2, [20])], {
      status: 'question_open',
    });

    expect(getPastRevealedQuestions(session)).toEqual([]);
  });

  it('holds every question of the rounds before the current block', () => {
    const session = sessionWith(
      [round(1, [10]), round(2, [20, 21]), round(3, [30])],
      { status: 'question_open', roundIndex: 2, furthestOpenIndex: 0 },
    );

    expect(placed(session)).toEqual([
      [10, 1, 1, 'Round 1'],
      [20, 2, 1, 'Round 2'],
      [21, 2, 2, 'Round 2'],
    ]);
  });

  it('adds the finished questions of a kahoot round before the current one', () => {
    const session = sessionWith(
      [round(1, [10]), round(2, [20, 21, 22], { kahootMode: true })],
      {
        status: 'question_open',
        roundIndex: 1,
        questionIndex: 2,
        furthestOpenIndex: 0,
      },
    );

    expect(placed(session)).toEqual([
      [10, 1, 1, 'Round 1'],
      [20, 2, 1, 'Round 2'],
      [21, 2, 2, 'Round 2'],
    ]);
  });

  it('adds nothing of a kahoot round at its first question', () => {
    const session = sessionWith(
      [round(1, [10]), round(2, [20, 21], { kahootMode: true })],
      { status: 'question_open', roundIndex: 1, furthestOpenIndex: 0 },
    );

    expect(placed(session)).toEqual([[10, 1, 1, 'Round 1']]);
  });
});

describe('getFurthestOpenPosition', () => {
  const at = (
    progress: Parameters<typeof sessionWith>[1],
    rounds = TWO_ROUND_BLOCK,
  ) => getFurthestOpenPosition(sessionWith(rounds, progress));

  it('is the question the furthest open index names', () => {
    expect(at({ status: 'question_open', furthestOpenIndex: 0 })).toEqual({
      roundIndex: 0,
      questionIndex: 0,
    });
    expect(
      at({
        status: 'question_open',
        roundIndex: 1,
        furthestOpenIndex: 2,
      }),
    ).toEqual({ roundIndex: 1, questionIndex: 0 });
  });

  it('is the sentinel before the block opened anything', () => {
    expect(at({ status: 'round_intro', furthestOpenIndex: -1 })).toEqual({
      roundIndex: 0,
      questionIndex: -1,
    });
  });

  it('puts the sentinel in the round the block starts in', () => {
    expect(
      at({ status: 'round_intro', roundIndex: 1, furthestOpenIndex: -1 }, [
        round(1, [10]),
        round(2, [20, 21]),
      ]),
    ).toEqual({ roundIndex: 1, questionIndex: -1 });
  });

  it('points a fresh round intro at the start of the round about to open', () => {
    expect(
      at({ status: 'round_intro', roundIndex: 1, furthestOpenIndex: 1 }),
    ).toEqual({ roundIndex: 1, questionIndex: -1 });
  });

  it('keeps a round intro stepped back into over the questions already open', () => {
    expect(
      at({ status: 'round_intro', roundIndex: 1, furthestOpenIndex: 2 }),
    ).toEqual({ roundIndex: 1, questionIndex: 0 });
  });

  it('only moves the line to the current round for a round intro', () => {
    expect(
      at({ status: 'question_open', roundIndex: 1, furthestOpenIndex: 1 }),
    ).toEqual({ roundIndex: 0, questionIndex: 1 });
  });
});

describe('getUpcomingQuestionPositions', () => {
  const upcoming = (
    progress: Parameters<typeof sessionWith>[1],
    rounds = TWO_ROUND_BLOCK,
  ) => getUpcomingQuestionPositions(sessionWith(rounds, progress));

  it('lists the rest of the block across its rounds', () => {
    expect(upcoming({ status: 'question_open', furthestOpenIndex: 0 })).toEqual(
      [
        { roundNumber: 1, questionNumberInRound: 2, roundTitle: 'Round 1' },
        { roundNumber: 2, questionNumberInRound: 1, roundTitle: 'Round 2' },
        { roundNumber: 2, questionNumberInRound: 2, roundTitle: 'Round 2' },
      ],
    );
  });

  it('stops at the block end, not at the end of its last round', () => {
    expect(
      upcoming({ status: 'question_open', furthestOpenIndex: 0 }, [
        round(1, [10, 11, 12], { breakAfter: false }),
        round(2, [20]),
      ]),
    ).toEqual([
      { roundNumber: 1, questionNumberInRound: 2, roundTitle: 'Round 1' },
      { roundNumber: 1, questionNumberInRound: 3, roundTitle: 'Round 1' },
      { roundNumber: 2, questionNumberInRound: 1, roundTitle: 'Round 2' },
    ]);
  });

  it('counts from the furthest question opened, not the one on screen', () => {
    expect(
      upcoming(
        { status: 'question_open', questionIndex: 0, furthestOpenIndex: 1 },
        [round(1, [10, 11, 12])],
      ),
    ).toEqual([
      { roundNumber: 1, questionNumberInRound: 3, roundTitle: 'Round 1' },
    ]);
  });

  it('lists the whole round about to open at a fresh round intro', () => {
    expect(
      upcoming({ status: 'round_intro', roundIndex: 1, furthestOpenIndex: 1 }),
    ).toEqual([
      { roundNumber: 2, questionNumberInRound: 1, roundTitle: 'Round 2' },
      { roundNumber: 2, questionNumberInRound: 2, roundTitle: 'Round 2' },
    ]);
  });

  it('lists every question of the first round before anything opened', () => {
    expect(
      upcoming({ status: 'round_intro', furthestOpenIndex: -1 }).map(
        (position) => position.questionNumberInRound,
      ),
    ).toEqual([1, 2, 1, 2]);
  });

  it('is empty for a kahoot round, whose block is one question', () => {
    expect(
      upcoming({ status: 'question_open', furthestOpenIndex: 0 }, [
        round(1, [10, 11], { kahootMode: true }),
      ]),
    ).toEqual([]);
  });

  it('is empty once the block is no longer being answered', () => {
    expect(upcoming({ status: 'break', furthestOpenIndex: 0 })).toEqual([]);
  });

  it('is empty at the last question of the block', () => {
    expect(
      upcoming(
        { status: 'question_open', questionIndex: 1, furthestOpenIndex: 1 },
        [round(1, [10, 11])],
      ),
    ).toEqual([]);
  });
});

describe('getRevealQuestions', () => {
  const at = (status: 'reveal_intro' | 'reveal' | 'break' | 'question_open') =>
    getRevealQuestions(
      sessionWith([round(1, [10, 11])], {
        status,
        questionIndex: 1,
        furthestOpenIndex: 1,
      }),
    ).map((question) => question.id);

  it('holds the whole block from the reveal intro on', () => {
    expect(at('reveal_intro')).toEqual([10, 11]);
    expect(at('reveal')).toEqual([10, 11]);
  });

  it('holds nothing before the reveal', () => {
    expect(at('break')).toEqual([]);
    expect(at('question_open')).toEqual([]);
  });
});

describe('getAnsweredTeamIds', () => {
  const rounds = [round(1, [10, 11])];

  it('lists the teams that answered the open question', () => {
    const session = sessionWith(
      rounds,
      { status: 'question_open', questionIndex: 1 },
      { answeredTeamIdsByQuestion: { 10: [9], 11: [1, 2] } },
    );

    expect(getAnsweredTeamIds(session)).toEqual([1, 2]);
  });

  it('is empty when nobody answered yet', () => {
    const session = sessionWith(rounds, { status: 'question_open' });

    expect(getAnsweredTeamIds(session)).toEqual([]);
  });

  it('is empty while no question is on air', () => {
    const session = sessionWith(
      rounds,
      { status: 'break' },
      { answeredTeamIdsByQuestion: { 10: [1] } },
    );

    expect(getAnsweredTeamIds(session)).toEqual([]);
  });
});
