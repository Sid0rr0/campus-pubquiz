import type { ImportRoundPreview } from '@campus-pubquiz/types';
import {
  findDroppedAnsweredQuestions,
  findForeignQuestionIds,
  findMovedAnsweredQuestions,
} from '@/quiz/live-edit-guard';

const q = (questionId: number) => ({
  questionId,
  type: 'free_text' as const,
  prompt: 'Q',
  answer: 'A',
  points: 1,
});
const round = (...ids: number[]): ImportRoundPreview => ({
  title: 'R',
  breakAfter: false,
  questions: ids.map(q),
});

const noId = { ...q(0), questionId: undefined };
const withNew = (...ids: number[]): ImportRoundPreview => ({
  ...round(...ids),
  questions: [...round(...ids).questions, noId],
});
const at = (roundIndex: number, questionIndex: number) => ({
  roundIndex,
  questionIndex,
  field: 'questionId',
  message: expect.any(String),
});

describe('live-edit guard picks exactly the offending questions', () => {
  it('flags only incoming ids the quiz does not hold', () => {
    expect(
      findForeignQuestionIds([withNew(1)], [round(9), withNew(1)]),
    ).toEqual([at(0, 0)]);
  });

  it('flags only answered questions that are dropped', () => {
    expect(
      findDroppedAnsweredQuestions(
        [withNew(1, 2, 3)],
        [round(1)],
        new Set([1, 2]),
      ),
    ).toEqual([at(0, 1)]);
  });

  it('flags only answered questions that land in another round', () => {
    expect(
      findMovedAnsweredQuestions(
        [withNew(1, 2, 3, 4), round(5)],
        [round(1), withNew(2, 3, 5)],
        // 1 stays, 2 and 3 move (3 unanswered), 4 is dropped, 5 is answered but kept in place
        new Set([1, 2, 4, 5]),
      ),
    ).toEqual([at(0, 1)]);
  });
});

describe('live-edit guard issues say why', () => {
  it('names a question from another quiz', () => {
    const [issue] = findForeignQuestionIds([round(1)], [round(1, 99)]);
    expect(issue.message).toMatch(/does not belong to this quiz/);
  });

  it('names an answered question a save would drop', () => {
    const [issue] = findDroppedAnsweredQuestions(
      [round(1, 2)],
      [round(1)],
      new Set([2]),
    );
    expect(issue.message).toMatch(/Cannot delete or replace/);
  });

  it('names an answered question a save would move to another round', () => {
    const [issue] = findMovedAnsweredQuestions(
      [round(1), round(2)],
      [round(2), round(1)],
      new Set([1]),
    );
    expect(issue.message).toMatch(/Cannot move a question/);
  });
});
