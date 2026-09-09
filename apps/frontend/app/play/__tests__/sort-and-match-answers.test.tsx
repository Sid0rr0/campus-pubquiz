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

describe('PlayPage — sort and match answers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('reorders on move without submitting, then submits the reordered list on Submit click', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'sort',
            prompt: 'Order these planets from the sun outward.',
            options: ['Venus', 'Mercury', 'Earth'],
            points: 3,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        submitAnswer,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Venus')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Drag to reorder Venus' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Move Venus down' }),
    );

    expect(submitAnswer).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(submitAnswer).toHaveBeenCalledWith(
      'r1q1',
      'team-1',
      'Mercury|Venus|Earth',
    );
  });

  it('shows a fixed left column beside a reorderable right column and submits on Submit click', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'match',
            prompt: 'Match the hero to their weapon.',
            options: ['arthur', 'captain america'],
            matchTargets: ['shield', 'excalibur'],
            points: 4,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        submitAnswer,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('arthur')).toBeInTheDocument();
    expect(screen.getByText('captain america')).toBeInTheDocument();
    expect(screen.getByText('shield')).toBeInTheDocument();
    expect(screen.getByText('excalibur')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Drag to reorder shield' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Drag to reorder excalibur' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(submitAnswer).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(submitAnswer).toHaveBeenCalledWith(
      'r1q1',
      'team-1',
      'shield|excalibur',
    );
  });

  it('shows the sort Submit button as green "Submitted" when the order matches the recorded answer, and reverts to magenta "Submit" once reordered', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'sort',
            prompt: 'Order these planets from the sun outward.',
            options: ['Venus', 'Mercury', 'Earth'],
            points: 3,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { r1q1: 'Venus|Mercury|Earth' },
        submitAnswer,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByRole('button', { name: 'Submitted' })).toHaveClass(
      'bg-green',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Move Venus down' }),
    );

    expect(screen.getByRole('button', { name: 'Submit' })).toHaveClass(
      'bg-magenta',
    );
  });

  it('submits the IDK sentinel from the sort question\'s "I don\'t know" button', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'sort',
            prompt: 'Order these planets from the sun outward.',
            options: ['Venus', 'Mercury', 'Earth'],
            points: 3,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        submitAnswer,
      }),
    );
    renderWithQuery(<PlayPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /i don't know/i }),
    );

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', '__idk__');
  });

  it('submits the IDK sentinel from the match question\'s "I don\'t know" button', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'match',
            prompt: 'Match the hero to their weapon.',
            options: ['arthur', 'captain america'],
            matchTargets: ['shield', 'excalibur'],
            points: 4,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        submitAnswer,
      }),
    );
    renderWithQuery(<PlayPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /i don't know/i }),
    );

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', '__idk__');
  });
});
