import { screen, waitFor } from '@testing-library/react';
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

const ROUNDS = [
  { title: 'Pop Music', category: 'Music', questions: [{}] },
  { title: 'World Capitals', category: 'Geography', questions: [{}] },
  { title: 'Film Quotes', questions: [{}] },
];

const JOINED_TEAM = {
  teamId: 1,
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'CODE',
};

function pickSession(
  overrides: Partial<SessionDescription> = {},
): SessionDescription {
  return {
    rounds: ROUNDS,
    progress: { status: 'joker_pick' },
    ...overrides,
  };
}

function renderPick({
  session = pickSession(),
  myJoker = null,
  pickJoker = vi.fn().mockResolvedValue({ success: true }),
}: {
  session?: SessionDescription;
  myJoker?: TeamJoker | null;
  pickJoker?: ReturnType<typeof vi.fn>;
} = {}) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session,
      join: { team: JOINED_TEAM },
      game: { myJoker, pickJoker },
    }),
  );
  renderWithQuery(<PlayPage />);
  return { pickJoker };
}

describe('PlayPage — the joker pick', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('offers a card per round with its number, title and category', () => {
    renderPick();

    const cards = screen.getAllByRole('button', { name: /round \d/i });
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('ROUND 1');
    expect(cards[0]).toHaveTextContent('Pop Music');
    expect(cards[0]).toHaveTextContent('Music');
    expect(cards[1]).toHaveTextContent('World Capitals');
    expect(cards[2]).toHaveTextContent('Film Quotes');
  });

  it('counts down to the deadline the server sent', () => {
    renderPick({
      session: pickSession({
        timers: { jokerPickEndsAt: Date.now() + 42_000 },
      }),
    });

    expect(
      screen.getByRole('timer', { name: /time left to pick a joker/i }),
    ).toHaveTextContent('0:42');
  });

  it('sends the tapped round and confirms with "Saved ✓"', async () => {
    const { pickJoker } = renderPick();

    await userEvent.click(
      screen.getByRole('button', { name: /world capitals/i }),
    );

    expect(pickJoker).toHaveBeenCalledWith(2);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('lets the team tap another round and sends each tap', async () => {
    const { pickJoker } = renderPick();

    await userEvent.click(screen.getByRole('button', { name: /pop music/i }));
    await userEvent.click(screen.getByRole('button', { name: /film quotes/i }));

    expect(pickJoker.mock.calls.map(([roundId]) => roundId)).toEqual([1, 3]);
  });

  it('shows the refusal instead of "Saved ✓" when the server refuses the pick', async () => {
    renderPick({
      pickJoker: vi.fn().mockResolvedValue({
        success: false,
        error: 'The joker pick is not open',
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: /pop music/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The joker pick is not open',
    );
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
  });

  it('highlights the team’s pick, also when the page loads on a reconnect', () => {
    renderPick({ myJoker: { roundId: 2, source: 'chosen' } });

    expect(
      screen.getByRole('button', { name: /world capitals/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /pop music/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
  });

  it('shows the joker once the pick has closed, and sends the team to the screen', () => {
    renderPick({
      session: pickSession({ timers: { jokerPickEndsAt: null } }),
      myJoker: { roundId: 2, source: 'chosen' },
    });

    expect(
      screen.getByText('Your joker: Round 2 — World Capitals'),
    ).toBeInTheDocument();
    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
    expect(screen.queryByText(/drawn for you/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /world capitals/i }),
    ).not.toBeInTheDocument();
  });

  it('says so when the joker was drawn for the team', () => {
    renderPick({
      session: pickSession({ timers: { jokerPickEndsAt: null } }),
      myJoker: { roundId: 3, source: 'drawn' },
    });

    expect(
      screen.getByText('Your joker: Round 3 — Film Quotes'),
    ).toBeInTheDocument();
    expect(screen.getByText(/drawn for you/i)).toBeInTheDocument();
  });

  it('is not shown outside the joker pick', async () => {
    renderPick({
      session: pickSession({ progress: { status: 'round_overview' } }),
    });

    await waitFor(() =>
      expect(screen.queryByText('Pick your joker')).not.toBeInTheDocument(),
    );
  });
});
