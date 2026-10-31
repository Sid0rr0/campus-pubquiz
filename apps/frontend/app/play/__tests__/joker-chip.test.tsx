import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamJoker } from '@campus-pubquiz/types';
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
  myJoker: TeamJoker | null,
  session: SessionDescription = jokerNight(),
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session,
      join: { team: JOINED_TEAM },
      game: { myJoker },
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
    renderPlay({ roundId: 2, source: 'chosen' });

    expect(
      screen.getByText('Round 2 — World Capitals scores double'),
    ).toBeInTheDocument();
  });

  it('carries the line for a joker the quiz master set or the server drew', () => {
    renderPlay({ roundId: 1, source: 'set_by_quiz_master' });

    expect(
      screen.getByText(/^Round 1 — .* scores double$/),
    ).toBeInTheDocument();
  });

  it('has no line while the team has no joker', () => {
    renderPlay(null);

    expect(screen.queryByText(/scores double$/)).not.toBeInTheDocument();
  });

  it('has no line when the session plays without jokers', () => {
    renderPlay(null, jokerNight({ settings: { jokersEnabled: false } }));

    expect(screen.queryByText(/scores double$/)).not.toBeInTheDocument();
  });
});

describe('PlayPage — the actions bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('offers the answer history from the start, with an empty drawer', async () => {
    renderPlay(null, jokerNight({ progress: { status: 'lobby' } }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Answer history (0)' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'No questions opened yet.',
    );
  });
});
