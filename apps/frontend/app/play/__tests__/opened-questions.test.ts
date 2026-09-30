import { describe, expect, it } from 'vitest';
import type { MyAnswerGrade } from '@/app/lib/use-game-socket';
import { buildOpenedQuestions } from '@/app/play/opened-questions';

const GRADED_AT = '2024-01-01T00:00:00.000Z';

function closestGuessQuestion(id: number) {
  return {
    id,
    type: 'closest_guess' as const,
    prompt: 'How many jellybeans?',
    points: 5,
    roundNumber: 1,
    questionNumberInRound: 1,
    roundTitle: 'Round 1',
    answer: '100',
    closestGuess: {
      hasSubmissions: true,
      minGuess: '80',
      maxGuess: '120',
      closestGuesses: [{ teamName: 'Team B', value: '95' }],
    },
  };
}

describe('buildOpenedQuestions', () => {
  it('pairs each seen question with the team answer and sorts by round/position', () => {
    const r2q1 = {
      id: 3,
      type: 'free_text' as const,
      prompt: 'Name a country',
      points: 1,
      roundNumber: 2,
      questionNumberInRound: 1,
      roundTitle: 'Round 2',
    };
    const r1q2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
    };
    const r1q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };

    const entries = buildOpenedQuestions(
      { 3: r2q1, 2: r1q2, 1: r1q1 },
      { 1: 'Banana' },
    );

    expect(entries.map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(entries[0]).toMatchObject({
      myAnswer: 'Banana',
      correctAnswer: null,
    });
    expect(entries[1]).toMatchObject({ myAnswer: null, correctAnswer: null });
  });

  it('carries the correct answer for questions that have been revealed', () => {
    const revealed = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };

    const entries = buildOpenedQuestions({ 1: revealed }, { 1: 'Apple' });

    expect(entries[0]).toMatchObject({
      myAnswer: 'Apple',
      correctAnswer: 'Banana',
    });
  });

  it('returns an empty list when no questions have been seen', () => {
    expect(buildOpenedQuestions({}, {})).toEqual([]);
  });

  it('carries the max points and leaves pointsAwarded null before grading', () => {
    const question = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };

    const entries = buildOpenedQuestions({ 1: question }, { 1: 'Banana' });

    expect(entries[0]).toMatchObject({ maxPoints: 5, pointsAwarded: null });
  });

  it('surfaces pointsAwarded once the question is revealed and myAnswerGrades has a grade for it', () => {
    const question = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };

    const entries = buildOpenedQuestions(
      { 1: question },
      { 1: 'Banana' },
      {
        1: {
          pointsAwarded: 3,
          gradedAt: '2024-01-01T00:00:00.000Z',
          verdict: 'partial',
        },
      },
    );

    expect(entries[0]).toMatchObject({ maxPoints: 5, pointsAwarded: 3 });
  });

  it('keeps pointsAwarded null before the question is revealed, even if myAnswerGrades already has a grade for it', () => {
    const question = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };

    const entries = buildOpenedQuestions(
      { 1: question },
      { 1: 'Banana' },
      {
        1: {
          pointsAwarded: 3,
          gradedAt: '2024-01-01T00:00:00.000Z',
          verdict: 'partial',
        },
      },
    );

    expect(entries[0]).toMatchObject({ maxPoints: 5, pointsAwarded: null });
  });

  it('shows 0 points for an unanswered question once it has been revealed', () => {
    const question = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };

    const entries = buildOpenedQuestions({ 1: question }, {});

    expect(entries[0]).toMatchObject({
      myAnswer: null,
      maxPoints: 5,
      pointsAwarded: 0,
    });
  });

  it('shows 0 closest_guess points for a team that never submitted a guess', () => {
    const entries = buildOpenedQuestions(
      { 1: closestGuessQuestion(1) },
      {},
      {},
    );

    expect(entries[0]).toMatchObject({ myAnswer: null, pointsAwarded: 0 });
  });

  it('takes closest_guess points from the team’s synced graded answer, not the reveal list', () => {
    // The reveal list names 'Team B' closest; this team (renamed since, so
    // no name would match) was graded full points on its own synced answer.
    const mine = buildOpenedQuestions(
      { 1: closestGuessQuestion(1) },
      { 1: '95' },
      { 1: { pointsAwarded: 5, gradedAt: GRADED_AT, verdict: 'correct' } },
    );

    expect(mine[0]).toMatchObject({ pointsAwarded: 5, verdict: 'correct' });
  });

  it('shows 0 closest_guess points when another team was closest', () => {
    const entries = buildOpenedQuestions(
      { 2: closestGuessQuestion(2) },
      { 2: '70' },
      { 2: { pointsAwarded: 0, gradedAt: GRADED_AT, verdict: 'incorrect' } },
    );

    expect(entries[0]).toMatchObject({
      pointsAwarded: 0,
      verdict: 'incorrect',
    });
  });

  it('carries the synced verdict, including partial, alongside the points', () => {
    const match = {
      id: 1,
      type: 'match' as const,
      prompt: 'Match them',
      points: 4,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'a|b|c|d',
    };

    const entries = buildOpenedQuestions(
      { 1: match },
      { 1: 'a|b|x|x' },
      { 1: { pointsAwarded: 2, gradedAt: GRADED_AT, verdict: 'partial' } },
    );

    expect(entries[0]).toMatchObject({ pointsAwarded: 2, verdict: 'partial' });
  });

  it('hides the verdict together with the points until the question is revealed', () => {
    const question = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };

    const entries = buildOpenedQuestions(
      { 1: question },
      { 1: 'Banana' },
      { 1: { pointsAwarded: 5, gradedAt: GRADED_AT, verdict: 'correct' } },
    );

    expect(entries[0]).toMatchObject({ pointsAwarded: null, verdict: null });
  });

  it('gates points to the question the display has actually stepped to within the active reveal walk', () => {
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };
    const q2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
      answer: 'Mars',
    };
    const myAnswerGrades: Record<number, MyAnswerGrade> = {
      1: {
        pointsAwarded: 3,
        gradedAt: '2024-01-01T00:00:00.000Z',
        verdict: 'partial',
      },
      2: {
        pointsAwarded: 5,
        gradedAt: '2024-01-01T00:00:00.000Z',
        verdict: 'correct',
      },
    };
    const activeReveal = {
      status: 'reveal' as const,
      revealIndex: 0,
      revealQuestions: [q1, q2],
    };

    const entries = buildOpenedQuestions(
      { 1: q1, 2: q2 },
      { 1: 'Banana', 2: 'Mars' },
      myAnswerGrades,
      activeReveal,
    );

    expect(entries[0]).toMatchObject({ id: 1, pointsAwarded: 3 });
    expect(entries[1]).toMatchObject({ id: 2, pointsAwarded: null });
  });

  it('keeps an already-passed question’s points visible once the walk moves into the next round’s intro card', () => {
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };
    const q2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 5,
      roundNumber: 2,
      questionNumberInRound: 1,
      roundTitle: 'Round 2',
      answer: 'Mars',
    };
    const myAnswerGrades: Record<number, MyAnswerGrade> = {
      1: {
        pointsAwarded: 3,
        gradedAt: '2024-01-01T00:00:00.000Z',
        verdict: 'partial',
      },
      2: {
        pointsAwarded: 5,
        gradedAt: '2024-01-01T00:00:00.000Z',
        verdict: 'correct',
      },
    };
    // revealIndex has already moved to position 1 (q2), but status is
    // 'reveal_intro' — the round-2 title card, shown before q2 itself.
    const activeReveal = {
      status: 'reveal_intro' as const,
      revealIndex: 1,
      revealQuestions: [q1, q2],
    };

    const entries = buildOpenedQuestions(
      { 1: q1, 2: q2 },
      { 1: 'Banana', 2: 'Mars' },
      myAnswerGrades,
      activeReveal,
    );

    expect(entries[0]).toMatchObject({ id: 1, pointsAwarded: 3 });
    expect(entries[1]).toMatchObject({ id: 2, pointsAwarded: null });
  });

  it('shows points for a question outside the currently-active reveal walk, since its own walk already finished', () => {
    const oldQuestion = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };
    // The active walk has moved on to a different (later) block entirely.
    const activeReveal = {
      status: 'reveal' as const,
      revealIndex: 0,
      revealQuestions: [
        { ...oldQuestion, id: 99, roundNumber: 2, roundTitle: 'Round 2' },
      ],
    };

    const entries = buildOpenedQuestions(
      { 1: oldQuestion },
      { 1: 'Banana' },
      {
        1: {
          pointsAwarded: 3,
          gradedAt: '2024-01-01T00:00:00.000Z',
          verdict: 'partial',
        },
      },
      activeReveal,
    );

    expect(entries[0]).toMatchObject({ pointsAwarded: 3 });
  });

  it('carries the question options through, for match display pairing', () => {
    const matchQuestion = {
      id: 1,
      type: 'match' as const,
      prompt: 'Match the hero to their weapon.',
      points: 4,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Heroes',
      options: ['arthur', 'captain america'],
      matchTargets: ['shield', 'excalibur'],
      answer: 'excalibur|shield',
    };

    const entries = buildOpenedQuestions(
      { 1: matchQuestion },
      { 1: 'shield|excalibur' },
    );

    expect(entries[0].options).toEqual(['arthur', 'captain america']);
  });
});
