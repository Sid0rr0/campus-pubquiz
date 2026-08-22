import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RulesPage from '@/app/rules/page';

const { mockUseGameSocket, searchParamsRef, routerRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

describe('RulesPage', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReset();
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
    });
  });

  it('renders the static house rules with no ?code= in the URL, skipping the socket entirely', () => {
    render(<RulesPage />);

    expect(mockUseGameSocket).toHaveBeenLastCalledWith(
      'players',
      false,
      undefined,
    );
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
    expect(
      screen.getByText(/organizers have the final word/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/rounds/i)).not.toBeInTheDocument();
  });

  it('shows a connecting message once a ?code= is present but no snapshot has arrived yet', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<RulesPage />);

    expect(mockUseGameSocket).toHaveBeenLastCalledWith(
      'players',
      true,
      'ABCDEF',
    );
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('renders the rules with the active quiz structure filled in once connected', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        quizStructure: {
          blockCount: 2,
          topicsPerBlock: 3,
          breakRoundNumbers: [3, 6],
          minQuestionsPerTopic: 4,
          maxQuestionsPerTopic: 4,
        },
      },
      connectionError: null,
    });
    render(<RulesPage />);

    expect(
      screen.getByText(
        /6 topics, 4 questions each, with a break after every 3 rounds/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('falls back to the static rules and cleans the URL when the code is unknown or stale', () => {
    searchParamsRef.current = new URLSearchParams('code=STALE1');
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: 'Unknown game session code',
    });
    render(<RulesPage />);

    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
    expect(routerRef.replace).toHaveBeenCalledWith('/rules');
  });
});
