import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('PlayPage — break and reveal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('tells the team answering is locked during the grading break', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [
            {
              id: 'r1q1',
              type: 'free_text',
              prompt: 'Name a fruit',
              points: 1,
              roundNumber: 1,
              questionNumberInRound: 1,
            },
          ],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.queryByRole('textbox', { name: /your answer/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/answering is locked/i)).toBeInTheDocument();
  });

  it('still shows the block question picker during the grading break so teams can browse back', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    const q2 = {
      id: 'r1q2',
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [q1, q2],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Banana', r1q2: 'Mars' },
      }),
    );
    renderWithQuery(<PlayPage />);

    // Defaults to the block's last question, with the picker showing both.
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /question 1 \(answered\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /question 2 \(answered\)/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /question 1 \(answered\)/i }),
    );

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /your answer/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/answering is locked/i)).toBeInTheDocument();
  });

  it('shows a "look at the screen" title card for the round reveal is crossing into, not the stale top-level round title', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const r1q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'General Knowledge',
    };
    const r2q1 = {
      id: 'r2q1',
      type: 'free_text' as const,
      prompt: 'Tallest mountain?',
      points: 1,
      roundNumber: 2,
      questionNumberInRound: 1,
      roundTitle: 'Geography',
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          // progress.roundIndex stays pinned to the block's last round
          // (the breakAfter round) throughout reveal — roundTitle here
          // deliberately mismatches revealQuestions[revealIndex] so the
          // test fails if the screen ever falls back to that stale prop.
          progress: progress({ status: 'reveal_intro', revealIndex: 1 }),
          currentQuestion: null,
          roundTitle: 'Geography',
          blockQuestions: [r1q1, r2q1],
          revealQuestions: [r1q1, r2q1],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Geography' }),
    ).toBeInTheDocument();
  });

  it('shows a "look at the screen" title card for a round\'s own title while stepping back through break review', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const r1q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'General Knowledge',
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break_round_intro', revealIndex: 0 }),
          currentQuestion: null,
          roundTitle: 'Geography',
          blockQuestions: [r1q1],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'General Knowledge' }),
    ).toBeInTheDocument();
  });

  it('still shows the block question picker during reveal', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    const q2 = {
      id: 'r1q2',
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal' }),
          currentQuestion: null,
          blockQuestions: [q1, q2],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByRole('button', { name: /^question 1$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^question 2$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/revealing answers/i)).toBeInTheDocument();
  });

  it("shows the correct answer and the team's own submitted answer during reveal", () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1],
          revealQuestions: [{ ...q1, answer: 'Banana' }],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Mango' },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText(/your answer/i)).toBeInTheDocument();
    expect(screen.getByText('Mango')).toBeInTheDocument();
  });

  it('shows points awarded next to YOUR ANSWER during reveal once graded', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1],
          revealQuestions: [{ ...q1, answer: 'Banana' }],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Mango' },
        myAnswerGrades: {
          r1q1: { pointsAwarded: 0, gradedAt: '2024-01-01T00:00:00.000Z' },
        },
        seenQuestions: { r1q1: { ...q1, answer: 'Banana' } },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('0 / 5 points')).toBeInTheDocument();
  });

  it('colors YOUR ANSWER green during reveal when it earned full points', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1],
          revealQuestions: [{ ...q1, answer: 'Banana' }],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Banana' },
        myAnswerGrades: {
          r1q1: { pointsAwarded: 5, gradedAt: '2024-01-01T00:00:00.000Z' },
        },
        seenQuestions: { r1q1: { ...q1, answer: 'Banana' } },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByText('Banana', { selector: 'p.font-display' }),
    ).toHaveClass('text-green');
  });

  it('colors YOUR ANSWER red during reveal when it earned less than full points', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 5,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1],
          revealQuestions: [{ ...q1, answer: 'Banana' }],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Mango' },
        myAnswerGrades: {
          r1q1: { pointsAwarded: 0, gradedAt: '2024-01-01T00:00:00.000Z' },
        },
        seenQuestions: { r1q1: { ...q1, answer: 'Banana' } },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByText('Mango', { selector: 'p.font-display' }),
    ).toHaveClass('text-magenta');
  });

  it('formats YOUR ANSWER for a sort/match question during reveal instead of showing the raw pipe-joined value', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'sort' as const,
      prompt: 'Order these circuits by season.',
      points: 3,
      roundNumber: 1,
      questionNumberInRound: 1,
      options: ['Imola', 'Spa', 'Silverstone'],
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1],
          revealQuestions: [{ ...q1, answer: 'Silverstone|Imola|Spa' }],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Imola|Spa|Silverstone' },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Imola → Spa → Silverstone')).toBeInTheDocument();
    expect(screen.queryByText('Imola|Spa|Silverstone')).not.toBeInTheDocument();
  });

  it('tells the team they submitted nothing when reveal shows a question they never answered', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1],
          revealQuestions: [{ ...q1, answer: 'Banana' }],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: {},
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText(/no answer submitted/i)).toBeInTheDocument();
  });

  it('follows the display through the reveal walk, even overriding a question the team had browsed to', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    const q2 = {
      id: 'r1q2',
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
    };
    const q3 = {
      id: 'r1q3',
      type: 'free_text' as const,
      prompt: 'Name a country',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 3,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1, q2, q3],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);

    // Defaults to the question at revealIndex, not the block's last question.
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();

    // The team browses ahead to question 3 on their own.
    await userEvent.click(
      screen.getByRole('button', { name: /^question 3$/i }),
    );
    expect(screen.getByText('Name a country')).toBeInTheDocument();

    // The admin advances the reveal on /display to question 2 — /play snaps
    // back to follow it, discarding the team's manual browse to question 3.
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 1 }),
          currentQuestion: null,
          blockQuestions: [q1, q2, q3],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.queryByText('Name a country')).not.toBeInTheDocument();
  });
});
