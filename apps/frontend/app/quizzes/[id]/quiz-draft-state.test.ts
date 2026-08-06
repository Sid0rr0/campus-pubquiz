import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview, ImportRoundPreview } from '@campus-pubquiz/types';
import {
  makeOption,
  makeQuestion,
  makeRound,
  questionFromPreview,
  questionToPreview,
  roundFromPreview,
  toSaveRequest,
} from '@/app/quizzes/[id]/quiz-draft-state';

describe('makeQuestion / makeRound', () => {
  it('creates a blank multiple choice question with two empty options', () => {
    const question = makeQuestion('q1');

    expect(question).toEqual({
      id: 'q1',
      type: 'multiple_choice',
      prompt: '',
      points: 1,
      notes: '',
      options: [makeOption(), makeOption()],
      correctText: '',
      mediaUrl: '',
      answerMediaUrl: '',
    });
  });

  it('creates a blank round with no questions', () => {
    expect(makeRound('r1', 'Round 1')).toEqual({
      id: 'r1',
      title: 'Round 1',
      breakAfter: false,
      questions: [],
    });
  });
});

describe('questionFromPreview / questionToPreview round-trip', () => {
  it('marks the matching option correct for a multiple choice question', () => {
    const preview: ImportQuestionPreview = {
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 3,
      options: ['Paris', 'London', 'Berlin'],
    };

    const question = questionFromPreview('q1', preview);

    expect(question.options).toEqual([
      { text: 'Paris', isCorrect: true },
      { text: 'London', isCorrect: false },
      { text: 'Berlin', isCorrect: false },
    ]);
    expect(questionToPreview(question)).toEqual(preview);
  });

  it('carries notes and media urls through for a picture question', () => {
    const preview: ImportQuestionPreview = {
      type: 'picture',
      prompt: 'Name this landmark.',
      answer: 'Eiffel Tower',
      points: 2,
      notes: 'Zoom in on the top',
      mediaUrl: 'https://example.com/eiffel.jpg',
      answerMediaUrl: 'https://example.com/eiffel-answer.jpg',
    };

    const question = questionFromPreview('q1', preview);

    expect(question.correctText).toBe('Eiffel Tower');
    expect(question.mediaUrl).toBe('https://example.com/eiffel.jpg');
    expect(questionToPreview(question)).toEqual(preview);
  });

  it('derives the answer from whichever option is marked correct', () => {
    const question = makeQuestion('q1');
    question.prompt = 'Capital of France?';
    question.options = [
      { text: 'Paris', isCorrect: false },
      { text: 'London', isCorrect: true },
    ];

    expect(questionToPreview(question).answer).toBe('London');
  });

  it('drops blank options and trims text when converting back to a preview', () => {
    const question = makeQuestion('q1');
    question.prompt = ' Capital of France? ';
    question.options = [
      { text: ' Paris ', isCorrect: true },
      { text: '  ', isCorrect: false },
    ];

    const preview = questionToPreview(question);

    expect(preview.prompt).toBe('Capital of France?');
    expect(preview.options).toEqual(['Paris']);
    expect(preview.answer).toBe('Paris');
  });

  it('omits notes/mediaUrl/answerMediaUrl when left blank', () => {
    const question = makeQuestion('q1');
    question.prompt = 'Largest planet?';
    question.type = 'free_text';
    question.correctText = 'Jupiter';

    const preview = questionToPreview(question);

    expect(preview).not.toHaveProperty('notes');
    expect(preview).not.toHaveProperty('mediaUrl');
    expect(preview).not.toHaveProperty('answerMediaUrl');
    expect(preview).not.toHaveProperty('options');
  });
});

describe('roundFromPreview', () => {
  it('assigns a generated id to every question via the id factory', () => {
    const round: ImportRoundPreview = {
      title: 'History',
      breakAfter: true,
      questions: [
        { type: 'free_text', prompt: 'Q1', answer: 'A1', points: 1 },
        { type: 'free_text', prompt: 'Q2', answer: 'A2', points: 1 },
      ],
    };

    const editorRound = roundFromPreview('r1', round, (index) => `r1-q${index}`);

    expect(editorRound.questions.map((question) => question.id)).toEqual([
      'r1-q0',
      'r1-q1',
    ]);
    expect(editorRound.title).toBe('History');
    expect(editorRound.breakAfter).toBe(true);
  });
});

describe('toSaveRequest', () => {
  it('trims the quiz/round titles and converts every question', () => {
    const round = makeRound('r1', ' History ');
    round.questions = [
      { ...makeQuestion('q1'), type: 'free_text', prompt: 'Largest planet?', correctText: 'Jupiter' },
    ];

    const request = toSaveRequest(' Trivia Night ', [round]);

    expect(request).toEqual({
      title: 'Trivia Night',
      rounds: [
        {
          title: 'History',
          breakAfter: false,
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter', points: 1 },
          ],
        },
      ],
    });
  });
});
