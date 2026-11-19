import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoubledRoundView } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import type { SessionDescription } from '@/test-utils/room-view';
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

const JOINED_TEAM = {
  teamId: 1,
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'CODE',
};

function jokerNight(
  overrides: Partial<SessionDescription> = {},
): SessionDescription {
  return {
    rounds: [
      { title: 'Pop Music', questions: [{}] },
      { title: 'World Capitals', questions: [{}] },
    ],
    settings: { showRoundOverview: true, jokersEnabled: true },
    progress: { status: 'question_open', roundIndex: 0 },
    ...overrides,
  };
}

function renderPlay(
  myDoubledRounds: DoubledRoundView[],
  session: SessionDescription = jokerNight(),
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session,
      join: { team: JOINED_TEAM },
      game: { myDoubledRounds },
    }),
  );
  renderWithQuery(<PlayPage />);
}

describe('PlayPage — the joker line', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('names the team’s joker round in full beside the team name', () => {
    renderPlay([{ roundId: 2, roundNumber: 2, title: 'World Capitals' }]);

    expect(
      screen.getByText('Round 2 — World Capitals scores double'),
    ).toBeInTheDocument();
  });

  it('carries the line for a joker the quiz master set or the server drew', () => {
    renderPlay([{ roundId: 1, roundNumber: 1, title: 'Pop Music' }]);

    expect(
      screen.getByText(/^Round 1 — .* scores double$/),
    ).toBeInTheDocument();
  });

  it('has no line while the team has no joker', () => {
    renderPlay([]);

    expect(screen.queryByText(/scores double$/)).not.toBeInTheDocument();
  });

  it('has no line when the session plays without jokers', () => {
    renderPlay([], jokerNight({ settings: { jokersEnabled: false } }));

    expect(screen.queryByText(/scores double$/)).not.toBeInTheDocument();
  });
});

describe('PlayPage — the actions bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('offers the answer history from the start, with an empty drawer', async () => {
    renderPlay([], jokerNight({ progress: { status: 'lobby' } }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Answer history (0)' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'No questions opened yet.',
    );
  });
});
