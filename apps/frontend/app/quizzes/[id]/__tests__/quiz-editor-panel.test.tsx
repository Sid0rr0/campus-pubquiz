import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizDraftApiError } from '@/app/lib/quiz-draft-api';
import { ImportApiError } from '@/app/lib/import-api';
import { QuizEditorPanel } from '@/app/quizzes/[id]/quiz-editor-panel';

const {
  routerRef,
  mockFetchQuizDraft,
  mockCreateQuiz,
  mockUpdateQuiz,
  mockPreviewImport,
} = vi.hoisted(() => ({
  routerRef: { push: vi.fn(), replace: vi.fn() },
  mockFetchQuizDraft: vi.fn(),
  mockCreateQuiz: vi.fn(),
  mockUpdateQuiz: vi.fn(),
  mockPreviewImport: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerRef,
}));

vi.mock('@/app/lib/quiz-draft-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/lib/quiz-draft-api')
  >('@/app/lib/quiz-draft-api');
  return {
    ...actual,
    fetchQuizDraft: mockFetchQuizDraft,
    createQuiz: mockCreateQuiz,
    updateQuiz: mockUpdateQuiz,
  };
});

vi.mock('@/app/lib/import-api', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/import-api')>(
    '@/app/lib/import-api',
  );
  return {
    ...actual,
    previewImport: mockPreviewImport,
  };
});

function makeCsvFile(
  contents = 'round,type,question,options,answer,points,media_url,notes\n',
) {
  return new File([contents], 'quiz.csv', { type: 'text/csv' });
}

describe('QuizEditorPanel', () => {
  beforeEach(() => {
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockFetchQuizDraft.mockReset();
    mockCreateQuiz.mockReset();
    mockUpdateQuiz.mockReset();
    mockPreviewImport.mockReset();
  });

  it('shows the empty state for a new quiz and starts an editable round from scratch', async () => {
    const user = userEvent.setup();
    render(<QuizEditorPanel quizId="new" />);

    expect(screen.getByText(/build a new quiz/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );

    expect(screen.getByPlaceholderText(/round title/i)).toHaveValue('Round 1');
  });

  it('loads an existing quiz into the editor', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          questions: [
            {
              type: 'free_text',
              prompt: 'Largest planet?',
              answer: 'Jupiter',
              points: 2,
            },
          ],
        },
      ],
    });

    render(<QuizEditorPanel quizId="5" />);

    expect(await screen.findByDisplayValue('Trivia Night')).toBeInTheDocument();
    expect(mockFetchQuizDraft).toHaveBeenCalledWith(5);
    expect(screen.getByDisplayValue('History')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/question prompt/i)).toHaveValue(
      'Largest planet?',
    );
    expect(screen.getByPlaceholderText(/accepted answer/i)).toHaveValue(
      'Jupiter',
    );
  });

  it('selecting the YouTube video type shows the clip inputs and requires a media url', async () => {
    const user = userEvent.setup();
    render(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );
    await user.click(screen.getByRole('button', { name: /add question/i }));

    expect(screen.queryByLabelText(/clip start/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^youtube video$/i }));

    expect(
      screen.getByLabelText(/media url \(required\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/clip start/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/clip end/i)).toBeInTheDocument();
  });

  it('shows dedicated clip start/end inputs for a YouTube media url, pre-filled from notes', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        {
          title: 'Music Videos',
          breakAfter: true,
          questions: [
            {
              type: 'picture',
              prompt: 'Name this music video.',
              answer: 'Never Gonna Give You Up',
              points: 3,
              notes:
                'Play the chorus\nYouTube clip: {start: "1:22", end: "2:20"}',
              mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
            },
          ],
        },
      ],
    });

    render(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    expect(screen.getByLabelText(/clip start/i)).toHaveValue('1:22');
    expect(screen.getByLabelText(/clip end/i)).toHaveValue('2:20');
    expect(screen.getByLabelText(/^notes$/i)).toHaveValue('Play the chorus');
  });

  it('recomposes notes when a clip end time is edited', async () => {
    const user = userEvent.setup();
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        {
          title: 'Music Videos',
          breakAfter: true,
          questions: [
            {
              type: 'picture',
              prompt: 'Name this music video.',
              answer: 'Never Gonna Give You Up',
              points: 3,
              notes: 'YouTube clip: {start: "1:22", end: "2:20"}',
              mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
            },
          ],
        },
      ],
    });
    mockUpdateQuiz.mockResolvedValue({
      quizId: 5,
      roundCount: 1,
      questionCount: 1,
    });

    render(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    const endInput = screen.getByLabelText(/clip end/i);
    await user.clear(endInput);
    await user.type(endInput, '3:00');

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    await waitFor(() =>
      expect(mockUpdateQuiz).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          rounds: [
            expect.objectContaining({
              questions: [
                expect.objectContaining({
                  notes: 'YouTube clip: {start: "1:22", end: "3:00"}',
                }),
              ],
            }),
          ],
        }),
      ),
    );
  });

  it('reorders questions within a round via the move up/down buttons', async () => {
    const user = userEvent.setup();
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Question A', answer: 'A', points: 1 },
            { type: 'free_text', prompt: 'Question B', answer: 'B', points: 1 },
          ],
        },
      ],
    });
    mockUpdateQuiz.mockResolvedValue({
      quizId: 5,
      roundCount: 1,
      questionCount: 2,
    });

    render(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    const upButtons = screen.getAllByLabelText(/move question up/i);
    expect(upButtons[0]).toBeDisabled();
    await user.click(upButtons[1]);

    const prompts = screen.getAllByPlaceholderText(/question prompt/i);
    expect(prompts[0]).toHaveValue('Question B');
    expect(prompts[1]).toHaveValue('Question A');

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    await waitFor(() =>
      expect(mockUpdateQuiz).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          rounds: [
            expect.objectContaining({
              questions: [
                expect.objectContaining({ prompt: 'Question B' }),
                expect.objectContaining({ prompt: 'Question A' }),
              ],
            }),
          ],
        }),
      ),
    );
  });

  it('shows a load error when the quiz does not exist', async () => {
    mockFetchQuizDraft.mockRejectedValue(
      new QuizDraftApiError('Quiz 999 does not exist', 404),
    );

    render(<QuizEditorPanel quizId="999" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /quiz 999 does not exist/i,
    );
  });

  it('creates a new quiz and redirects to its stable edit url', async () => {
    const user = userEvent.setup();
    mockCreateQuiz.mockResolvedValue({
      quizId: 42,
      roundCount: 1,
      questionCount: 1,
    });
    render(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );

    await user.type(
      screen.getByPlaceholderText(/untitled quiz/i),
      'Trivia Night',
    );
    await user.click(screen.getByRole('button', { name: /add question/i }));
    await user.type(
      screen.getByPlaceholderText(/question prompt/i),
      'Capital of France?',
    );
    const options = screen.getAllByPlaceholderText(/option text/i);
    await user.type(options[0], 'Paris');
    await user.type(options[1], 'London');
    await user.click(screen.getAllByLabelText(/mark option 1 as correct/i)[0]);

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    await waitFor(() =>
      expect(mockCreateQuiz).toHaveBeenCalledWith({
        title: 'Trivia Night',
        rounds: [
          {
            title: 'Round 1',
            breakAfter: false,
            questions: [
              {
                type: 'multiple_choice',
                prompt: 'Capital of France?',
                answer: 'Paris',
                points: 1,
                options: ['Paris', 'London'],
              },
            ],
          },
        ],
      }),
    );
    expect(routerRef.replace).toHaveBeenCalledWith('/quizzes/42');
  });

  it('updates an existing quiz in place and shows a saved flash', async () => {
    const user = userEvent.setup();
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [{ title: 'History', breakAfter: true, questions: [] }],
    });
    mockUpdateQuiz.mockResolvedValue({
      quizId: 5,
      roundCount: 1,
      questionCount: 0,
    });

    render(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    await waitFor(() =>
      expect(mockUpdateQuiz).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ title: 'Trivia Night' }),
      ),
    );
    expect(
      await screen.findByRole('button', { name: /saved/i }),
    ).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('shows validation issues from a rejected save without crashing', async () => {
    const user = userEvent.setup();
    mockCreateQuiz.mockRejectedValue(
      new QuizDraftApiError('Validation failed', 422, [
        {
          roundIndex: 0,
          questionIndex: 0,
          field: 'prompt',
          message: 'Missing question text',
        },
      ]),
    );
    render(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /validation failed/i,
    );
    expect(
      screen.getByText(/round 1, q1 \(prompt\): missing question text/i),
    ).toBeInTheDocument();
  });

  it('imports a csv into the editable draft instead of saving it directly', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          questions: [
            {
              type: 'free_text',
              prompt: 'Largest planet?',
              answer: 'Jupiter',
              points: 2,
            },
          ],
        },
      ],
      issues: [],
      isImportable: true,
    });

    render(<QuizEditorPanel quizId="new" />);
    const input = screen.getByLabelText(/import csv/i);
    await user.upload(input, makeCsvFile());

    expect(await screen.findByDisplayValue('History')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/question prompt/i)).toHaveValue(
      'Largest planet?',
    );
    expect(mockCreateQuiz).not.toHaveBeenCalled();
  });

  it('shows a csv import error without crashing', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockRejectedValue(
      new ImportApiError('Could not read the CSV file', 200),
    );

    render(<QuizEditorPanel quizId="new" />);
    const input = screen.getByLabelText(/import csv/i);
    await user.upload(input, makeCsvFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not read the csv file/i,
    );
  });
});
