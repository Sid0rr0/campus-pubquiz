import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { seenQuestionsOf, socketResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TEAM = {
  teamId: 1,
  teamName: 'Returning Team',
  teamToken: 'team-token-1',
};

const GRADED_AT = '2024-01-01T00:00:00.000Z';

const FRUIT = { prompt: 'Name a fruit', points: 5, answer: 'Banana' };
const PLANET = { prompt: 'Name a planet', points: 5, answer: 'Mars' };
const HEROES = {
  type: 'match' as const,
  prompt: 'Match the hero to their weapon.',
  points: 4,
  options: ['arthur', 'captain america'],
  matchTargets: ['shield', 'excalibur'],
  answer: 'excalibur|shield',
};

/** A phone that joined, whose history holds what the view it is sent carries. */
function renderHistory(
  session: Parameters<typeof seenQuestionsOf>[0],
  hook: Record<string, unknown> = {},
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
  mockUseTeamLink.mockReturnValue(
    socketResult({
      session,
      team: TEAM,
      seenQuestions: seenQuestionsOf(session),
      ...hook,
    }),
  );
  return renderWithQuery(<PlayPage />);
}

describe('PlayPage — answered questions history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  it('lists every seen question with the team answer, and the correct answer once revealed', () => {
    renderHistory(
      {
        // The earlier block is over, so its answers live in the history alone.
        rounds: [
          { questions: [{ prompt: 'Name a fruit' }, PLANET] },
          { questions: [{ prompt: 'Name a vegetable' }] },
        ],
        progress: { status: 'round_intro', roundIndex: 1 },
      },
      { myAnswers: { 1: 'Banana' } },
    );

    expect(
      screen.getByRole('heading', { name: /answer history/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.getByText('Mars')).toBeInTheDocument();
    expect(screen.getByText('No answer submitted')).toBeInTheDocument();
  });

  it('shows the final block’s correct answers and points once the quiz has ended', () => {
    renderHistory(
      {
        rounds: [
          {
            questions: [
              {
                id: 9,
                prompt: 'Name the last planet',
                points: 3,
                answer: 'Neptune',
              },
            ],
          },
        ],
        progress: {
          status: 'ended',
          previousStatus: 'reveal',
          revealIndex: 0,
        },
      },
      {
        myAnswers: { 9: 'Neptune' },
        myAnswerGrades: { 9: { pointsAwarded: 3, verdict: 'correct' } },
      },
    );

    expect(screen.getByText('Name the last planet')).toBeInTheDocument();
    expect(screen.getAllByText('Neptune').length).toBeGreaterThan(0);
    expect(screen.getByText(/3\s*\/\s*3|3 pts|\+3/)).toBeInTheDocument();
  });

  it('shows points awarded for a graded question in the history panel once it is revealed', () => {
    renderHistory(
      {
        rounds: [{ questions: [FRUIT] }],
        progress: { status: 'reveal', revealIndex: 0 },
      },
      {
        myAnswers: { 1: 'Banana' },
        myAnswerGrades: {
          1: { pointsAwarded: 3, gradedAt: GRADED_AT, verdict: 'partial' },
        },
      },
    );

    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('labels each graded answer with the verdict the quiz master sees, and a partial match as partial', () => {
    renderHistory(
      {
        rounds: [{ questions: [FRUIT, HEROES, PLANET] }],
        progress: { status: 'reveal', revealIndex: 2, questionIndex: 2 },
      },
      {
        myAnswers: { 1: 'Banana', 2: 'excalibur|excalibur', 3: 'Venus' },
        myAnswerGrades: {
          1: { pointsAwarded: 5, gradedAt: GRADED_AT, verdict: 'correct' },
          2: { pointsAwarded: 2, gradedAt: GRADED_AT, verdict: 'partial' },
          3: { pointsAwarded: 0, gradedAt: GRADED_AT, verdict: 'incorrect' },
        },
      },
    );

    const pointsLine = (text: string) =>
      screen.getByText(text).closest('p') as HTMLElement;
    expect(
      within(pointsLine('5 / 5')).getByText('Correct'),
    ).toBeInTheDocument();
    expect(
      within(pointsLine('2 / 4')).getByText('Partial'),
    ).toBeInTheDocument();
    expect(
      within(pointsLine('0 / 5')).getByText('Incorrect'),
    ).toBeInTheDocument();
  });

  describe('across the reveal walk', () => {
    const grades = {
      1: { pointsAwarded: 3, gradedAt: GRADED_AT, verdict: 'partial' },
      2: { pointsAwarded: 5, gradedAt: GRADED_AT, verdict: 'correct' },
    };

    // The phone is sent only the walk so far: the first `shownCount` reveal
    // questions, the rest of the block arriving without answers.
    function walkResult(shownCount: number) {
      const session = {
        rounds: [{ questions: [FRUIT, PLANET] }],
        progress: {
          status: 'reveal' as const,
          revealIndex: shownCount - 1,
          questionIndex: 1,
        },
      };
      return socketResult({
        session,
        team: TEAM,
        myAnswers: { 1: 'Banana', 2: 'Mars' },
        myAnswerGrades: grades,
        seenQuestions: seenQuestionsOf(session),
      });
    }

    beforeEach(() => {
      window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    });

    it('shows the correct answer and points only for the questions the walk has reached', () => {
      mockUseTeamLink.mockReturnValue(walkResult(1));
      const { rerender } = renderWithQuery(<PlayPage />);

      expect(screen.getAllByText(/^Correct:/)).toHaveLength(1);
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      expect(screen.queryByText('5 / 5')).not.toBeInTheDocument();

      mockUseTeamLink.mockReturnValue(walkResult(2));
      rerender(<PlayPage />);

      expect(screen.getAllByText(/^Correct:/)).toHaveLength(2);
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    it('stops showing a question’s correct answer once the walk steps back past it', () => {
      mockUseTeamLink.mockReturnValue(walkResult(2));
      const { rerender } = renderWithQuery(<PlayPage />);
      expect(screen.getByText('5 / 5')).toBeInTheDocument();

      mockUseTeamLink.mockReturnValue(walkResult(1));
      rerender(<PlayPage />);

      expect(screen.getAllByText(/^Correct:/)).toHaveLength(1);
      expect(screen.queryByText('5 / 5')).not.toBeInTheDocument();
    });
  });

  it('does not show points in the history panel before the question is revealed, even if already graded', () => {
    renderHistory(
      {
        rounds: [{ questions: [FRUIT] }],
        progress: { status: 'break' },
      },
      {
        myAnswers: { 1: 'Banana' },
        myAnswerGrades: {
          1: { pointsAwarded: 3, gradedAt: GRADED_AT, verdict: 'partial' },
        },
      },
    );

    expect(screen.queryByText('3 / 5')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Points:/i)).not.toBeInTheDocument();
  });

  it('pairs left items with right-hand values for a revealed match question', () => {
    renderHistory(
      {
        // The earlier block is over, so its answers live in the history alone.
        rounds: [
          { title: 'Heroes', questions: [HEROES] },
          { questions: [{ prompt: 'Name a vegetable' }] },
        ],
        progress: { status: 'question_open', roundIndex: 1 },
      },
      { myAnswers: { 1: 'shield|excalibur' } },
    );

    expect(
      screen.getByText('arthur → shield, captain america → excalibur'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('arthur → excalibur, captain america → shield'),
    ).toBeInTheDocument();
  });

  it('opens the mobile drawer with the same history when its trigger is clicked', async () => {
    renderHistory(
      {
        rounds: [{ questions: [{ prompt: 'Name a fruit' }] }],
        progress: { status: 'break' },
      },
      { myAnswers: { 1: 'Banana' } },
    );

    await userEvent.click(
      screen.getByRole('button', { name: /answer history \(1\)/i }),
    );

    const drawer = screen.getByRole('dialog', { name: /answer history/i });
    expect(within(drawer).getByText('Name a fruit')).toBeInTheDocument();
    expect(within(drawer).getByText('Banana')).toBeInTheDocument();
  });

  it('jumps the browser to a question when its history row is clicked', async () => {
    renderHistory(
      {
        rounds: [
          {
            questions: [
              { prompt: 'Name a fruit' },
              { prompt: 'Name a planet' },
            ],
          },
        ],
        progress: { status: 'question_open', questionIndex: 1 },
      },
      { myAnswers: { 1: 'Banana' } },
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Name a planet' }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /name a fruit/i }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Name a fruit' }),
    ).toBeInTheDocument();
  });

  it('does not let the team jump to a question from an already-closed block', () => {
    renderHistory(
      {
        rounds: [
          { questions: [{ prompt: 'Name a fruit' }] },
          { questions: [{ prompt: 'Name a planet' }] },
        ],
        progress: { status: 'question_open', roundIndex: 1 },
      },
      { myAnswers: { 1: 'Banana' } },
    );

    expect(
      screen.queryByRole('button', { name: /name a fruit/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('does not render the history panel when no questions have been opened yet', () => {
    renderHistory({ progress: { status: 'lobby' } });

    expect(
      screen.queryByRole('heading', { name: /answer history/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /answer history/i }),
    ).not.toBeInTheDocument();
  });

  describe('mid closest-guess reveal', () => {
    const stats = {
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '90',
      closestGuesses: [],
    };

    function renderRevealAt(step: number): void {
      renderHistory(
        {
          rounds: [
            {
              questions: [
                {
                  id: 7,
                  type: 'closest_guess',
                  prompt: 'How tall is the tower?',
                  points: 5,
                  answer: '55',
                  closestGuess: stats,
                },
              ],
            },
          ],
          progress: { status: 'reveal', revealIndex: 0 },
          closestGuessRevealStep: step,
        },
        {
          myAnswers: { 7: '40' },
          myAnswerGrades: { 7: { pointsAwarded: 0, verdict: 'wrong' } },
        },
      );
    }

    it('shows no correct answer or points in the history before the answer step, while the reveal shows the stats so far', () => {
      renderRevealAt(2);

      expect(screen.queryByText(/Correct:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ANSWER/)).not.toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('shows the correct answer in the history and the reveal from the answer step', () => {
      renderRevealAt(3);

      expect(screen.getByText(/Correct:/)).toBeInTheDocument();
      expect(screen.getByText(/ANSWER/)).toBeInTheDocument();
    });
  });
});
