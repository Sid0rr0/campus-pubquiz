import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamSessionRatingsView } from '@campus-pubquiz/types';
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

const NOTHING_ANSWERED: TeamSessionRatingsView = {
  pacing: null,
  feltDifficulty: null,
};

function session(
  progress: Record<string, unknown>,
  isFeedbackCollected = true,
) {
  return {
    rounds: [
      { title: 'Music', breakAfter: false, questions: [{}] },
      { title: 'Film', questions: [{}] },
    ],
    progress,
    settings: { collectFeedback: isFeedbackCollected },
  };
}

function renderPhone(
  overrides: {
    progress?: Record<string, unknown>;
    isFeedbackCollected?: boolean;
    rateSession?: ReturnType<typeof vi.fn>;
    mySessionRatings?: TeamSessionRatingsView;
    roundRatingsEpoch?: number;
  } = {},
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  const rateSession =
    overrides.rateSession ?? vi.fn().mockResolvedValue({ success: true });
  const result = () =>
    teamLinkResult({
      session: session(
        overrides.progress ?? { status: 'ended' },
        overrides.isFeedbackCollected,
      ),
      join: {
        team: { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' },
      },
      game: {
        rateSession,
        mySessionRatings: overrides.mySessionRatings ?? NOTHING_ANSWERED,
        roundRatingsEpoch: overrides.roundRatingsEpoch ?? 0,
      },
    });
  mockUseTeamLink.mockReturnValue(result());
  const rendered = renderWithQuery(<PlayPage />);
  return { rateSession, rendered };
}

function pace() {
  return screen.getByRole('group', { name: 'How was the pace?' });
}

function difficulty() {
  return screen.getByRole('group', { name: 'How hard were the questions?' });
}

function choice(group: HTMLElement, label: string) {
  return within(group).getByRole('button', { name: label });
}

describe('PlayPage — pacing and felt difficulty on the final form', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(teamLinkResult());
  });

  it('asks both questions with three choices each, nothing chosen, above the round stars', () => {
    renderPhone();

    const paceChoices = within(pace()).getAllByRole('button');
    const difficultyChoices = within(difficulty()).getAllByRole('button');
    expect(paceChoices.map((button) => button.textContent)).toEqual([
      'Too slow',
      'Just right',
      'Too fast',
    ]);
    expect(difficultyChoices.map((button) => button.textContent)).toEqual([
      'Too easy',
      'Just right',
      'Too hard',
    ]);
    for (const button of [...paceChoices, ...difficultyChoices]) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    const firstStar = screen.getByRole('button', { name: 'Rate Music 1 of 5' });
    expect(
      difficulty().compareDocumentPosition(firstStar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('highlights the answers the team already gave', () => {
    renderPhone({
      mySessionRatings: { pacing: 'too_fast', feltDifficulty: 'just_right' },
    });

    expect(choice(pace(), 'Too fast')).toHaveAttribute('aria-pressed', 'true');
    expect(choice(pace(), 'Too slow')).toHaveAttribute('aria-pressed', 'false');
    expect(choice(difficulty(), 'Just right')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('saves a tap at once, highlights it and says "Saved ✓"', async () => {
    const user = userEvent.setup();
    const { rateSession } = renderPhone();

    await user.click(choice(difficulty(), 'Too hard'));

    expect(rateSession).toHaveBeenCalledWith({
      scale: 'feltDifficulty',
      value: 'too_hard',
    });
    expect(choice(difficulty(), 'Too hard')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await within(difficulty()).findByText('Saved ✓')).toBeVisible();
    expect(choice(pace(), 'Too slow')).toHaveAttribute('aria-pressed', 'false');
  });

  it('lets the team change its answer', async () => {
    const user = userEvent.setup();
    const { rateSession } = renderPhone({
      mySessionRatings: { pacing: 'too_slow', feltDifficulty: null },
    });

    await user.click(choice(pace(), 'Just right'));

    expect(rateSession).toHaveBeenCalledWith({
      scale: 'pacing',
      value: 'just_right',
    });
    expect(choice(pace(), 'Just right')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(choice(pace(), 'Too slow')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "Not saved — tap to retry" when the server refuses', async () => {
    const user = userEvent.setup();
    renderPhone({
      rateSession: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Feedback is off' }),
    });

    await user.click(choice(pace(), 'Too fast'));

    expect(
      await within(pace()).findByText('Not saved — tap to retry'),
    ).toBeVisible();
  });

  it('shows the answers a new join restored', () => {
    const { rendered } = renderPhone();

    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: session({ status: 'ended' }),
        join: {
          team: { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' },
        },
        game: {
          mySessionRatings: { pacing: 'too_slow', feltDifficulty: null },
          roundRatingsEpoch: 1,
        },
      }),
    );
    rendered.rerender(<PlayPage />);

    expect(choice(pace(), 'Too slow')).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks neither question while the session does not collect feedback', () => {
    renderPhone({ isFeedbackCollected: false });

    expect(
      screen.queryByRole('group', { name: 'How was the pace?' }),
    ).toBeNull();
    expect(
      screen.queryByRole('group', { name: 'How hard were the questions?' }),
    ).toBeNull();
  });

  it('asks neither question on the break card', () => {
    renderPhone({
      progress: {
        status: 'break',
        roundIndex: 1,
        questionIndex: 0,
        furthestOpenIndex: 1,
      },
    });

    expect(
      screen.getByRole('button', { name: 'Rate Music 1 of 5' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'How was the pace?' }),
    ).toBeNull();
  });
});
