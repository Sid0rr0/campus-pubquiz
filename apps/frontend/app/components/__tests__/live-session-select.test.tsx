import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LiveSessionSelect,
  isPointInRect,
} from '@/app/components/live-session-select';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchPublicSessions } = vi.hoisted(() => ({
  mockFetchPublicSessions: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, fetchPublicSessions: mockFetchPublicSessions };
});

describe('LiveSessionSelect', () => {
  beforeEach(() => {
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows a disabled picker with a placeholder while no games are running', async () => {
    renderWithQuery(<LiveSessionSelect value="" onSelectSession={vi.fn()} />);

    await vi.waitFor(() => expect(mockFetchPublicSessions).toHaveBeenCalled());
    const trigger = screen.getByRole('combobox', { name: /pick the quiz/i });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent(/no games running yet/i);
  });

  it('lists running sessions once loaded', async () => {
    mockFetchPublicSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        name: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
      },
    ]);
    renderWithQuery(<LiveSessionSelect value="" onSelectSession={vi.fn()} />);

    expect(
      await screen.findByRole('combobox', { name: /pick the quiz/i }),
    ).toBeInTheDocument();
  });

  it('calls onSelectSession with the join code when an option is picked', async () => {
    mockFetchPublicSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        name: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
      },
    ]);
    const onSelectSession = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <LiveSessionSelect value="" onSelectSession={onSelectSession} />,
    );

    await user.click(
      await screen.findByRole('combobox', { name: /pick the quiz/i }),
    );
    await user.click(
      await screen.findByRole('option', { name: /campus pub quiz night/i }),
    );

    expect(onSelectSession).toHaveBeenCalledWith('ABCDEF');
  });

  it('shows an error when the session list cannot be loaded, but does not block manual entry', async () => {
    mockFetchPublicSessions.mockRejectedValue(new Error('network down'));
    renderWithQuery(<LiveSessionSelect value="" onSelectSession={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load live games/i,
    );
  });
});

describe('isPointInRect', () => {
  const rect = { left: 10, right: 20, top: 30, bottom: 40 } as DOMRect;

  it('counts a point on or inside the edges as on the trigger', () => {
    expect(isPointInRect(rect, 10, 30)).toBe(true);
    expect(isPointInRect(rect, 20, 40)).toBe(true);
  });

  it('counts a point past any edge as off the trigger', () => {
    expect(isPointInRect(rect, 9, 35)).toBe(false);
    expect(isPointInRect(rect, 21, 35)).toBe(false);
    expect(isPointInRect(rect, 15, 29)).toBe(false);
    expect(isPointInRect(rect, 15, 41)).toBe(false);
  });
});
