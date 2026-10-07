import { screen } from '@testing-library/react';
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

const FINAL_FORM: FeedbackField = {
  kind: 'final_form',
  rounds: [
    { id: 11, title: 'Music' },
    { id: 12, title: 'Film' },
    { id: 13, title: 'Kahoot Blitz' },
  ],
};

function renderEnded(
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
      snapshot: {
        progress: progress({ status: 'ended' }),
        currentQuestion: null,
        phoneScreen: { kind: 'ended' },
        feedback: 'feedback' in overrides ? overrides.feedback : FINAL_FORM,
      },
      team: { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' },
      rateRound,
      myRoundRatings: overrides.myRoundRatings ?? {},
    }),
  );
  renderWithQuery(<PlayPage />);
  return { rateRound };
}

function star(roundTitle: string, stars: number) {
  return screen.getByRole('button', {
    name: `Rate ${roundTitle} ${stars} of 5`,
  });
}

describe('PlayPage — the final feedback form', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  it('shows "Quiz complete!" followed by a star row for every listed round', () => {
    renderEnded();

    expect(screen.getByText('Quiz complete!')).toBeInTheDocument();
    for (const title of ['Music', 'Film', 'Kahoot Blitz']) {
      for (const stars of [1, 2, 3, 4, 5]) {
        expect(star(title, stars)).toBeInTheDocument();
      }
    }
  });

  it('fills the stars in from the saved ratings', () => {
    renderEnded({ myRoundRatings: { 12: 4 } });

    expect(star('Film', 4)).toHaveAttribute('aria-pressed', 'true');
    expect(star('Film', 5)).toHaveAttribute('aria-pressed', 'false');
    expect(star('Music', 1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends a changed rating and shows "Saved ✓"', async () => {
    const user = userEvent.setup();
    const { rateRound } = renderEnded({ myRoundRatings: { 12: 4 } });

    await user.click(star('Film', 2));

    expect(rateRound).toHaveBeenCalledWith(12, 2);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('shows "Not saved — tap to retry" when the server refuses', async () => {
    const user = userEvent.setup();
    renderEnded({
      rateRound: vi.fn().mockResolvedValue({ success: false, error: 'nope' }),
    });

    await user.click(star('Music', 3));

    expect(
      await screen.findByText('Not saved — tap to retry'),
    ).toBeInTheDocument();
  });

  it('keeps every row open once all are rated, unlike the break card', async () => {
    const user = userEvent.setup();
    renderEnded({ myRoundRatings: { 11: 5, 12: 4, 13: 3 } });

    await user.click(star('Music', 2));

    expect(star('Kahoot Blitz', 3)).toBeInTheDocument();
    expect(screen.queryByText(/rated ✓ · edit/i)).not.toBeInTheDocument();
  });

  it('shows no form while the feedback field is empty', () => {
    renderEnded({ feedback: null });

    expect(screen.getByText('Quiz complete!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Rate / })).toBeNull();
  });
});
