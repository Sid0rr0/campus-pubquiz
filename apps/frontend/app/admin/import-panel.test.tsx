import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportApiError } from '@/app/lib/import-api';
import { ImportPanel } from '@/app/admin/import-panel';

const { mockPreviewImport, mockConfirmImport } = vi.hoisted(() => ({
  mockPreviewImport: vi.fn(),
  mockConfirmImport: vi.fn(),
}));

vi.mock('@/app/lib/import-api', async () => {
  const actual =
    await vi.importActual<typeof import('@/app/lib/import-api')>('@/app/lib/import-api');
  return {
    ...actual,
    previewImport: mockPreviewImport,
    confirmImport: mockConfirmImport,
  };
});

function makeCsvFile(contents = 'round,type,question,options,answer,points,media_url,notes\n') {
  return new File([contents], 'quiz.csv', { type: 'text/csv' });
}

async function uploadCsv(user: ReturnType<typeof userEvent.setup>, contents?: string) {
  const input = screen.getByLabelText(/quiz csv file/i);
  await user.upload(input, makeCsvFile(contents));
}

describe('ImportPanel', () => {
  beforeEach(() => {
    mockPreviewImport.mockReset();
    mockConfirmImport.mockReset();
  });

  it('previews the uploaded csv and shows the parsed rounds', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter', points: 2 }],
        },
      ],
      issues: [],
      isImportable: true,
    });

    render(<ImportPanel joinCode="TESTCODE" />);
    await uploadCsv(user);

    await waitFor(() => expect(mockPreviewImport).toHaveBeenCalledWith(
      expect.stringContaining('round,type,question'),
      undefined,
    ));
    expect(await screen.findByText('History')).toBeInTheDocument();
    expect(screen.getByText('Largest planet?')).toBeInTheDocument();
    expect(screen.getByText(/answer: jupiter/i)).toBeInTheDocument();
  });

  it('shows the options for a multiple choice question in the preview', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [
        {
          title: 'History',
          breakAfter: false,
          questions: [
            {
              type: 'multiple_choice',
              prompt: 'Capital of France?',
              options: ['Paris', 'London', 'Berlin'],
              answer: 'Paris',
              points: 2,
            },
          ],
        },
      ],
      issues: [],
      isImportable: true,
    });

    render(<ImportPanel joinCode="TESTCODE" />);
    await uploadCsv(user);

    expect(await screen.findByText(/options: paris, london, berlin/i)).toBeInTheDocument();
    expect(screen.getByText(/answer: paris/i)).toBeInTheDocument();
  });

  it('shows a break-after indicator only for rounds with breakAfter true', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [
        { title: 'History', breakAfter: false, questions: [] },
        { title: 'Music', breakAfter: true, questions: [] },
      ],
      issues: [],
      isImportable: true,
    });

    render(<ImportPanel joinCode="TESTCODE" />);
    await uploadCsv(user);

    const historyItem = (await screen.findByText('History')).closest('li');
    const musicItem = screen.getByText('Music').closest('li');
    expect(historyItem).not.toHaveTextContent(/break after this round/i);
    expect(musicItem).toHaveTextContent(/break after this round/i);
  });

  it('lists per-row issues and disables confirm when the sheet is not importable', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [],
      issues: [{ rowNumber: 3, field: 'answer', message: 'Missing answer' }],
      isImportable: false,
    });

    render(<ImportPanel joinCode="TESTCODE" />);
    await uploadCsv(user);

    expect(await screen.findByText(/missing answer/i)).toBeInTheDocument();
    expect(screen.getByText(/row 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm import/i })).toBeDisabled();
  });

  it('enables confirm once the preview is importable and calls confirmImport on click', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [{ title: 'History', breakAfter: true, questions: [] }],
      issues: [],
      isImportable: true,
    });
    mockConfirmImport.mockResolvedValue({ quizId: 'quiz-1', roundCount: 1, questionCount: 3 });
    const onImported = vi.fn();

    render(<ImportPanel joinCode="TESTCODE" onImported={onImported} />);
    await uploadCsv(user);
    await screen.findByText('History');

    const confirmButton = screen.getByRole('button', { name: /confirm import/i });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => expect(mockConfirmImport).toHaveBeenCalledWith(
      expect.stringContaining('round,type,question'),
      undefined,
      'TESTCODE',
    ));
    expect(onImported).toHaveBeenCalledWith({ quizId: 'quiz-1', roundCount: 1, questionCount: 3 });
  });

  it('shows a server error from confirm without crashing', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Imported Quiz',
      rounds: [{ title: 'History', breakAfter: true, questions: [] }],
      issues: [],
      isImportable: true,
    });
    mockConfirmImport.mockRejectedValue(new ImportApiError('A quiz is currently running', 409));

    render(<ImportPanel joinCode="TESTCODE" />);
    await uploadCsv(user);
    await screen.findByText('History');

    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/quiz is currently running/i);
  });

  it('shows a preview error from a malformed csv without crashing', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockRejectedValue(new ImportApiError('Could not read the CSV file', 200));

    render(<ImportPanel joinCode="TESTCODE" />);
    await uploadCsv(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not read the csv file/i);
  });

  it('sends the optional quiz title typed by the admin', async () => {
    const user = userEvent.setup();
    mockPreviewImport.mockResolvedValue({
      quizTitle: 'Trivia Night',
      rounds: [],
      issues: [],
      isImportable: true,
    });

    render(<ImportPanel joinCode="TESTCODE" />);
    await user.type(screen.getByLabelText(/quiz title/i), 'Trivia Night');
    await uploadCsv(user);

    await waitFor(() => expect(mockPreviewImport).toHaveBeenCalledWith(
      expect.any(String),
      'Trivia Night',
    ));
  });
});
