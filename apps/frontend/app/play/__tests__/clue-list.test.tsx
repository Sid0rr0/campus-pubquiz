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

describe('PlayPage — a Clue question', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
  });

  it('lists the clues shown so far under the prompt', () => {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'clues',
                  prompt: 'Who am I?',
                  options: ['Vague', 'Sharper', 'Giveaway'],
                  points: 1.5,
                },
              ],
            },
          ],
          progress: { status: 'question_open' },
          clueStep: 1,
          highestClueShown: { 1: 2 },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Who am I?')).toBeInTheDocument();
    expect(screen.getByText('Vague')).toBeInTheDocument();
    expect(screen.getByText('Sharper')).toBeInTheDocument();
    expect(screen.queryByText('Giveaway')).not.toBeInTheDocument();
  });
});
