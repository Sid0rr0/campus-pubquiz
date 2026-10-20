import { describe, expect, it } from 'vitest';
import {
  previewToStoredFields,
  rowToPreview,
  type ImportQuestionPreview,
  type QuestionType,
} from '@campus-pubquiz/types';
import {
  questionFromPreview,
  questionToPreview,
  type EditorQuestion,
} from '@/app/quizzes/[id]/quiz-draft-state';

const VIDEO = 'https://youtu.be/dQw4w9WgXcQ';
const IMAGE = 'https://example.com/a.jpg';

const clip = {
  mediaStartSeconds: 55,
  mediaEndSeconds: 88,
  revealStartSeconds: 150,
  revealEndSeconds: 165,
};

const base = { prompt: 'Q?', points: 2 };

/** One representative stored question per type, carrying a video with a clip. */
const VIDEO_QUESTIONS: Record<QuestionType, ImportQuestionPreview> = {
  free_text: {
    ...base,
    type: 'free_text',
    answer: 'Jaws',
    mediaUrl: VIDEO,
    ...clip,
    isVideoHidden: true,
  },
  multiple_choice: {
    ...base,
    type: 'multiple_choice',
    answer: 'B',
    options: ['A', 'B', 'C'],
    mediaUrl: VIDEO,
    ...clip,
  },
  sort: {
    ...base,
    type: 'sort',
    answer: 'a|b|c',
    options: ['b', 'a', 'c'],
    mediaUrl: VIDEO,
    ...clip,
  },
  match: {
    ...base,
    type: 'match',
    answer: '2|1',
    options: ['A', 'B'],
    matchTargets: ['1', '2'],
    mediaUrl: VIDEO,
    ...clip,
  },
  closest_guess: {
    ...base,
    type: 'closest_guess',
    answer: '42',
    mediaUrl: VIDEO,
    ...clip,
  },
  number: {
    ...base,
    type: 'number',
    answer: '42',
    margin: { value: 5, unit: 'percent' },
    mediaUrl: VIDEO,
    ...clip,
  },
};

/** draft -> preview -> stored fields (the real codec) -> preview -> draft. */
function roundTrip(draft: EditorQuestion): EditorQuestion {
  const stored = previewToStoredFields(questionToPreview(draft));
  const reloaded = rowToPreview(
    {
      id: 1,
      type: stored.type,
      prompt: stored.prompt,
      answer: stored.answer,
      points: stored.points,
      notes: stored.notes,
    },
    stored.payload,
  );
  return questionFromPreview(draft.id, { ...reloaded, questionId: undefined });
}

describe('editor draft round-trip through the question record codec', () => {
  it.each(Object.keys(VIDEO_QUESTIONS) as QuestionType[])(
    'brings a %s video question back unchanged',
    (type) => {
      const draft = questionFromPreview('q1', VIDEO_QUESTIONS[type]);

      expect(roundTrip(draft)).toEqual(draft);
    },
  );

  it.each(Object.keys(VIDEO_QUESTIONS) as QuestionType[])(
    'brings a %s image question with typed clip times back with the clip cleared and nothing else changed',
    (type) => {
      const draft = {
        ...questionFromPreview('q1', VIDEO_QUESTIONS[type]),
        mediaUrl: IMAGE,
      };

      expect(roundTrip(draft)).toEqual({
        ...draft,
        clipStart: '',
        clipEnd: '',
        isVideoHidden: false,
        revealStart: '',
        revealEnd: '',
      });
    },
  );

  it.each([
    ['no media', undefined],
    ['sound media', 'https://example.com/a.mp3'],
  ])(
    'brings a question with %s back unchanged for every type',
    (_label, mediaUrl) => {
      for (const type of Object.keys(VIDEO_QUESTIONS) as QuestionType[]) {
        const draft = {
          ...questionFromPreview('q1', VIDEO_QUESTIONS[type]),
          mediaUrl: mediaUrl ?? '',
          clipStart: '',
          clipEnd: '',
          isVideoHidden: false,
          revealStart: '',
          revealEnd: '',
        };

        expect(roundTrip(draft)).toEqual(draft);
      }
    },
  );

  it.each(Object.keys(VIDEO_QUESTIONS) as QuestionType[])(
    'brings a %s image question with a video answer media back with the reveal clip kept and the question clip cleared',
    (type) => {
      const draft = {
        ...questionFromPreview('q1', VIDEO_QUESTIONS[type]),
        mediaUrl: IMAGE,
        answerMediaUrl: VIDEO,
        clipStart: '',
        clipEnd: '',
        isVideoHidden: false,
      };

      const reloaded = roundTrip(draft);

      expect(reloaded).toEqual(draft);
      expect(reloaded.revealStart).not.toBe('');
      expect(reloaded.revealEnd).not.toBe('');
    },
  );

  it('shows a number question with an unset margin as the default 10% and brings it back unchanged', () => {
    const preview: ImportQuestionPreview = {
      ...base,
      type: 'number',
      answer: '42',
    };
    const draft = questionFromPreview('q1', preview);

    expect(draft.marginValue).toBe('10');
    expect(draft.marginUnit).toBe('percent');
    expect(roundTrip(draft)).toEqual(draft);
  });
});
