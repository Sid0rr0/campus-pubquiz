import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { socketResult } from './test-utils';

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

// The builder numbers the rounds 1, 2 and 3.
const MUSIC_ID = 1;
const FILM_ID = 2;
const BLITZ_ID = 3;

function endedSession(isFeedbackCollected: boolean) {
  return {
    rounds: [
      { title: 'Music', questions: [{}] },
      { title: 'Film', questions: [{}] },
      { title: 'Kahoot Blitz', kahootMode: true, questions: [{}] },
    ],
    progress: { status: 'ended' as const },
    settings: { collectFeedback: isFeedbackCollected },
  };
}

function renderEnded(
  overrides: {
    isFeedbackCollected?: boolean;
    rateRound?: ReturnType<typeof vi.fn>;
    myRoundRatings?: Record<number, number>;
  } = {},
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  const rateRound =
    overrides.rateRound ?? vi.fn().mockResolvedValue({ success: true });
  mockUseTeamLink.mockReturnValue(
    socketResult({
      session: endedSession(overrides.isFeedbackCollected ?? true),
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
    renderEnded({ myRoundRatings: { [FILM_ID]: 4 } });

    expect(star('Film', 4)).toHaveAttribute('aria-pressed', 'true');
    expect(star('Film', 5)).toHaveAttribute('aria-pressed', 'false');
    expect(star('Music', 1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends a changed rating and shows "Saved ✓"', async () => {
    const user = userEvent.setup();
    const { rateRound } = renderEnded({ myRoundRatings: { [FILM_ID]: 4 } });

    await user.click(star('Film', 2));

    expect(rateRound).toHaveBeenCalledWith(FILM_ID, 2);
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
    renderEnded({
      myRoundRatings: { [MUSIC_ID]: 5, [FILM_ID]: 4, [BLITZ_ID]: 3 },
    });

    await user.click(star('Music', 2));

    expect(star('Kahoot Blitz', 3)).toBeInTheDocument();
    expect(screen.queryByText(/rated ✓ · edit/i)).not.toBeInTheDocument();
  });

  it('shows no form while the session does not collect feedback', () => {
    renderEnded({ isFeedbackCollected: false });

    expect(screen.getByText('Quiz complete!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Rate / })).toBeNull();
  });
});
