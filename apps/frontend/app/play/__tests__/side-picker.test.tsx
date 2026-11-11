import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { teamLinkResult } from './test-utils';

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

const SIDES = [
  { id: 'eng', name: 'Engineering' },
  { id: 'law', name: 'Law' },
];

function renderPhone({
  status = 'lobby',
  versusEnabled = true,
  mySideId = null,
  pickSide = vi.fn().mockResolvedValue({ success: true }),
}: {
  status?: 'lobby' | 'rules';
  versusEnabled?: boolean;
  mySideId?: string | null;
  pickSide?: ReturnType<typeof vi.fn>;
} = {}) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session: {
        rounds: [{ title: 'Round', questions: [{}] }],
        progress: { status },
        settings: { versusEnabled, versusSides: SIDES },
      },
      join: {
        team: {
          teamId: 1,
          teamName: 'The Quizzards',
          teamToken: 'token-1',
          teamCode: 'CODE',
        },
      },
      game: { mySideId, pickSide },
    }),
  );
  renderWithQuery(<PlayPage />);
  return { pickSide };
}

describe('PlayPage — the side picker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseTeamLink.mockReset();
  });

  it('asks a side-less team to pick before anything else, and sends the pick', async () => {
    const { pickSide } = renderPhone();

    await userEvent.click(
      await screen.findByRole('button', { name: /Engineering/ }),
    );

    expect(pickSide).toHaveBeenCalledWith('eng');
    expect(screen.queryByText(/Playing as/)).not.toBeInTheDocument();
  });

  it('shows the refusal when the pick is refused', async () => {
    renderPhone({
      pickSide: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Sides are locked' }),
    });

    await userEvent.click(await screen.findByRole('button', { name: /Law/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sides are locked',
    );
  });

  it('shows no picker without Versus', async () => {
    renderPhone({ versusEnabled: false });

    expect(await screen.findByText(/Playing as/)).toBeInTheDocument();
    expect(screen.queryByText('Pick your side')).not.toBeInTheDocument();
  });

  it('shows the side badge next to the team name, and lets the lobby switch', async () => {
    const { pickSide } = renderPhone({ mySideId: 'eng' });

    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Switch side' }));
    await userEvent.click(await screen.findByRole('button', { name: /Law/ }));

    await waitFor(() => expect(pickSide).toHaveBeenCalledWith('law'));
    expect(await screen.findByText(/Playing as/)).toBeInTheDocument();
  });

  it('keeps the badge but no switch once the quiz has started', async () => {
    renderPhone({ mySideId: 'law', status: 'rules' });

    expect(await screen.findByText('Law')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch side' }),
    ).not.toBeInTheDocument();
  });
});
