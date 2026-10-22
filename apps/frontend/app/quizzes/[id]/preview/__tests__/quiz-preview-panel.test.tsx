import { screen, within } from '@testing-library/react';
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

const { searchParamsRef, mockReplace } = vi.hoisted(() => ({
  searchParamsRef: { current: new URLSearchParams() },
  mockReplace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  usePathname: () => '/quizzes/7/preview',
  useRouter: () => ({ replace: mockReplace }),
}));

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
    mockReplace.mockReset();
    searchParamsRef.current = new URLSearchParams();
  });

  it('reads ?mode=night on load and asks for the night order', async () => {
    searchParamsRef.current = new URLSearchParams('mode=night');
    mockFetchQuizPreview.mockResolvedValue(buildQuizPreview(ROUNDS, 'night'));
    renderWithQuery(<QuizPreviewPanel quizId="7" />);
    await screen.findByRole('button', { name: /next/i });

    expect(mockFetchQuizPreview).toHaveBeenCalledWith(
      7,
      'night',
      false,
      expect.anything(),
    );
    expect(
      screen.getByRole('button', { name: /like the night/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes ?mode=night to the URL when switched to like the night', async () => {
    const user = userEvent.setup();
    await renderPreview();

    await user.click(screen.getByRole('button', { name: /like the night/i }));

    expect(mockReplace).toHaveBeenCalledWith('/quizzes/7/preview?mode=night');
  });

  it('omits the default mode from the URL when switched back', async () => {
    const user = userEvent.setup();
    searchParamsRef.current = new URLSearchParams('mode=night');
    mockFetchQuizPreview.mockResolvedValue(buildQuizPreview(ROUNDS, 'night'));
    renderWithQuery(<QuizPreviewPanel quizId="7" />);
    await screen.findByRole('button', { name: /next/i });

    await user.click(
      screen.getByRole('button', { name: /question → answer/i }),
    );

    expect(mockReplace).toHaveBeenCalledWith('/quizzes/7/preview');
  });

  it('draws the night order: the break intro comes between questions and reveals', async () => {
    const user = userEvent.setup();
    searchParamsRef.current = new URLSearchParams('mode=night');
    mockFetchQuizPreview.mockResolvedValue(buildQuizPreview(ROUNDS, 'night'));
    renderWithQuery(<QuizPreviewPanel quizId="7" />);
    await screen.findByRole('button', { name: /next/i });

    // overview, title, Q1, Q2, break intro
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.getByText('Step 5 of 8')).toBeInTheDocument();
    expect(screen.getByText(/break/i)).toBeInTheDocument();
  });

  it('asks for the saved quiz in the default order', async () => {
    await renderPreview();

    expect(mockFetchQuizPreview).toHaveBeenCalledWith(
      7,
      'answer_after_question',
      false,
      expect.anything(),
    );
  });

  describe('with jokers', () => {
    const JOKER_NIGHT = buildQuizPreview(ROUNDS, 'night', { withJokers: true });

    function renderNight(
      search: string,
      preview = buildQuizPreview(ROUNDS, 'night'),
    ) {
      searchParamsRef.current = new URLSearchParams(search);
      mockFetchQuizPreview.mockResolvedValue(preview);
      renderWithQuery(<QuizPreviewPanel quizId="7" />);
      return screen.findByRole('button', { name: /next/i });
    }

    it('offers the switch in the night order only, off by default', async () => {
      await renderPreview();
      expect(
        screen.queryByRole('checkbox', { name: /with jokers/i }),
      ).not.toBeInTheDocument();
    });

    it('is off by default in the night order and asks for no jokers', async () => {
      await renderNight('mode=night');

      expect(
        screen.getByRole('checkbox', { name: /with jokers/i }),
      ).not.toBeChecked();
      expect(mockFetchQuizPreview).toHaveBeenCalledWith(
        7,
        'night',
        false,
        expect.anything(),
      );
    });

    it('reads ?jokers=true on load and asks for the joker pick', async () => {
      await renderNight('mode=night&jokers=true', JOKER_NIGHT);

      expect(
        screen.getByRole('checkbox', { name: /with jokers/i }),
      ).toBeChecked();
      expect(mockFetchQuizPreview).toHaveBeenCalledWith(
        7,
        'night',
        true,
        expect.anything(),
      );
    });

    it('writes ?jokers=true to the URL when switched on', async () => {
      const user = userEvent.setup();
      await renderNight('mode=night');

      await user.click(screen.getByRole('checkbox', { name: /with jokers/i }));

      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?mode=night&jokers=true',
      );
    });

    it('drops ?jokers from the URL when switched off', async () => {
      const user = userEvent.setup();
      await renderNight('mode=night&jokers=true', JOKER_NIGHT);

      await user.click(screen.getByRole('checkbox', { name: /with jokers/i }));

      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?mode=night',
      );
    });

    it('shows the joker pick screen after the overview and addresses it by ?at=', async () => {
      const user = userEvent.setup();
      await renderNight('mode=night&jokers=true', JOKER_NIGHT);

      await user.keyboard('{ArrowRight}');

      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
      expect(screen.getByText('Pick your joker')).toBeInTheDocument();
      expect(screen.getByText('0/0 picked')).toBeInTheDocument();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?mode=night&jokers=true&at=r1-jokers',
      );
    });
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

  describe('jump list', () => {
    const jumpList = () => screen.getByRole('navigation', { name: /jump to/i });

    it('lists the rounds and their questions', async () => {
      await renderPreview();

      const list = within(jumpList());
      expect(list.getByRole('button', { name: /geography/i })).toBeVisible();
      expect(
        list.getByRole('button', { name: /capital of france\?/i }),
      ).toBeVisible();
      expect(
        list.getByRole('button', { name: /largest planet\?/i }),
      ).toBeVisible();
    });

    it('moves to the chosen question and writes it to the URL', async () => {
      const user = userEvent.setup();
      await renderPreview();

      await user.click(
        within(jumpList()).getByRole('button', { name: /largest planet\?/i }),
      );

      expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
      expect(screen.queryByText('Jupiter')).not.toBeInTheDocument();
      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?at=r1q2',
      );
    });

    it('moves back to a round title card and leaves ?at= out for the first step', async () => {
      const user = userEvent.setup();
      searchParamsRef.current = new URLSearchParams('at=r1q2');
      await renderPreview();

      await user.click(
        within(jumpList()).getByRole('button', { name: /geography/i }),
      );

      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      expect(mockReplace).toHaveBeenLastCalledWith('/quizzes/7/preview');
    });

    it('in the night order lists the same rounds and questions and jumps to the question screen', async () => {
      const user = userEvent.setup();
      searchParamsRef.current = new URLSearchParams('mode=night');
      mockFetchQuizPreview.mockResolvedValue(buildQuizPreview(ROUNDS, 'night'));
      renderWithQuery(<QuizPreviewPanel quizId="7" />);
      await screen.findByRole('button', { name: /next/i });

      await user.click(
        within(jumpList()).getByRole('button', { name: /largest planet\?/i }),
      );

      expect(screen.getByText('Step 4 of 8')).toBeInTheDocument();
      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?mode=night&at=r1q2',
      );
    });
  });

  describe('?at=', () => {
    it('opens at the named question', async () => {
      searchParamsRef.current = new URLSearchParams('at=r1q2');
      await renderPreview();

      expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
      expect(screen.getByText('Largest planet?')).toBeInTheDocument();
      expect(screen.queryByText('Jupiter')).not.toBeInTheDocument();
    });

    it('opens at the named answer', async () => {
      searchParamsRef.current = new URLSearchParams('at=r1q1-answer');
      await renderPreview();

      expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
      expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);
    });

    it('is read in the night order too', async () => {
      searchParamsRef.current = new URLSearchParams('mode=night&at=r1q2');
      mockFetchQuizPreview.mockResolvedValue(buildQuizPreview(ROUNDS, 'night'));
      renderWithQuery(<QuizPreviewPanel quizId="7" />);
      await screen.findByRole('button', { name: /next/i });

      expect(screen.getByText('Step 4 of 8')).toBeInTheDocument();
    });

    it('falls back to the first step for an unknown position', async () => {
      searchParamsRef.current = new URLSearchParams('at=r9q9');
      await renderPreview();

      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('is kept up to date while stepping with the buttons and the arrow keys', async () => {
      const user = userEvent.setup();
      await renderPreview();

      await user.click(screen.getByRole('button', { name: /next/i }));
      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?at=r1q1',
      );

      await user.keyboard('{ArrowRight}');
      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?at=r1q1-answer',
      );

      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(mockReplace).toHaveBeenLastCalledWith('/quizzes/7/preview');
    });

    it('is kept when the order is switched', async () => {
      const user = userEvent.setup();
      searchParamsRef.current = new URLSearchParams('at=r1q2');
      await renderPreview();

      await user.click(screen.getByRole('button', { name: /like the night/i }));

      expect(mockReplace).toHaveBeenLastCalledWith(
        '/quizzes/7/preview?mode=night&at=r1q2',
      );
    });
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

  describe('host-only panel', () => {
    const NOTED_ROUNDS: SeededRound[] = [
      {
        id: 1,
        title: 'Geography',
        breakAfter: true,
        note: 'Warm the room up',
        showNoteOnScreen: false,
        questions: [question(1, 'Capital of France?', 'Paris')],
        questionNotesById: { 1: 'Accept Paris, France' },
      },
    ];

    async function renderNoted() {
      mockFetchQuizPreview.mockResolvedValue(
        buildQuizPreview(NOTED_ROUNDS, 'answer_after_question'),
      );
      renderWithQuery(<QuizPreviewPanel quizId="7" />);
      await screen.findByRole('button', { name: /next/i });
    }

    it('shows the round note on the title card and the question note on the question', async () => {
      const user = userEvent.setup();
      await renderNoted();

      const panel = screen.getByRole('complementary', { name: /host only/i });
      expect(within(panel).getByText('Warm the room up')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /next/i }));
      expect(
        within(panel).getByText('Accept Paris, France'),
      ).toBeInTheDocument();
      expect(
        within(panel).queryByText('Warm the room up'),
      ).not.toBeInTheDocument();
    });

    it('says there is nothing host-only when the step has no text', async () => {
      await renderPreview();

      const panel = screen.getByRole('complementary', { name: /host only/i });
      expect(within(panel).getByText(/nothing host-only/i)).toBeInTheDocument();
    });
  });

  describe('fullscreen', () => {
    async function enterFullscreen() {
      const user = userEvent.setup();
      mockFetchQuizPreview.mockResolvedValue(
        buildQuizPreview(
          [
            {
              ...ROUNDS[0],
              questionNotesById: { 1: 'Accept Paris, France' },
            },
          ],
          'answer_after_question',
        ),
      );
      renderWithQuery(<QuizPreviewPanel quizId="7" />);
      await screen.findByRole('button', { name: /next/i });
      await user.click(screen.getByRole('button', { name: /fullscreen/i }));
      return user;
    }

    it('shows the frame alone: no host-only panel, jump list or controls', async () => {
      await enterFullscreen();

      expect(screen.getByTestId('preview-frame')).toBeInTheDocument();
      expect(screen.getByText('Geography')).toBeInTheDocument();
      expect(
        screen.queryByRole('complementary', { name: /host only/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: /jump to/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /next/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /like the night/i }),
      ).not.toBeInTheDocument();
    });

    it('still steps with the arrow keys', async () => {
      const user = await enterFullscreen();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByText('Capital of France?')).toBeInTheDocument();
      await user.keyboard('{ArrowRight}');
      expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);
      await user.keyboard('{ArrowLeft}');
      expect(screen.queryByText('Paris')).not.toBeInTheDocument();
    });

    it('leaves on Escape, back to the panel, list and controls at the same step', async () => {
      const user = await enterFullscreen();
      await user.keyboard('{ArrowRight}');

      await user.keyboard('{Escape}');

      expect(
        screen.getByRole('complementary', { name: /host only/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('navigation', { name: /jump to/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    });
  });
});
