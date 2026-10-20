import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview } from '../import';
import {
  clipFieldsFor,
  previewToStoredFields,
  rowToPreview,
  rowToSeededQuestion,
  type StoredQuestionRow,
} from '../question-record-codec';
import type { QuestionPayload } from '../question-payload-schema';
import { QUESTION_TYPES, type QuestionType } from '../question-types';

const IMAGE = 'https://example.com/a.png';
const SOUND = 'https://example.com/a.mp3';
const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIDEO_FILE = 'https://example.com/clip.mp4';

const CLIP_FIELDS = [
  'mediaStartSeconds',
  'mediaEndSeconds',
  'isVideoHidden',
] as const;
const REVEAL_FIELDS = ['revealStartSeconds', 'revealEndSeconds'] as const;
const ALL_CLIP = {
  mediaStartSeconds: 3,
  mediaEndSeconds: 9,
  isVideoHidden: true,
  revealStartSeconds: 20,
  revealEndSeconds: 30,
} as const;

interface MediaCase {
  name: string;
  links: { mediaUrl?: string; answerMediaUrl?: string };
  carriesClip: boolean;
  carriesReveal: boolean;
}

const MEDIA_CASES: MediaCase[] = [
  { name: 'none', links: {}, carriesClip: false, carriesReveal: false },
  {
    name: 'image',
    links: { mediaUrl: IMAGE },
    carriesClip: false,
    carriesReveal: false,
  },
  {
    name: 'sound',
    links: { mediaUrl: SOUND },
    carriesClip: false,
    carriesReveal: false,
  },
  {
    name: 'YouTube',
    links: { mediaUrl: YOUTUBE },
    carriesClip: true,
    carriesReveal: true,
  },
  {
    name: 'video file',
    links: { mediaUrl: VIDEO_FILE },
    carriesClip: true,
    carriesReveal: true,
  },
  {
    name: 'image with an answer video',
    links: { mediaUrl: IMAGE, answerMediaUrl: YOUTUBE },
    carriesClip: false,
    carriesReveal: true,
  },
];

/** A preview of the type with its answer kind's fields and grading settings filled in. */
const BASE: Record<QuestionType, ImportQuestionPreview> = {
  free_text: { type: 'free_text', prompt: 'Q?', answer: 'A', points: 3 },
  multiple_choice: {
    type: 'multiple_choice',
    prompt: 'Q?',
    answer: 'Paris',
    points: 3,
    options: ['Paris', 'Rome'],
  },
  sort: {
    type: 'sort',
    prompt: 'Q?',
    answer: 'a|b',
    points: 3,
    options: ['b', 'a'],
  },
  match: {
    type: 'match',
    prompt: 'Q?',
    answer: '1|2',
    points: 3,
    options: ['x', 'y'],
    matchTargets: ['1', '2'],
    matchScoringMode: 'all_or_nothing',
  },
  closest_guess: {
    type: 'closest_guess',
    prompt: 'Q?',
    answer: '5',
    points: 3,
  },
  number: {
    type: 'number',
    prompt: 'Q?',
    answer: '5',
    points: 3,
    margin: { value: 5, unit: 'absolute' },
  },
};

/** The fields a clip carries for this media case, written out independently of the codec. */
function allowedClip(media: MediaCase) {
  return {
    ...(media.carriesClip
      ? {
          mediaStartSeconds: ALL_CLIP.mediaStartSeconds,
          mediaEndSeconds: ALL_CLIP.mediaEndSeconds,
          isVideoHidden: ALL_CLIP.isVideoHidden,
        }
      : {}),
    ...(media.carriesReveal
      ? {
          revealStartSeconds: ALL_CLIP.revealStartSeconds,
          revealEndSeconds: ALL_CLIP.revealEndSeconds,
        }
      : {}),
  };
}

function rowOf(type: QuestionType, answer: string): StoredQuestionRow {
  return { id: 7, type, prompt: 'Q?', answer, points: 3, notes: null };
}

const CASES = QUESTION_TYPES.flatMap((type) =>
  MEDIA_CASES.map((media) => ({
    type,
    media,
    name: `${type} + ${media.name}`,
  })),
);

describe('question record codec round trip', () => {
  it.each(CASES)(
    '$name: preview to stored fields to preview gives the same preview',
    ({ type, media }) => {
      const preview: ImportQuestionPreview = {
        ...BASE[type],
        questionId: 7,
        notes: 'Hint',
        ...media.links,
        ...allowedClip(media),
      };

      const stored = previewToStoredFields(preview);
      const back = rowToPreview({ id: 7, ...stored }, stored.payload);

      expect(back).toEqual(preview);
    },
  );

  it.each(CASES)(
    '$name: stored to seeded carries the same media, clip and grading fields and never a payload answer',
    ({ type, media }) => {
      const preview: ImportQuestionPreview = {
        ...BASE[type],
        ...media.links,
        ...allowedClip(media),
      };
      const stored = previewToStoredFields(preview);
      const leaky: QuestionPayload & { answer: string } = {
        ...stored.payload,
        answer: 'LEAKED',
      };

      const seeded = rowToSeededQuestion(rowOf(type, BASE[type].answer), leaky);

      const { questionId: _id, notes: _notes, ...expected } = preview;
      expect(seeded).toEqual({ id: 7, ...expected });
    },
  );

  it.each(CASES)(
    '$name: a clip field the media does not allow is absent from every output',
    ({ type, media }) => {
      const dirty: ImportQuestionPreview = {
        ...BASE[type],
        ...media.links,
        ...ALL_CLIP,
      };
      const stored = previewToStoredFields(dirty);
      const fromRow = rowToPreview(
        { id: 7, ...stored },
        {
          ...stored.payload,
          ...ALL_CLIP,
        },
      );
      const seeded = rowToSeededQuestion(rowOf(type, dirty.answer), {
        ...stored.payload,
        ...ALL_CLIP,
      });

      for (const output of [stored.payload, fromRow, seeded]) {
        for (const field of CLIP_FIELDS) {
          expect(field in output).toBe(media.carriesClip);
        }
        for (const field of REVEAL_FIELDS) {
          expect(field in output).toBe(media.carriesReveal);
        }
      }
    },
  );

  it.each(QUESTION_TYPES)(
    '%s: a field the type does not allow is absent from every output',
    (type) => {
      const stray: QuestionPayload = {
        options: ['a', 'b'],
        matchTargets: ['1', '2'],
        matchScoringMode: 'all_or_nothing',
        margin: { value: 1, unit: 'percent' },
      };
      const stored = previewToStoredFields({
        type,
        prompt: 'Q?',
        answer: 'A',
        points: 1,
        ...stray,
      });
      const fromRow = rowToPreview({ id: 7, ...stored }, stray);
      const seeded = rowToSeededQuestion(rowOf(type, 'A'), stray);
      const allowsOptions = ['multiple_choice', 'sort', 'match'].includes(type);

      for (const output of [stored.payload, fromRow, seeded]) {
        expect('options' in output).toBe(allowsOptions);
        expect('matchTargets' in output).toBe(type === 'match');
        expect('matchScoringMode' in output).toBe(type === 'match');
        expect('margin' in output).toBe(type === 'number');
      }
    },
  );
});

describe('clipFieldsFor', () => {
  it.each(MEDIA_CASES)(
    'returns the clip fields a preview carries for $name media',
    (media) => {
      expect(clipFieldsFor(media.links, ALL_CLIP)).toEqual(allowedClip(media));
    },
  );

  it('leaves out candidate fields that are not set', () => {
    expect(
      clipFieldsFor({ mediaUrl: YOUTUBE }, { mediaStartSeconds: 4 }),
    ).toEqual({ mediaStartSeconds: 4 });
  });
});
