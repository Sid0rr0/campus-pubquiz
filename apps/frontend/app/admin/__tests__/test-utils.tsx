import { screen, within } from '@testing-library/react';
import type { GameProgress } from '@campus-pubquiz/types';

export function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

// Advance/Previous render in both the always-mounted mobile sticky bar and
// the desktop sidebar (each hidden from the other via a CSS media query that
// jsdom doesn't evaluate) — scope to the desktop <aside> (the "complementary"
// landmark) so these queries match exactly one button.
export function getDesktopButton(name: RegExp): HTMLElement {
  return within(screen.getByRole('complementary')).getByRole('button', { name });
}
