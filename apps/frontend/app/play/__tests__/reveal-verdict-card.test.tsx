import { act, screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { AUTO_ADVANCE_STORAGE_KEY } from '@/app/lib/player-settings-storage';
import { vibrate } from '@/app/lib/vibrate';
import type { SessionDescription } from '@/test-utils/room-view';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('@/app/lib/vibrate', () => ({ vibrate: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TEAM = {
  teamId: 'team-1',
  teamName: 'Returning Team',
  teamToken: 'team-token-1',
};

const GRADED_AT = '2024-01-01T00:00:00.000Z';
const CARD_MS = 3_000;

const ROUNDS = [
  {
    questions: [
      { id: 1, prompt: 'Name a fruit', points: 2, answer: 'Banana' },
      { id: 2, prompt: 'Name a planet', points: 3, answer: 'Mars' },
      { id: 3, prompt: 'Name a country', points: 1, answer: 'Peru' },
    ],
  },
];

/** The team got #1 right, #2 partly right, #3 wrong, and answered all three. */
const MY_ANSWERS = { 1: 'Banana', 2: 'Mars?', 3: 'Chile' };
const MY_GRADES = {
  1: { pointsAwarded: 2, gradedAt: GRADED_AT, verdict: 'correct' as const },
  2: { pointsAwarded: 1.5, gradedAt: GRADED_AT, verdict: 'partial' as const },
  3: { pointsAwarded: 0, gradedAt: GRADED_AT, verdict: 'incorrect' as const },
};

function atReveal(revealIndex: number): SessionDescription {
  return {
    rounds: ROUNDS,
    progress: { status: 'reveal', revealIndex, questionIndex: 2 },
  };
}

describe('PlayPage — reveal verdict card', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    searchParamsRef.current = new URLSearchParams();
    vi.mocked(vibrate).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function showPhoneAt(
    session: SessionDescription,
    options: {
      myAnswers?: Record<number, string>;
      connectionError?: string | null;
    } = {},
  ) {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session,
        join: { team: TEAM, connectionError: options.connectionError ?? null },
        game: {
          myAnswers: options.myAnswers ?? MY_ANSWERS,
          myAnswerGrades: MY_GRADES,
        },
      }),
    );
  }

  function renderPhoneAt(session: SessionDescription) {
    showPhoneAt(session);
    return renderWithQuery(<PlayPage />);
  }

  it('shows no card and no vibration on the first snapshot, e.g. a reconnect into a reveal', () => {
    renderPhoneAt(atReveal(0));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('shows "✓ Correct +2" and vibrates when the big screen lands on a correctly answered question', () => {
    const { rerender } = renderPhoneAt({
      rounds: ROUNDS,
      progress: { status: 'reveal_intro', revealIndex: 0, questionIndex: 2 },
    });

    showPhoneAt(atReveal(0));
    rerender(<PlayPage />);

    expect(screen.getByRole('status')).toHaveTextContent('✓ Correct +2');
    expect(vibrate).toHaveBeenCalledWith('success');
  });

  it('shows "Close! +1.5" without vibrating for a partial verdict', () => {
    const { rerender } = renderPhoneAt(atReveal(0));

    showPhoneAt(atReveal(1));
    rerender(<PlayPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Close! +1.5');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('shows "✗ +0" for an incorrect verdict', () => {
    const { rerender } = renderPhoneAt(atReveal(1));

    showPhoneAt(atReveal(2));
    rerender(<PlayPage />);

    expect(screen.getByRole('status')).toHaveTextContent('✗ +0');
  });

  it('shows "No answer" when the team did not answer', () => {
    const { rerender } = renderPhoneAt(atReveal(0));

    showPhoneAt(atReveal(1), { myAnswers: { 1: 'Banana' } });
    rerender(<PlayPage />);

    expect(screen.getByRole('status')).toHaveTextContent('No answer');
  });

  it('shows the card even with auto-advance off', () => {
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, '0');
    const { rerender } = renderPhoneAt(atReveal(0));

    showPhoneAt(atReveal(1));
    rerender(<PlayPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Close! +1.5');
  });

  it('dismisses itself after about three seconds', () => {
    vi.useFakeTimers();
    const { rerender } = renderPhoneAt(atReveal(0));
    showPhoneAt(atReveal(1));
    rerender(<PlayPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CARD_MS + 100);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows no card and no vibration when the quiz master steps back with Previous', () => {
    const { rerender } = renderPhoneAt(atReveal(1));

    showPhoneAt(atReveal(0));
    rerender(<PlayPage />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('treats the first snapshot after a connection drop as a fresh load', () => {
    const { rerender } = renderPhoneAt(atReveal(0));
    showPhoneAt(atReveal(0), { connectionError: 'Reconnecting…' });
    rerender(<PlayPage />);

    showPhoneAt(atReveal(1));
    rerender(<PlayPage />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
