import { screen } from '@testing-library/react';
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

describe('PlayPage — pre-game screens', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(teamLinkResult());
  });

  it('shows the rules screen after the lobby, before the first question opens', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          // Six topics of four questions, a break after every third.
          rounds: Array.from({ length: 6 }, (_, index) => ({
            breakAfter: index % 3 === 2,
            questions: [{}, {}, {}, {}],
          })),
          progress: { status: 'rules' },
        },
        join: {
          team: {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            teamToken: 'token-1',
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByText(
        /6 topics, 4 questions each, with a break after every 3 rounds/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('shows the session-specific rules instead of the hardcoded defaults', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          progress: { status: 'rules' },
          settings: {
            rules: ['Custom team-phone rule.'],
            enabledBonusCategories: [],
          },
        },
        join: {
          team: {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            teamToken: 'token-1',
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Custom team-phone rule.')).toBeInTheDocument();
    expect(screen.queryByText(/no cheating/i)).not.toBeInTheDocument();
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    'with Jokers %s the rules screen shows the joker line: %s',
    (jokersEnabled, isShown) => {
      window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
      mockUseTeamLink.mockReturnValue(
        teamLinkResult({
          session: {
            progress: { status: 'rules' },
            settings: { jokersEnabled, showRoundOverview: true },
          },
          join: {
            team: {
              teamId: 'team-1',
              teamName: 'The Quizzards',
              teamToken: 'token-1',
            },
          },
        }),
      );
      renderWithQuery(<PlayPage />);

      const line = screen.queryByText(
        "Joker: pick one round to score double. You'll choose after the round overview.",
      );
      expect(line !== null).toBe(isShown);
    },
  );

  it('shows the round name and a "look at the screen" hint on a fresh round intro card', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [{ title: 'Picture Round', questions: [{}, {}] }],
          progress: { status: 'round_intro' },
        },
        join: {
          team: {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            teamToken: 'token-1',
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Picture Round')).toBeInTheDocument();
    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('stays on the block browser, not the round intro card, when Previous re-enters an already-open round', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              title: 'Picture Round',
              questions: [{ prompt: 'Name a fruit' }],
            },
          ],
          progress: { status: 'round_intro', furthestOpenIndex: 0 },
        },
        join: {
          team: {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            teamToken: 'token-1',
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText('Picture Round')).not.toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('confirms the join in the lobby and names the team to look for on the big screen', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: { progress: { status: 'lobby' } },
        join: {
          team: {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            teamToken: 'token-1',
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/you're in!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/look for The Quizzards on the big screen/i),
    ).toBeInTheDocument();
  });

  it('shows a link to the rules page while waiting in the lobby', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: { progress: { status: 'lobby' } },
        join: {
          team: {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            teamToken: 'token-1',
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByRole('link', { name: /read the rules/i }),
    ).toHaveAttribute('href', '/rules?code=ABCDEF');
  });
});
