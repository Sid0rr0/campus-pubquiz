import { describe, expect, it } from 'vitest';
import { buildOpenedQuestions } from '@/app/play/opened-questions';

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
