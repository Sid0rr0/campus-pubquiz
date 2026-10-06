import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizDraftApiError } from '@/app/lib/quiz-draft-api';
import { ImportApiError } from '@/app/lib/import-api';
import { QuizEditorPanel } from '@/app/quizzes/[id]/quiz-editor-panel';
import { renderWithQuery } from '@/test-utils/query';

const {
  routerRef,
  mockFetchQuizDraft,
  mockCreateQuiz,
  mockUpdateQuiz,
  mockPreviewImport,
  mockPreviewImportFromUrl,
  mockDownloadTextFile,
} = vi.hoisted(() => ({
  routerRef: { push: vi.fn(), replace: vi.fn() },
  mockFetchQuizDraft: vi.fn(),
  mockCreateQuiz: vi.fn(),
  mockUpdateQuiz: vi.fn(),
  mockPreviewImport: vi.fn(),
  mockPreviewImportFromUrl: vi.fn(),
  mockDownloadTextFile: vi.fn(),
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
    previewImportFromUrl: mockPreviewImportFromUrl,
  };
});

vi.mock('@/app/lib/download-text-file', () => ({
  downloadTextFile: mockDownloadTextFile,
}));

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';

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
    mockPreviewImportFromUrl.mockReset();
    mockDownloadTextFile.mockReset();
  });

  it('shows the empty state for a new quiz and starts an editable round from scratch', async () => {
    const user = userEvent.setup();
    renderWithQuery(<QuizEditorPanel quizId="new" />);

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

    renderWithQuery(<QuizEditorPanel quizId="5" />);

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

  it('exports the editor draft, including unsaved edits, as a csv download', async () => {
    const user = userEvent.setup();
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
    renderWithQuery(<QuizEditorPanel quizId="5" />);
    const promptInput = await screen.findByPlaceholderText(/question prompt/i);
    await user.clear(promptInput);
    await user.type(promptInput, 'Biggest planet?');

    await user.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockDownloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, content, mimeType] = mockDownloadTextFile.mock
      .calls[0] as [string, string, string];
    expect(filename).toBe('trivia-night.csv');
    expect(mimeType).toBe('text/csv;charset=utf-8');
    expect(content).toContain(
      'History,free_text,Biggest planet?,,Jupiter,2,,,,1',
    );
  });

  it('labels each round and delimits every round, upgrading to a break divider once breakAfter is set', async () => {
    const user = userEvent.setup();
    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );
    await user.click(screen.getByRole('button', { name: /add round/i }));

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.queryByText('Break')).not.toBeInTheDocument();

    await user.click(screen.getAllByLabelText(/break after/i)[0]);

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.getByText('Break')).toBeInTheDocument();
  });

  it('disables csv export until the quiz has a question', async () => {
    const user = userEvent.setup();
    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );

    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('selecting the YouTube video type shows the clip inputs and requires a media url', async () => {
    const user = userEvent.setup();
    renderWithQuery(<QuizEditorPanel quizId="new" />);
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
              type: 'free_text',
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

    renderWithQuery(<QuizEditorPanel quizId="5" />);
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
              type: 'free_text',
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

    renderWithQuery(<QuizEditorPanel quizId="5" />);
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

    renderWithQuery(<QuizEditorPanel quizId="5" />);
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

    renderWithQuery(<QuizEditorPanel quizId="999" />);

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
    renderWithQuery(<QuizEditorPanel quizId="new" />);
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
            breakAfter: true,
            kahootMode: false,
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

  it('warns when two multiple-choice options are exactly the same', async () => {
    const user = userEvent.setup();
    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );
    await user.click(screen.getByRole('button', { name: /add question/i }));

    const options = screen.getAllByPlaceholderText(/option text/i);
    await user.type(options[0], 'Paris');
    await user.type(options[1], 'Paris');

    expect(
      await screen.findByText(/options must be unique/i),
    ).toBeInTheDocument();

    await user.clear(options[1]);
    await user.type(options[1], 'London');

    expect(
      screen.queryByText(/options must be unique/i),
    ).not.toBeInTheDocument();
  });

  it('does not warn when multiple-choice options differ only by case', async () => {
    const user = userEvent.setup();
    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );
    await user.click(screen.getByRole('button', { name: /add question/i }));

    const options = screen.getAllByPlaceholderText(/option text/i);
    await user.type(options[0], 'Paris');
    await user.type(options[1], 'paris');

    expect(
      screen.queryByText(/options must be unique/i),
    ).not.toBeInTheDocument();
  });

  it('saves kahootMode: true after checking the Kahoot mode toggle', async () => {
    const user = userEvent.setup();
    mockCreateQuiz.mockResolvedValue({
      quizId: 42,
      roundCount: 1,
      questionCount: 1,
    });
    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );

    await user.type(
      screen.getByPlaceholderText(/untitled quiz/i),
      'Trivia Night',
    );
    await user.click(screen.getByLabelText(/kahoot mode/i));
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
      expect(mockCreateQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          rounds: [expect.objectContaining({ kahootMode: true })],
        }),
      ),
    );
  });

  it('saves category and author after picking a category and typing an author into the round editor', async () => {
    const user = userEvent.setup();
    mockCreateQuiz.mockResolvedValue({
      quizId: 42,
      roundCount: 1,
      questionCount: 1,
    });
    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );

    await user.type(
      screen.getByPlaceholderText(/untitled quiz/i),
      'Trivia Night',
    );
    await user.selectOptions(screen.getByLabelText(/category/i), 'Geography');
    await user.type(
      screen.getByPlaceholderText(/author \(optional\)/i),
      'Alex',
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
      expect(mockCreateQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          rounds: [
            expect.objectContaining({ category: 'Geography', author: 'Alex' }),
          ],
        }),
      ),
    );
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

    renderWithQuery(
      <>
        <QuizEditorPanel quizId="5" />
        <Toaster />
      </>,
    );
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
    expect(await screen.findByText(/quiz saved/i)).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('keeps in-progress edits and lets a second save go through after the post-save background refetch lands', async () => {
    const user = userEvent.setup();
    const baseQuestion = {
      questionId: 1,
      type: 'free_text',
      prompt: 'original prompt',
      answer: 'A',
      points: 1,
    };
    mockFetchQuizDraft.mockResolvedValueOnce({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        { title: 'History', breakAfter: true, questions: [baseQuestion] },
      ],
    });
    // What the post-save cache invalidation refetches — a distinct object
    // reference from the initial load, as a real second HTTP response
    // would be, reflecting the just-saved 'v1' prompt.
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          questions: [{ ...baseQuestion, prompt: 'v1' }],
        },
      ],
    });
    mockUpdateQuiz.mockResolvedValue({
      quizId: 5,
      roundCount: 1,
      questionCount: 1,
    });

    renderWithQuery(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    const saveButton = screen.getByRole('button', { name: /save quiz/i });
    const promptInput = screen.getByPlaceholderText(/question prompt/i);
    await user.clear(promptInput);
    await user.type(promptInput, 'v1');
    await user.click(saveButton);

    await waitFor(() => expect(mockUpdateQuiz).toHaveBeenCalledTimes(1));
    // Let the invalidateQueries-triggered background refetch resolve.
    await waitFor(() => expect(mockFetchQuizDraft).toHaveBeenCalledTimes(2));

    // The question field must survive that refetch untouched — same node,
    // same in-progress value — rather than being remounted/reset.
    const promptInputAfterRefetch =
      screen.getByPlaceholderText(/question prompt/i);
    expect(promptInputAfterRefetch).toBe(promptInput);
    expect(promptInputAfterRefetch).toHaveValue('v1');

    await user.clear(promptInputAfterRefetch);
    await user.type(promptInputAfterRefetch, 'v2');
    await user.click(saveButton);

    await waitFor(() =>
      expect(mockUpdateQuiz).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({
          rounds: [
            expect.objectContaining({
              questions: [expect.objectContaining({ prompt: 'v2' })],
            }),
          ],
        }),
      ),
    );
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
    renderWithQuery(<QuizEditorPanel quizId="new" />);
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

  it('toasts the save failure and shows an inline error next to the offending field', async () => {
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
    renderWithQuery(
      <>
        <QuizEditorPanel quizId="new" />
        <Toaster />
      </>,
    );
    await user.click(
      screen.getByRole('button', { name: /start from scratch/i }),
    );
    await user.click(screen.getByRole('button', { name: /add question/i }));

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    // The toast carries the issue count and is distinct from the persisted
    // top-of-page banner, which shows the bare error message.
    expect(await screen.findByText(/1 issue.*see below/i)).toBeInTheDocument();
    // The message appears both in the top summary list and inline next to
    // the question's prompt field.
    const promptErrors = await screen.findAllByText(/missing question text/i);
    expect(promptErrors.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps an opened question fixable while locking its type, choices and the quiz structure', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          questions: [
            {
              questionId: 1,
              type: 'multiple_choice',
              prompt: 'Largest planet?',
              answer: 'Saturn',
              points: 2,
              options: ['Jupiter', 'Saturn'],
            },
          ],
        },
      ],
      liveEdit: { openedQuestionIds: [1] },
    });

    renderWithQuery(<QuizEditorPanel quizId="5" />);

    expect(
      await screen.findByText(/a session is live on this quiz/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/^opened — its type/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/question prompt/i)).toBeEnabled();
    expect(screen.getByLabelText(/points/i)).toBeEnabled();
    expect(
      screen.getByRole('radio', { name: /mark option 1 as correct/i }),
    ).toBeEnabled();
    for (const optionInput of screen.getAllByPlaceholderText(/option text/i)) {
      expect(optionInput).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /add option/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /free text/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /add round/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /add question/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /delete question/i }),
    ).toBeDisabled();
  });

  it('shows a distinct message and a refresh action for a 409 live-edit conflict', async () => {
    const user = userEvent.setup();
    mockFetchQuizDraft.mockResolvedValueOnce({
      id: 5,
      title: 'Trivia Night',
      rounds: [{ title: 'History', breakAfter: true, questions: [] }],
      liveEdit: { openedQuestionIds: [] },
    });
    mockUpdateQuiz.mockRejectedValue(
      new QuizDraftApiError('Cannot save — 1 change(s) conflict', 409, [
        {
          roundIndex: 0,
          questionIndex: 0,
          field: 'prompt',
          message: 'Cannot edit this question — it has been opened',
        },
      ]),
    );

    renderWithQuery(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    await user.click(screen.getByRole('button', { name: /save quiz/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /refresh to see what changed/i,
    );
    expect(screen.queryByText(/^cannot save/i)).not.toBeInTheDocument();

    mockFetchQuizDraft.mockResolvedValueOnce({
      id: 5,
      title: 'Trivia Night',
      rounds: [{ title: 'History', breakAfter: true, questions: [] }],
      liveEdit: { openedQuestionIds: [42] },
    });
    await user.click(
      screen.getByRole('button', { name: /refresh lock state/i }),
    );

    await waitFor(() => expect(mockFetchQuizDraft).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText(/a session is live on this quiz/i),
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

    renderWithQuery(<QuizEditorPanel quizId="new" />);
    const input = screen.getByLabelText(/import csv/i);
    await user.upload(input, makeCsvFile());

    expect(await screen.findByDisplayValue('History')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/question prompt/i)).toHaveValue(
      'Largest planet?',
    );
    expect(mockCreateQuiz).not.toHaveBeenCalled();
  });

  it('defaults the quiz title to the csv file name on the first import', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'science-round',
      rounds: [{ title: 'Science', breakAfter: true, questions: [] }],
      issues: [],
      isImportable: true,
    });

    renderWithQuery(<QuizEditorPanel quizId="new" />);
    const input = screen.getByLabelText(/import csv/i);
    await user.upload(
      input,
      new File([''], 'science-round.csv', { type: 'text/csv' }),
    );

    expect(await screen.findByDisplayValue('Science')).toBeInTheDocument();
    expect(mockPreviewImport).toHaveBeenCalledWith(
      expect.any(String),
      'science-round',
    );
    expect(screen.getByDisplayValue('science-round')).toBeInTheDocument();
  });

  it('keeps the existing quiz title when importing a csv into a quiz that already has one', async () => {
    const user = userEvent.setup();
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [{ title: 'History', breakAfter: true, questions: [] }],
    });
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Trivia Night',
      rounds: [{ title: 'Geography', breakAfter: true, questions: [] }],
      issues: [],
      isImportable: true,
    });

    renderWithQuery(<QuizEditorPanel quizId="5" />);
    await screen.findByDisplayValue('Trivia Night');

    const input = screen.getByLabelText(/import csv/i);
    await user.upload(
      input,
      new File([''], 'other-file-name.csv', { type: 'text/csv' }),
    );

    await screen.findByDisplayValue('Geography');
    // The existing title wins over the newly uploaded file's name.
    expect(mockPreviewImport).toHaveBeenCalledWith(
      expect.any(String),
      'Trivia Night',
    );
    expect(screen.getByDisplayValue('Trivia Night')).toBeInTheDocument();
  });

  it('adds a csv import to the existing draft instead of replacing it when "add to quiz" is checked', async () => {
    const user = userEvent.setup();
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
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Ignored title',
      rounds: [
        {
          title: 'Geography',
          breakAfter: true,
          questions: [
            {
              type: 'free_text',
              prompt: 'Longest river?',
              answer: 'Nile',
              points: 1,
            },
          ],
        },
      ],
      issues: [],
      isImportable: true,
    });

    renderWithQuery(
      <>
        <QuizEditorPanel quizId="5" />
        <Toaster />
      </>,
    );
    await screen.findByDisplayValue('Trivia Night');

    await user.click(
      screen.getByRole('checkbox', {
        name: /add to quiz instead of replacing/i,
      }),
    );
    const input = screen.getByLabelText(/import csv/i);
    await user.upload(input, makeCsvFile());

    expect(await screen.findByDisplayValue('Geography')).toBeInTheDocument();
    // The pre-existing round and its question survive the import.
    expect(screen.getByDisplayValue('History')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Largest planet?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Longest river?')).toBeInTheDocument();
    // The imported quizTitle is ignored — the existing title isn't overwritten.
    expect(screen.getByDisplayValue('Trivia Night')).toBeInTheDocument();
    expect(await screen.findByText(/added 1 question/i)).toBeInTheDocument();
  });

  it('shows a csv import error without crashing', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockRejectedValue(
      new ImportApiError('Could not read the CSV file', 200),
    );

    renderWithQuery(<QuizEditorPanel quizId="new" />);
    const input = screen.getByLabelText(/import csv/i);
    await user.upload(input, makeCsvFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not read the csv file/i,
    );
  });

  it('imports from a pasted Google Sheets url into the editable draft', async () => {
    const user = userEvent.setup();
    mockPreviewImportFromUrl.mockResolvedValue({
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

    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.type(screen.getByLabelText(/google sheets link/i), SHEET_URL);
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    expect(await screen.findByDisplayValue('History')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/question prompt/i)).toHaveValue(
      'Largest planet?',
    );
    expect(mockPreviewImportFromUrl).toHaveBeenCalledWith(SHEET_URL, undefined);
    expect(mockCreateQuiz).not.toHaveBeenCalled();
  });

  it('shows a sheet fetch error without crashing', async () => {
    const user = userEvent.setup();
    mockPreviewImportFromUrl.mockRejectedValue(
      new ImportApiError('Could not fetch that sheet', 422),
    );

    renderWithQuery(<QuizEditorPanel quizId="new" />);
    await user.type(screen.getByLabelText(/google sheets link/i), SHEET_URL);
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not fetch that sheet/i,
    );
  });

  describe('kahoot mode question types', () => {
    const TYPE_LABELS = [
      'Multiple choice',
      'Free text',
      'Audio',
      'YouTube video',
      'Sort / order',
      'Match pairs',
      'Closest guess',
    ];
    const KAHOOT_LABELS = ['Multiple choice', 'Sort / order', 'Match pairs'];

    const multipleChoice = {
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 1000,
      options: ['Paris', 'London'],
    };
    const freeText = {
      type: 'free_text',
      prompt: 'Largest planet?',
      answer: 'Jupiter',
      points: 2,
    };

    function loadQuiz(rounds: unknown[]) {
      mockFetchQuizDraft.mockResolvedValue({
        id: 5,
        title: 'Trivia Night',
        rounds,
      });
      return renderWithQuery(<QuizEditorPanel quizId="5" />);
    }

    /** The type-picker buttons rendered inside the card of the round with this title. */
    function typeLabelsInRound(roundTitle: string): string[] {
      const card = screen
        .getByDisplayValue(roundTitle)
        .closest('[id^="round-"]') as HTMLElement;
      return within(card)
        .getAllByRole('button')
        .map((button) => button.textContent ?? '')
        .filter((label) => TYPE_LABELS.includes(label));
    }

    it('offers only kahoot-allowed types in a kahoot round, leaving other rounds unaffected', async () => {
      loadQuiz([
        {
          title: 'Speed',
          breakAfter: false,
          kahootMode: true,
          questions: [multipleChoice],
        },
        {
          title: 'Normal',
          breakAfter: true,
          kahootMode: false,
          questions: [freeText],
        },
      ]);
      await screen.findByDisplayValue('Speed');

      expect(typeLabelsInRound('Speed')).toEqual(KAHOOT_LABELS);
      expect(typeLabelsInRound('Normal')).toEqual(TYPE_LABELS);
    });

    it('restores every type in the round once kahoot mode is turned off', async () => {
      const user = userEvent.setup();
      loadQuiz([
        {
          title: 'Speed',
          breakAfter: true,
          kahootMode: true,
          questions: [multipleChoice],
        },
      ]);
      await screen.findByDisplayValue('Speed');

      await user.click(screen.getByLabelText(/kahoot mode/i));

      expect(typeLabelsInRound('Speed')).toEqual(TYPE_LABELS);
    });

    it('disables the kahoot toggle with a hint naming the blocking questions, linked to the toggle', async () => {
      loadQuiz([
        {
          title: 'Mixed',
          breakAfter: true,
          kahootMode: false,
          questions: [
            multipleChoice,
            freeText,
            { ...freeText, prompt: 'Another?' },
          ],
        },
      ]);
      await screen.findByDisplayValue('Mixed');

      const toggle = screen.getByLabelText(/kahoot mode/i);
      expect(toggle).toBeDisabled();
      const hint = screen.getByText(/change or remove questions 2, 3 first/i);
      expect(toggle.getAttribute('aria-describedby')?.split(' ')).toContain(
        hint.id,
      );
    });

    it('enables the toggle once the blocking question is changed to an allowed type', async () => {
      const user = userEvent.setup();
      loadQuiz([
        {
          title: 'Mixed',
          breakAfter: true,
          kahootMode: false,
          questions: [freeText],
        },
      ]);
      await screen.findByDisplayValue('Mixed');
      expect(screen.getByLabelText(/kahoot mode/i)).toBeDisabled();
      expect(
        screen.getByText(/change or remove question 1 first/i),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Multiple choice' }));

      expect(screen.getByLabelText(/kahoot mode/i)).toBeEnabled();
      expect(screen.queryByText(/change or remove/i)).not.toBeInTheDocument();
    });

    it('enables the toggle once the blocking question is deleted', async () => {
      const user = userEvent.setup();
      loadQuiz([
        {
          title: 'Mixed',
          breakAfter: true,
          kahootMode: false,
          questions: [multipleChoice, freeText],
        },
      ]);
      await screen.findByDisplayValue('Mixed');
      expect(screen.getByLabelText(/kahoot mode/i)).toBeDisabled();

      await user.click(
        screen.getAllByRole('button', { name: /delete question/i })[1],
      );

      expect(screen.getByLabelText(/kahoot mode/i)).toBeEnabled();
    });

    it('never changes a question type when the toggle is blocked', async () => {
      loadQuiz([
        {
          title: 'Mixed',
          breakAfter: true,
          kahootMode: false,
          questions: [freeText],
        },
      ]);
      await screen.findByDisplayValue('Mixed');

      expect(screen.getByPlaceholderText(/accepted answer/i)).toHaveValue(
        'Jupiter',
      );
    });
  });
});
