import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  buildQuizPreview,
  type SeededQuestion,
  type SeededRound,
} from '@campus-pubquiz/types';
import { MotionGlobalConfig } from 'motion/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizPreviewApiError } from '@/app/lib/quiz-preview-api';
import { QuizPreviewPanel } from '@/app/quizzes/[id]/preview/quiz-preview-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchQuizPreview } = vi.hoisted(() => ({
  mockFetchQuizPreview: vi.fn(),
}));

vi.mock('@/app/lib/quiz-preview-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/lib/quiz-preview-api')
  >('@/app/lib/quiz-preview-api');
  return { ...actual, fetchQuizPreview: mockFetchQuizPreview };
});

function question(id: number, prompt: string, answer: string): SeededQuestion {
  return { id, type: 'free_text', prompt, answer, points: 1000 };
}

const ROUNDS: SeededRound[] = [
  {
    id: 1,
    title: 'Geography',
    breakAfter: true,
    questions: [
      question(1, 'Capital of France?', 'Paris'),
      question(2, 'Largest planet?', 'Jupiter'),
    ],
  },
];

// Title card, Q1, A1, Q2, A2.
const PREVIEW = buildQuizPreview(ROUNDS, 'answer_after_question');

async function renderPreview() {
  mockFetchQuizPreview.mockResolvedValue(PREVIEW);
  renderWithQuery(<QuizPreviewPanel quizId="7" />);
  await screen.findByRole('button', { name: /next/i });
}

describe('QuizPreviewPanel', () => {
  beforeAll(() => {
    // happy-dom rejects when motion cancels a running entrance as the step changes.
    MotionGlobalConfig.skipAnimations = true;
  });

  beforeEach(() => {
    mockFetchQuizPreview.mockReset();
  });

  it('asks for the saved quiz in the default order', async () => {
    await renderPreview();

    expect(mockFetchQuizPreview).toHaveBeenCalledWith(
      7,
      'answer_after_question',
      expect.anything(),
    );
  });

  it('draws the first step, the round title card, with the shared display component', async () => {
    await renderPreview();

    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.getByText(/ROUND 1/)).toBeInTheDocument();
  });

  it('steps through question then answer with the Next and Prev buttons', async () => {
    const user = userEvent.setup();
    await renderPreview();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.queryByText('Paris')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /prev/i }));
    expect(screen.queryByText('Paris')).not.toBeInTheDocument();
  });

  it('moves one step with the arrow keys and stops at both ends', async () => {
    const user = userEvent.setup();
    await renderPreview();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('marks where the block ends, on the last answer only', async () => {
    const user = userEvent.setup();
    await renderPreview();

    expect(screen.queryByText(/block ends here/i)).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.queryByText(/block ends here/i)).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/block ends here/i)).toBeInTheDocument();
  });

  it('says so when the quiz does not exist', async () => {
    mockFetchQuizPreview.mockRejectedValue(
      new QuizPreviewApiError('Quiz 7 does not exist', 404),
    );
    renderWithQuery(<QuizPreviewPanel quizId="7" />);

    expect(await screen.findByText(/quiz not found/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next/i }),
    ).not.toBeInTheDocument();
  });

  it('shows a plain empty state for a quiz with nothing to preview', async () => {
    mockFetchQuizPreview.mockResolvedValue(
      buildQuizPreview([], 'answer_after_question'),
    );
    renderWithQuery(<QuizPreviewPanel quizId="7" />);

    expect(await screen.findByText(/nothing to preview/i)).toBeInTheDocument();
  });
});
