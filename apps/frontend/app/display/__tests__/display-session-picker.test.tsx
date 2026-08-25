import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplaySessionPicker } from '@/app/display/display-session-picker';

const { mockFetchPublicSessions } = vi.hoisted(() => ({
  mockFetchPublicSessions: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, fetchPublicSessions: mockFetchPublicSessions };
});

describe('DisplaySessionPicker', () => {
  beforeEach(() => {
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows a message when no sessions are running', async () => {
    render(<DisplaySessionPicker onSelectSession={vi.fn()} />);

    expect(
      await screen.findByText(/no games running yet/i),
    ).toBeInTheDocument();
  });

  it('lists running sessions with their quiz title, status and team count', async () => {
    mockFetchPublicSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
      },
    ]);
    render(<DisplaySessionPicker onSelectSession={vi.fn()} />);

    expect(
      await screen.findByText('Campus Pub Quiz Night'),
    ).toBeInTheDocument();
    expect(screen.getByText(/lobby · 3 teams · abcdef/i)).toBeInTheDocument();
  });

  it('selects a session when clicked', async () => {
    mockFetchPublicSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 0,
      },
    ]);
    const onSelectSession = vi.fn();
    render(<DisplaySessionPicker onSelectSession={onSelectSession} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /campus pub quiz night/i }),
    );

    expect(onSelectSession).toHaveBeenCalledWith('ABCDEF');
  });

  it('shows an error when the session list cannot be loaded', async () => {
    mockFetchPublicSessions.mockRejectedValue(new Error('network down'));
    render(<DisplaySessionPicker onSelectSession={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load sessions/i,
    );
  });

  it('surfaces a connectionError prop from a stale/unknown code', () => {
    render(
      <DisplaySessionPicker
        onSelectSession={vi.fn()}
        connectionError="Unknown game session code"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      /unknown game session code/i,
    );
  });

  it('refreshes the list on demand', async () => {
    mockFetchPublicSessions.mockResolvedValue([]);
    render(<DisplaySessionPicker onSelectSession={vi.fn()} />);
    await screen.findByText(/no games running yet/i);
    mockFetchPublicSessions.mockClear();

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(mockFetchPublicSessions).toHaveBeenCalledTimes(1);
  });

  it('re-enables the Refresh button under Strict Mode double-mounted effects', async () => {
    // The App Router defaults reactStrictMode to true (see next.config.ts),
    // so `next dev` mounts, cleans up, and remounts every effect once. This
    // reproduces that here to guard against the isMountedRef flag getting
    // stuck false after the synthetic cleanup and permanently skipping
    // setIsLoading(false), which left the button stuck on "Refreshing…".
    mockFetchPublicSessions.mockResolvedValue([]);
    render(
      <StrictMode>
        <DisplaySessionPicker onSelectSession={vi.fn()} />
      </StrictMode>,
    );

    const refreshButton = await screen.findByRole('button', {
      name: /refresh/i,
    });
    expect(refreshButton).toBeEnabled();

    await userEvent.click(refreshButton);

    expect(
      await screen.findByRole('button', { name: /^refresh$/i }),
    ).toBeEnabled();
  });
});
