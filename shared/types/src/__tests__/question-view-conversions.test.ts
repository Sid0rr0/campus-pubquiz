import { describe, expect, it } from 'vitest';
import type { SeededQuestion } from '../question-views';
import { toQuestionView } from '../question-view-conversions';

const BARE: SeededQuestion = {
  id: 4,
  type: 'free_text',
  prompt: 'Capital of France?',
  points: 2,
  answer: 'Paris',
};

describe('toQuestionView', () => {
  it('carries only the always-present fields of a bare question, with no key for anything unset', () => {
    expect(toQuestionView(BARE)).toStrictEqual({
      id: 4,
      type: 'free_text',
      prompt: 'Capital of France?',
      points: 2,
    });
  });

  it('carries the choices of a multiple choice question and never its answer', () => {
    const view = toQuestionView({
      ...BARE,
      type: 'multiple_choice',
      options: ['Paris', 'Rome'],
    });

    expect(view).toStrictEqual({
      id: 4,
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      points: 2,
      options: ['Paris', 'Rome'],
    });
  });

  it('carries both lists of a match question', () => {
    const view = toQuestionView({
      ...BARE,
      type: 'match',
      options: ['Paris', 'Rome'],
      matchTargets: ['Italy', 'France'],
      answer: 'France|Italy',
    });

    expect(view).toMatchObject({
      options: ['Paris', 'Rome'],
      matchTargets: ['Italy', 'France'],
    });
  });

  it('carries the media link, the clip and the hidden-video flag of a video question', () => {
    const view = toQuestionView({
      ...BARE,
      mediaUrl: 'https://example.com/clip.mp4',
      mediaStartSeconds: 5,
      mediaEndSeconds: 12,
      isVideoHidden: true,
    });

    expect(view).toStrictEqual({
      id: 4,
      type: 'free_text',
      prompt: 'Capital of France?',
      points: 2,
      mediaUrl: 'https://example.com/clip.mp4',
      mediaStartSeconds: 5,
      mediaEndSeconds: 12,
      isVideoHidden: true,
    });
  });

  it('carries the margin of a number question', () => {
    const view = toQuestionView({
      ...BARE,
      type: 'number',
      answer: '100',
      margin: { value: 5, unit: 'percent' },
    });

    expect(view.margin).toEqual({ value: 5, unit: 'percent' });
  });
});
