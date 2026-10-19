/**
 * Helpers for the live answer-key fix journey: a quiz built from its own CSV,
 * and the quiz master's save that corrects one question's answer key while a
 * session is running (the same `PUT /quizzes/:id` the quiz editor sends).
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import { PATHS } from './env';

/** The part of `GET /quizzes/:id` this journey reads; the rest of each round and question is passed through untouched. */
interface QuizDraftResponse {
  title: string;
  rounds: Array<{
    questions: Array<{ prompt: string; answer: string }>;
  }>;
}

export const ANSWER_KEY_FIX = {
  roundTitle: 'Key check',
  /** `multiple_choice`: the CSV key is the wrong option, so the right pick starts out graded wrong. */
  choice: {
    prompt: 'Which planet is known as the Red Planet?',
    wrongKey: 'Venus',
    rightKey: 'Mars',
    points: 3,
  },
  /** `free_text`: a typed answer is graded at submit time against the key. */
  freeText: {
    prompt: 'What is the capital of France?',
    key: 'Paris',
    otherKey: 'Lutetia',
    points: 2,
  },
} as const;

const CSV_PATH = path.join(PATHS.e2eRoot, 'fixtures', 'answer-key-fix.csv');

interface ImportPreviewResponse {
  isImportable: boolean;
  issues: unknown[];
  rounds: unknown[];
}

/** Imports `fixtures/answer-key-fix.csv` as a new quiz titled `quizTitle` and returns its id. */
export async function importAnswerKeyFixQuiz(
  api: APIRequestContext,
  quizTitle: string,
): Promise<number> {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const previewResponse = await api.post('/import/preview', {
    data: { csvText, quizTitle },
  });
  expect(previewResponse.ok(), 'import preview').toBe(true);
  const preview = (await previewResponse.json()) as ImportPreviewResponse;
  expect(preview.issues, 'import issues').toEqual([]);
  expect(preview.isImportable).toBe(true);

  const saveResponse = await api.post('/quizzes', {
    data: { title: quizTitle, rounds: preview.rounds },
  });
  expect(saveResponse.ok(), `save quiz: ${await saveResponse.text()}`).toBe(
    true,
  );
  return ((await saveResponse.json()) as { quizId: number }).quizId;
}

/** Saves the quiz with the answer of the question named by `prompt` replaced; everything else is sent back as it was. */
export async function fixAnswerKey(
  api: APIRequestContext,
  quizId: number,
  prompt: string,
  answer: string,
): Promise<void> {
  const draftResponse = await api.get(`/quizzes/${quizId}`);
  expect(draftResponse.ok(), 'load quiz draft').toBe(true);
  const draft = (await draftResponse.json()) as QuizDraftResponse;
  const rounds = draft.rounds.map((round) => ({
    ...round,
    questions: round.questions.map((question) =>
      question.prompt === prompt ? { ...question, answer } : question,
    ),
  }));
  const saveResponse = await api.put(`/quizzes/${quizId}`, {
    data: { title: draft.title, rounds },
  });
  expect(
    saveResponse.ok(),
    `fix answer key: ${await saveResponse.text()}`,
  ).toBe(true);
}
