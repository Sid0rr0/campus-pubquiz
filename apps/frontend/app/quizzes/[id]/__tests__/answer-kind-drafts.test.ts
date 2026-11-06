import { describe, expect, it } from 'vitest';
import { loadAnswerDraft } from '@/app/quizzes/[id]/answer-kind-drafts';

describe('loadAnswerDraft keeps the stored display order', () => {
  it('copies a sort question’s options, leaving none when the server sent none', () => {
    const options = ['c', 'a', 'b'];
    const loaded = loadAnswerDraft({
      type: 'sort',
      prompt: 'Order',
      answer: 'a|b|c',
      options,
      points: 1,
    });

    expect(loaded.savedDisplayOrder).toEqual(options);
    expect(loaded.savedDisplayOrder).not.toBe(options);
    expect(
      loadAnswerDraft({
        type: 'sort',
        prompt: 'Order',
        answer: 'a|b|c',
        points: 1,
      }),
    ).not.toHaveProperty('savedDisplayOrder');
  });

  it('copies a match question’s targets, leaving none when the server sent none', () => {
    const matchTargets = ['2', '1'];
    const question = {
      type: 'match' as const,
      prompt: 'Pair',
      answer: '1|2',
      options: ['x', 'y'],
      points: 1,
    };

    const loaded = loadAnswerDraft({ ...question, matchTargets });

    expect(loaded.savedDisplayOrder).toEqual(matchTargets);
    expect(loaded.savedDisplayOrder).not.toBe(matchTargets);
    expect(loadAnswerDraft(question)).not.toHaveProperty('savedDisplayOrder');
  });
});
