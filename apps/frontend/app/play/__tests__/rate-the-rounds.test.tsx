import { screen, waitFor } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackField } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

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

const BREAK_CARD: FeedbackField = {
  kind: 'break_card',
  rounds: [
    { id: 11, title: 'Music' },
    { id: 12, title: 'Film' },
  ],
};

function breakSnapshot(feedback: FeedbackField | undefined) {
  return {
    progress: progress({ status: 'break' }),
    currentQuestion: null,
    feedback,
    blockQuestions: [
      {
        id: 1,
        type: 'free_text',
        prompt: 'Name a fruit',
        points: 1,
        roundNumber: 1,
        questionNumberInRound: 1,
        roundTitle: 'Music',
      },
    ],
  };
}

function renderBreak(
  overrides: {
    feedback?: FeedbackField;
    rateRound?: ReturnType<typeof vi.fn>;
    myRoundRatings?: Record<number, number>;
  } = {},
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  const rateRound =
    overrides.rateRound ?? vi.fn().mockResolvedValue({ success: true });
  mockUseTeamLink.mockReturnValue(
    socketResult({
      snapshot: breakSnapshot(
        'feedback' in overrides ? overrides.feedback : BREAK_CARD,
      ),
      team: { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' },
      rateRound,
      myRoundRatings: overrides.myRoundRatings ?? {},
    }),
  );
  const { rerender } = renderWithQuery(<PlayPage />);
  return { rateRound, rerender };
}

function star(roundTitle: string, stars: number) {
  return screen.getByRole('button', {
    name: `Rate ${roundTitle} ${stars} of 5`,
  });
}

describe('PlayPage — rating the rounds in the break', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  it('shows a row of five stars for each listed round, above the block browser', () => {
    renderBreak();

    expect(screen.getByText('Rate these rounds')).toBeInTheDocument();
    for (const title of ['Music', 'Film']) {
      for (const stars of [1, 2, 3, 4, 5]) {
        expect(star(title, stars)).toBeInTheDocument();
      }
    }
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('sends the tapped rating for that round and shows "Saved ✓" once acknowledged', async () => {
    const user = userEvent.setup();
    const { rateRound } = renderBreak();

    await user.click(star('Film', 4));

    expect(rateRound).toHaveBeenCalledWith(12, 4);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('shows "Not saved — tap to retry" when the server refuses, and a retry can succeed', async () => {
    const user = userEvent.setup();
    const rateRound = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'nope' })
      .mockResolvedValueOnce({ success: true });
    renderBreak({ rateRound });

    await user.click(star('Music', 3));
    expect(
      await screen.findByText('Not saved — tap to retry'),
    ).toBeInTheDocument();

    await user.click(star('Music', 3));

    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(
      screen.queryByText('Not saved — tap to retry'),
    ).not.toBeInTheDocument();
  });

  it('collapses to "Rated ✓ · edit" once every round is saved, and reopens on edit', async () => {
    const user = userEvent.setup();
    renderBreak();

    await user.click(star('Music', 5));
    await user.click(star('Film', 2));

    const edit = await screen.findByRole('button', { name: /rated ✓ · edit/i });
    expect(screen.queryByText('Rate these rounds')).not.toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();

    await user.click(edit);

    expect(screen.getByText('Rate these rounds')).toBeInTheDocument();
  });

  it('keeps the card open while a round is still unrated', async () => {
    const user = userEvent.setup();
    renderBreak();

    await user.click(star('Music', 5));

    await waitFor(() => expect(screen.getByText('Saved ✓')).toBeVisible());
    expect(screen.getByText('Rate these rounds')).toBeInTheDocument();
  });

  it('starts collapsed when the join payload already holds a rating for every round', () => {
    renderBreak({ myRoundRatings: { 11: 4, 12: 2 } });

    expect(
      screen.getByRole('button', { name: /rated ✓ · edit/i }),
    ).toBeInTheDocument();
  });

  it('shows a restored rating as saved and a round never rated as empty', () => {
    renderBreak({ myRoundRatings: { 11: 4 } });

    expect(star('Music', 4)).toHaveAttribute('aria-pressed', 'true');
    expect(star('Music', 5)).toHaveAttribute('aria-pressed', 'false');
    expect(star('Film', 1)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
  });

  it('drops a tap still waiting on the old connection once a rejoin replaces the ratings', async () => {
    const user = userEvent.setup();
    let acknowledgeLate!: (ack: { success: true }) => void;
    const rateRound = vi.fn(
      () =>
        new Promise<{ success: true }>((resolve) => {
          acknowledgeLate = resolve;
        }),
    );
    const { rerender } = renderBreak({ rateRound });
    await user.click(star('Music', 5));
    expect(star('Music', 5)).toHaveAttribute('aria-pressed', 'true');

    // The phone rejoined: the join payload says the server never got the tap.
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: breakSnapshot(BREAK_CARD),
        team: { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' },
        rateRound,
        myRoundRatings: {},
        roundRatingsEpoch: 1,
      }),
    );
    rerender(<PlayPage />);
    acknowledgeLate({ success: true });

    await waitFor(() =>
      expect(star('Music', 5)).toHaveAttribute('aria-pressed', 'false'),
    );
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
  });

  it('renders nothing about feedback when the feedback field is empty', () => {
    renderBreak({ feedback: null });

    expect(screen.queryByText('Rate these rounds')).not.toBeInTheDocument();
    expect(screen.queryByText(/rated ✓/i)).not.toBeInTheDocument();
  });
});
