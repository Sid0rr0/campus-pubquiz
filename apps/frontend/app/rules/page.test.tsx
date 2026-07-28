import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RulesPage from '@/app/rules/page';

const { mockUseGameSocket } = vi.hoisted(() => ({ mockUseGameSocket: vi.fn() }));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

describe('RulesPage', () => {
  it('shows a connecting message before the first snapshot arrives', () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null });
    render(<RulesPage />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('renders the rules with the active quiz structure filled in', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { quizStructure: { blockCount: 2, topicsPerBlock: 3 } },
    });
    render(<RulesPage />);

    expect(screen.getByText(/2 rounds of 3 topics/i)).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
    expect(screen.getByText(/organizers have the final word/i)).toBeInTheDocument();
  });

  it('falls back to a break-only sentence when block sizes vary', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { quizStructure: { blockCount: 2, topicsPerBlock: null } },
    });
    render(<RulesPage />);

    expect(screen.getByText(/2 rounds, with a break in between/i)).toBeInTheDocument();
  });
});
