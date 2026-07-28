import { describe, expect, it } from 'vitest';
import {
  createImportPreview,
  type ImportConfirmResult,
  type ImportRequest,
  type ImportRoundPreview,
  type ImportRowIssue,
  type SheetRow,
} from './import';

const QUESTION_ROUND: ImportRoundPreview = {
  title: 'Round 1: General Knowledge',
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 2,
      options: ['Paris', 'London', 'Berlin', 'Rome'],
    },
  ],
};

describe('createImportPreview', () => {
  it('is importable when there are questions and no issues', () => {
    // Arrange
    const rounds = [QUESTION_ROUND];
    const issues: ImportRowIssue[] = [];

    // Act
    const preview = createImportPreview('Imported Quiz', rounds, issues);

    // Assert
    expect(preview).toEqual({
      quizTitle: 'Imported Quiz',
      rounds,
      issues: [],
      isImportable: true,
    });
  });

  it('is not importable when any row has an issue', () => {
    // Arrange
    const issues: ImportRowIssue[] = [
      { rowNumber: 2, field: 'answer', message: 'Missing answer' },
    ];

    // Act
    const preview = createImportPreview('Imported Quiz', [QUESTION_ROUND], issues);

    // Assert
    expect(preview.isImportable).toBe(false);
    expect(preview.issues).toEqual(issues);
  });

  it('is not importable when the sheet yields no questions at all', () => {
    // Act
    const preview = createImportPreview('Imported Quiz', [], []);

    // Assert
    expect(preview.isImportable).toBe(false);
  });
});

describe('import payload contracts', () => {
  it('carries raw sheet cells with their 1-based row number for issue reporting', () => {
    const row: SheetRow = {
      rowNumber: 2,
      round: 'Round 1',
      type: 'multiple_choice',
      question: 'Capital of France?',
      options: 'Paris|London|Berlin|Rome',
      answer: 'Paris',
      points: '2',
      mediaUrl: '',
      notes: '',
      breakAfter: '',
    };
    const issue: ImportRowIssue = {
      rowNumber: row.rowNumber,
      field: 'points',
      message: 'Points must be a positive whole number',
    };

    expect(issue.rowNumber).toBe(row.rowNumber);
  });

  it('carries the uploaded csv text and optional quiz title through the REST DTOs', () => {
    const request: ImportRequest = {
      csvText: 'round,type,question,options,answer,points,media_url,notes\n',
      quizTitle: 'Trivia Night #4',
    };
    const result: ImportConfirmResult = {
      quizId: 'quiz-1',
      roundCount: 2,
      questionCount: 10,
    };

    expect(request.csvText).toContain('round,type,question');
    expect(result.questionCount).toBeGreaterThan(0);
  });
});
