import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function renderOpenFreeTextQuestion(submitAnswer: ReturnType<typeof vi.fn>) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session: {
        rounds: [
          {
            questions: [
              { type: 'free_text', prompt: 'Name a fruit', points: 1 },
            ],
          },
        ],
        progress: { status: 'question_open' },
      },
      join: {
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      },
      game: { submitAnswer },
    }),
  );
  renderWithQuery(<PlayPage />);
}

describe('PlayPage — Saved confirmation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('shows "Saved ✓" after the server accepts a submit', async () => {
    const submitAnswer = vi.fn().mockResolvedValue({ success: true });
    renderOpenFreeTextQuestion(submitAnswer);

    await userEvent.type(
      screen.getByRole('textbox', { name: /your answer/i }),
      'Apple',
    );
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/saved ✓/i)).toBeInTheDocument();
  });

  it('does not show "Saved ✓" when the server refuses the submit', async () => {
    const submitAnswer = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Answers are locked' });
    renderOpenFreeTextQuestion(submitAnswer);

    await userEvent.type(
      screen.getByRole('textbox', { name: /your answer/i }),
      'Apple',
    );
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalled());
    expect(screen.queryByText(/saved ✓/i)).not.toBeInTheDocument();
  });

  it('shows nothing before any submit', () => {
    renderOpenFreeTextQuestion(vi.fn());

    expect(screen.queryByText(/saved ✓/i)).not.toBeInTheDocument();
  });
});
