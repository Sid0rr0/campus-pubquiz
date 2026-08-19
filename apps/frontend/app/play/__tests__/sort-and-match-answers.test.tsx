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

describe('PlayPage — sort and match answers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('shows sort items in display order and submits the reordered list on move', async () => {
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
    render(<PlayPage />);

    expect(screen.getByText('Venus')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Move Venus down' }),
    );

    expect(submitAnswer).toHaveBeenCalledWith(
      'r1q1',
      'team-1',
      'Mercury|Venus|Earth',
    );
  });

  it('shows match left/right lists and submits once every row has a choice', async () => {
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
    render(<PlayPage />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const [arthurSelect, captainSelect] = screen.getAllByRole('combobox');
    expect(
      within(arthurSelect).getByRole('option', { name: 'a. shield' }),
    ).toBeInTheDocument();
    expect(
      within(arthurSelect).getByRole('option', { name: 'b. excalibur' }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(arthurSelect, 'excalibur');
    expect(submitAnswer).not.toHaveBeenCalled();
    await userEvent.selectOptions(captainSelect, 'shield');

    expect(submitAnswer).toHaveBeenCalledWith(
      'r1q1',
      'team-1',
      'excalibur|shield',
    );
  });
});
