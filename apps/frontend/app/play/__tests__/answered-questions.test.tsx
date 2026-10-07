import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

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

describe('PlayPage — answered questions history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  it('lists every seen question with the team answer, and the correct answer once revealed', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    const revealedQ2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
      answer: 'Mars',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
        seenQuestions: { 1: q1, 2: revealedQ2 },
      }),
    );
    renderWithQuery(<PlayPage />);

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
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const finalQuestion = {
      id: 9,
      type: 'free_text' as const,
      prompt: 'Name the last planet',
      points: 3,
      roundNumber: 2,
      questionNumberInRound: 4,
      roundTitle: 'Round 2',
      answer: 'Neptune',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'ended' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 9: 'Neptune' },
        myAnswerGrades: { 9: { pointsAwarded: 3, verdict: 'correct' } },
        seenQuestions: { 9: finalQuestion },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name the last planet')).toBeInTheDocument();
    expect(screen.getAllByText('Neptune').length).toBeGreaterThan(0);
    expect(screen.getByText(/3\s*\/\s*3|3 pts|\+3/)).toBeInTheDocument();
  });

  it('shows points awarded for a graded question in the history panel once it is revealed', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
        myAnswerGrades: {
          1: {
            pointsAwarded: 3,
            gradedAt: '2024-01-01T00:00:00.000Z',
            verdict: 'partial',
          },
        },
        seenQuestions: { 1: q1 },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('labels each graded answer with the verdict the quiz master sees, and a partial match as partial', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const fruit = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };
    const heroes = {
      id: 2,
      type: 'match' as const,
      prompt: 'Match the hero to their weapon.',
      points: 4,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
      options: ['arthur', 'captain america'],
      matchTargets: ['shield', 'excalibur'],
      answer: 'excalibur|shield',
    };
    const planet = {
      id: 3,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 3,
      roundTitle: 'Round 1',
      answer: 'Mars',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana', 2: 'excalibur|excalibur', 3: 'Venus' },
        myAnswerGrades: {
          1: {
            pointsAwarded: 5,
            gradedAt: '2024-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          2: {
            pointsAwarded: 2,
            gradedAt: '2024-01-01T00:00:00.000Z',
            verdict: 'partial',
          },
          3: {
            pointsAwarded: 0,
            gradedAt: '2024-01-01T00:00:00.000Z',
            verdict: 'incorrect',
          },
        },
        seenQuestions: { 1: fruit, 2: heroes, 3: planet },
      }),
    );
    renderWithQuery(<PlayPage />);

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
    function omitAnswer<T extends { answer: string }>(question: T) {
      return Object.fromEntries(
        Object.entries(question).filter(([key]) => key !== 'answer'),
      ) as Omit<T, 'answer'>;
    }
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
      answer: 'Banana',
    };
    const q2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
      answer: 'Mars',
    };
    const q1Hidden = omitAnswer(q1);
    const q2Hidden = omitAnswer(q2);
    const myAnswerGrades = {
      1: {
        pointsAwarded: 3,
        gradedAt: '2024-01-01T00:00:00.000Z',
        verdict: 'partial',
      },
      2: {
        pointsAwarded: 5,
        gradedAt: '2024-01-01T00:00:00.000Z',
        verdict: 'correct',
      },
    };

    // The phone is sent only the walk so far: `shown` are the reveal
    // questions the server has trimmed to, the rest of the block arrives
    // without answers.
    function walkResult(shown: (typeof q1)[]) {
      const shownIds = new Set(shown.map((question) => question.id));
      const blockQuestions = [q1Hidden, q2Hidden];
      return socketResult({
        snapshot: {
          progress: progress({
            status: 'reveal',
            revealIndex: shown.length - 1,
          }),
          currentQuestion: null,
          blockQuestions,
          revealQuestions: shown,
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana', 2: 'Mars' },
        myAnswerGrades,
        seenQuestions: Object.fromEntries(
          [q1, q2].map((question) => [
            question.id,
            shownIds.has(question.id)
              ? question
              : blockQuestions.find((hidden) => hidden.id === question.id),
          ]),
        ),
      });
    }

    beforeEach(() => {
      window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    });

    it('shows the correct answer and points only for the questions the walk has reached', () => {
      mockUseTeamLink.mockReturnValue(walkResult([q1]));
      const { rerender } = renderWithQuery(<PlayPage />);

      expect(screen.getAllByText(/^Correct:/)).toHaveLength(1);
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      expect(screen.queryByText('5 / 5')).not.toBeInTheDocument();

      mockUseTeamLink.mockReturnValue(walkResult([q1, q2]));
      rerender(<PlayPage />);

      expect(screen.getAllByText(/^Correct:/)).toHaveLength(2);
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    it('stops showing a question’s correct answer once the walk steps back past it', () => {
      mockUseTeamLink.mockReturnValue(walkResult([q1, q2]));
      const { rerender } = renderWithQuery(<PlayPage />);
      expect(screen.getByText('5 / 5')).toBeInTheDocument();

      mockUseTeamLink.mockReturnValue(walkResult([q1]));
      rerender(<PlayPage />);

      expect(screen.getAllByText(/^Correct:/)).toHaveLength(1);
      expect(screen.queryByText('5 / 5')).not.toBeInTheDocument();
    });
  });

  it('does not show points in the history panel before the question is revealed, even if already graded', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
        myAnswerGrades: {
          1: {
            pointsAwarded: 3,
            gradedAt: '2024-01-01T00:00:00.000Z',
            verdict: 'partial',
          },
        },
        seenQuestions: { 1: q1 },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText('3 / 5')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Points:/i)).not.toBeInTheDocument();
  });

  it('pairs left items with right-hand values for a revealed match question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const revealedMatch = {
      id: 1,
      type: 'match' as const,
      prompt: 'Match the hero to their weapon.',
      points: 4,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Heroes',
      options: ['arthur', 'captain america'],
      matchTargets: ['shield', 'excalibur'],
      answer: 'excalibur|shield',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'shield|excalibur' },
        seenQuestions: { 1: revealedMatch },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByText('arthur → shield, captain america → excalibur'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('arthur → excalibur, captain america → shield'),
    ).toBeInTheDocument();
  });

  it('opens the mobile drawer with the same history when its trigger is clicked', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
        seenQuestions: { 1: q1 },
      }),
    );
    renderWithQuery(<PlayPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /answer history \(1\)/i }),
    );

    const drawer = screen.getByRole('dialog', { name: /answer history/i });
    expect(within(drawer).getByText('Name a fruit')).toBeInTheDocument();
    expect(within(drawer).getByText('Banana')).toBeInTheDocument();
  });

  it('jumps the browser to a question when its history row is clicked', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    const q2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', questionIndex: 1 }),
          currentQuestion: q2,
          blockQuestions: [q1, q2],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
        seenQuestions: { 1: q1, 2: q2 },
      }),
    );
    renderWithQuery(<PlayPage />);

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
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const oldQuestion = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
        seenQuestions: { 1: oldQuestion },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.queryByRole('button', { name: /name a fruit/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('does not render the history panel when no questions have been opened yet', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          blockQuestions: [],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.queryByRole('heading', { name: /answer history/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /answer history/i }),
    ).not.toBeInTheDocument();
  });

  describe('mid closest-guess reveal', () => {
    const closestGuessQuestion = {
      id: 7,
      type: 'closest_guess' as const,
      prompt: 'How tall is the tower?',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    const stats = {
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '90',
      closestGuesses: [],
    };

    function renderRevealAt(
      step: number,
      revealed: Record<string, unknown>,
    ): void {
      window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
      const revealQuestion = { ...closestGuessQuestion, ...revealed };
      mockUseTeamLink.mockReturnValue(
        socketResult({
          snapshot: {
            progress: progress({ status: 'reveal', revealIndex: 0 }),
            currentQuestion: null,
            blockQuestions: [closestGuessQuestion],
            revealQuestions: [revealQuestion],
            closestGuessRevealStep: step,
          },
          team: {
            teamId: 1,
            teamName: 'Returning Team',
            teamToken: 'team-token-1',
          },
          myAnswers: { 7: '40' },
          myAnswerGrades: { 7: { pointsAwarded: 0, verdict: 'wrong' } },
          seenQuestions: { 7: revealQuestion },
        }),
      );
      renderWithQuery(<PlayPage />);
    }

    it('shows no correct answer or points in the history before the answer step, while the reveal shows the stats so far', () => {
      renderRevealAt(2, { closestGuess: stats });

      expect(screen.queryByText(/Correct:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ANSWER/)).not.toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('shows the correct answer in the history and the reveal from the answer step', () => {
      renderRevealAt(3, { closestGuess: stats, answer: '55' });

      expect(screen.getByText(/Correct:/)).toBeInTheDocument();
      expect(screen.getByText(/ANSWER/)).toBeInTheDocument();
    });
  });
});
