import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { SessionSettingsPanel } from '@/app/admin/session-settings-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockUpdateSessionSettings } = vi.hoisted(() => ({
  mockUpdateSessionSettings: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, updateSessionSettings: mockUpdateSessionSettings };
});

describe('SessionSettingsPanel', () => {
  beforeEach(() => {
    mockUpdateSessionSettings.mockReset();
    mockUpdateSessionSettings.mockResolvedValue(undefined);
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
