import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  TeamMergeCandidatesPayload,
  TeamMergePairPreview,
} from '@campus-pubquiz/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsApiError } from '@/app/lib/teams-api';
import { TeamMergePanel } from '@/app/teams/[id]/team-merge-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockCandidates, mockPair, mockMerge, mockPush } = vi.hoisted(() => ({
  mockCandidates: vi.fn(),
  mockPair: vi.fn(),
  mockMerge: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/app/lib/teams-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/teams-api')>();
  return {
    ...actual,
    fetchMergeCandidates: mockCandidates,
    fetchMergePair: mockPair,
    mergeTeams: mockMerge,
  };
});

const CANDIDATES: TeamMergeCandidatesPayload = {
  candidates: [
    { id: 8, name: 'Quizzly Bearz', sessionsPlayed: 1, refusal: null },
    {
      id: 9,
      name: 'Rival',
      sessionsPlayed: 2,
      refusal: { kind: 'shared_session', sessionNames: ['Night 1'] },
    },
    {
      id: 10,
      name: 'Lobby Lads',
      sessionsPlayed: 0,
      refusal: { kind: 'unended_session', teamId: 10, teamName: 'Lobby Lads' },
    },
  ],
};

const PAIR: TeamMergePairPreview = {
  teams: [
    { id: 7, name: 'Quizzly Bears', sessionsPlayed: 3 },
    { id: 8, name: 'Quizzly Bearz', sessionsPlayed: 1 },
  ],
  combinedSessionsPlayed: 4,
  newerTeamId: 8,
  newerTeamName: 'Quizzly Bearz',
  keptCode: 'ABC123',
};

/** Matches an element by its full rendered text, which JSX splits across text nodes and spans. */
function textOf(tag: string, text: string, prefix = false) {
  return (_content: string, element: Element | null): boolean => {
    const actual = element?.textContent ?? '';
    return (
      element?.tagName === tag &&
      (prefix ? actual.startsWith(text) : actual === text)
    );
  };
}

async function openPicker() {
  const user = userEvent.setup();
  renderWithQuery(<TeamMergePanel teamId={7} />);
  await user.click(screen.getByRole('button', { name: 'Merge with…' }));
  await waitFor(() => screen.getByText('Quizzly Bearz'));
  return user;
}

describe('TeamMergePanel', () => {
  beforeEach(() => {
    mockCandidates.mockReset().mockResolvedValue(CANDIDATES);
    mockPair.mockReset().mockResolvedValue(PAIR);
    mockMerge.mockReset().mockResolvedValue({ keptTeamId: 8 });
    mockPush.mockReset();
  });

  it('searches the other teams by name', async () => {
    const user = await openPicker();

    await user.type(screen.getByLabelText('Search teams'), 'riv');

    expect(screen.getByText('Rival')).toBeInTheDocument();
    expect(screen.queryByText('Quizzly Bearz')).not.toBeInTheDocument();
  });

  it('greys out teams that can’t be merged and says why', async () => {
    await openPicker();

    expect(screen.getByRole('button', { name: /Rival/ })).toBeDisabled();
    expect(screen.getByText(/both took part in Night 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lobby Lads/ })).toBeDisabled();
    expect(
      screen.getByText(/Lobby Lads is in a session that hasn't ended/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quizzly Bearz/ })).toBeEnabled();
  });

  it('lists the sessions played per team and offers only mergeable teams for the next step', async () => {
    const user = await openPicker();

    expect(screen.getByText(/2 sessions played/)).toBeInTheDocument();
    expect(screen.getByText(/0 sessions played/)).toBeInTheDocument();
    expect(
      screen.getByText(textOf('SPAN', '1 session played')),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Rival/ }));
    await user.click(screen.getByRole('button', { name: /Lobby Lads/ }));

    expect(mockPair).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Search teams')).toBeInTheDocument();
  });

  it('shows the confirm step with the code and the can’t-be-undone warning', async () => {
    const user = await openPicker();

    await user.click(screen.getByRole('button', { name: /Quizzly Bearz/ }));

    await waitFor(() => screen.getByText(/can.t be undone/i));
    expect(mockPair).toHaveBeenCalledWith(7, 8, expect.anything());
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(
      screen.getByText(/Code and phones carry over from/),
    ).toBeInTheDocument();
    expect(screen.getByText(/4 sessions played/)).toBeInTheDocument();
    expect(
      screen.getByText(textOf('LI', 'Quizzly Bears: 3 sessions played')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(textOf('LI', 'Quizzly Bearz: 1 session played')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textOf('P', 'Code and phones carry over from Quizzly Bearz.', true),
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Quizzly Bears')).toBeChecked();
  });

  it('merges under the chosen name and goes to the kept team', async () => {
    const user = await openPicker();
    await user.click(screen.getByRole('button', { name: /Quizzly Bearz/ }));
    await waitFor(() => screen.getByLabelText('Quizzly Bearz'));

    await user.click(screen.getByLabelText('Quizzly Bearz'));
    await user.click(screen.getByRole('button', { name: 'Merge teams' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/teams/8'));
    expect(mockMerge).toHaveBeenCalledWith(7, {
      otherTeamId: 8,
      name: 'Quizzly Bearz',
    });
  });

  it('shows a refusal from the server inline and stays put', async () => {
    mockMerge.mockRejectedValue(
      new TeamsApiError('Quizzly Bears is in a session that hasn’t ended', 409),
    );
    const user = await openPicker();
    await user.click(screen.getByRole('button', { name: /Quizzly Bearz/ }));
    await waitFor(() => screen.getByRole('button', { name: 'Merge teams' }));

    await user.click(screen.getByRole('button', { name: 'Merge teams' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'is in a session that hasn’t ended',
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});
