import { render, screen, within } from '@testing-library/react';
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
    render(<PlayPage />);

    expect(
      screen.getByRole('heading', { name: /answer history/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.getByText('Mars')).toBeInTheDocument();
    expect(screen.getByText('No answer submitted')).toBeInTheDocument();
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
    render(<PlayPage />);

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
    render(<PlayPage />);

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
    render(<PlayPage />);

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
    render(<PlayPage />);

    expect(
      screen.queryByRole('heading', { name: /answer history/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /answer history/i }),
    ).not.toBeInTheDocument();
  });
});
