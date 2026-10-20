import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS,
  type LeagueView,
} from '@campus-pubquiz/types';
import { SessionSettingsPanel } from '@/app/control/session-settings-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockUpdateSessionSettings } = vi.hoisted(() => ({
  mockUpdateSessionSettings: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, updateSessionSettings: mockUpdateSessionSettings };
});

const { mockFetchLeagues } = vi.hoisted(() => ({ mockFetchLeagues: vi.fn() }));

vi.mock('@/app/lib/leagues-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/leagues-api')>();
  return { ...actual, fetchLeagues: mockFetchLeagues };
});

function league(
  id: number,
  name: string,
  current: boolean,
  joinCodes: string[] = [],
): LeagueView {
  return {
    id,
    name,
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
    current,
    sessions: joinCodes.map((joinCode, index) => ({
      gameSessionId: index + 1,
      joinCode,
      name: 'Night',
      playedAt: '2026-02-01T20:00:00.000Z',
    })),
  };
}

describe('SessionSettingsPanel', () => {
  beforeEach(() => {
    mockUpdateSessionSettings.mockReset();
    mockUpdateSessionSettings.mockResolvedValue(undefined);
    mockFetchLeagues.mockReset();
    mockFetchLeagues.mockResolvedValue({ items: [] });
  });

  describe('league checkboxes', () => {
    it('hides the section when there are no leagues to tick', async () => {
      renderWithQuery(
        <SessionSettingsPanel
          joinCode="ABCDEF"
          settings={DEFAULT_SESSION_SETTINGS}
        />,
      );

      await waitFor(() => expect(mockFetchLeagues).toHaveBeenCalled());
      expect(screen.queryByText('Leagues')).not.toBeInTheDocument();
    });

    it('lists current leagues plus a past one the session is already in, ticked where it is a member', async () => {
      mockFetchLeagues.mockResolvedValue({
        items: [
          league(1, 'Autumn', true, ['ABCDEF']),
          league(2, 'Spring', false, ['ABCDEF']),
          league(3, 'Old', false, ['ZZZZZZ']),
          league(4, 'Winter', true),
        ],
      });
      renderWithQuery(
        <SessionSettingsPanel
          joinCode="ABCDEF"
          settings={DEFAULT_SESSION_SETTINGS}
        />,
      );

      expect(await screen.findByLabelText('Autumn')).toBeChecked();
      expect(screen.getByLabelText('Spring')).toBeChecked();
      expect(screen.getByLabelText('Winter')).not.toBeChecked();
      expect(screen.queryByLabelText('Old')).not.toBeInTheDocument();
    });

    it('saves the changed ticks together with the settings', async () => {
      mockFetchLeagues.mockResolvedValue({
        items: [
          league(1, 'Autumn', true, ['ABCDEF']),
          league(4, 'Winter', true),
        ],
      });
      renderWithQuery(
        <SessionSettingsPanel
          joinCode="ABCDEF"
          settings={DEFAULT_SESSION_SETTINGS}
        />,
      );

      await userEvent.click(await screen.findByLabelText('Winter'));
      await userEvent.click(screen.getByLabelText('Autumn'));
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(mockUpdateSessionSettings).toHaveBeenCalledWith('ABCDEF', {
        ...DEFAULT_SESSION_SETTINGS,
        leagueIds: [4],
      });
    });
  });

  it('saves the edited settings for the current join code', async () => {
    renderWithQuery(
      <SessionSettingsPanel
        joinCode="ABCDEF"
        settings={DEFAULT_SESSION_SETTINGS}
      />,
    );

    const input = screen.getByLabelText(/lock round after/i);
    await userEvent.clear(input);
    await userEvent.type(input, '15');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdateSessionSettings).toHaveBeenCalledWith('ABCDEF', {
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
    });
  });

  it('saves the "Collect feedback" switch turned off', async () => {
    renderWithQuery(
      <SessionSettingsPanel
        joinCode="ABCDEF"
        settings={DEFAULT_SESSION_SETTINGS}
      />,
    );

    await userEvent.click(screen.getByLabelText(/collect feedback/i));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdateSessionSettings).toHaveBeenCalledWith('ABCDEF', {
      ...DEFAULT_SESSION_SETTINGS,
      collectFeedback: false,
    });
  });

  it('saves the "Fun facts on the break screen" switch turned off', async () => {
    renderWithQuery(
      <SessionSettingsPanel
        joinCode="ABCDEF"
        settings={DEFAULT_SESSION_SETTINGS}
      />,
    );

    await userEvent.click(
      screen.getByLabelText(/fun facts on the break screen/i),
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdateSessionSettings).toHaveBeenCalledWith('ABCDEF', {
      ...DEFAULT_SESSION_SETTINGS,
      funFactsEnabled: false,
    });
  });

  it('re-syncs local edits when the settings prop changes (e.g. saved from another admin tab)', () => {
    const { rerender } = renderWithQuery(
      <SessionSettingsPanel
        joinCode="ABCDEF"
        settings={DEFAULT_SESSION_SETTINGS}
      />,
    );

    rerender(
      <SessionSettingsPanel
        joinCode="ABCDEF"
        settings={{ ...DEFAULT_SESSION_SETTINGS, lockGraceSeconds: 30 }}
      />,
    );

    expect(screen.getByLabelText(/lock round after/i)).toHaveValue(30);
  });

  it('shows an error toast when saving fails', async () => {
    const { SessionApiError } = await import('@/app/lib/sessions-api');
    mockUpdateSessionSettings.mockRejectedValue(
      new SessionApiError('Session already started', 409),
    );
    renderWithQuery(
      <>
        <SessionSettingsPanel
          joinCode="ABCDEF"
          settings={DEFAULT_SESSION_SETTINGS}
        />
        <Toaster />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(
      await screen.findByText(/session already started/i),
    ).toBeInTheDocument();
  });
});
