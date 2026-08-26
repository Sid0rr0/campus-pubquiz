import { screen, within } from '@testing-library/react';
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

describe('PlayPage — answered questions history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
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
    mockUseGameSocket.mockReturnValue(
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
    mockUseGameSocket.mockReturnValue(
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
          1: { pointsAwarded: 3, gradedAt: '2024-01-01T00:00:00.000Z' },
        },
        seenQuestions: { 1: q1 },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('reveals points in the history panel one question at a time as the display steps through the reveal walk', () => {
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
    const myAnswerGrades = {
      1: { pointsAwarded: 3, gradedAt: '2024-01-01T00:00:00.000Z' },
      2: { pointsAwarded: 5, gradedAt: '2024-01-01T00:00:00.000Z' },
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 0 }),
          currentQuestion: null,
          blockQuestions: [q1, q2],
          revealQuestions: [q1, q2],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana', 2: 'Mars' },
        myAnswerGrades,
        seenQuestions: { 1: q1, 2: q2 },
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);

    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(screen.queryByText('5 / 5')).not.toBeInTheDocument();

    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal', revealIndex: 1 }),
          currentQuestion: null,
          blockQuestions: [q1, q2],
          revealQuestions: [q1, q2],
        },
        team: {
          teamId: 1,
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana', 2: 'Mars' },
        myAnswerGrades,
        seenQuestions: { 1: q1, 2: q2 },
      }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
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
    mockUseGameSocket.mockReturnValue(
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
          1: { pointsAwarded: 3, gradedAt: '2024-01-01T00:00:00.000Z' },
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
    mockUseGameSocket.mockReturnValue(
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
    mockUseGameSocket.mockReturnValue(
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
    mockUseGameSocket.mockReturnValue(
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
    mockUseGameSocket.mockReturnValue(
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
    mockUseGameSocket.mockReturnValue(
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
});
