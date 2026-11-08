import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizMode, QuizSummary } from '@campus-pubquiz/types';
import { StartSessionDialog } from '@/app/components/start-session-dialog';
import { renderWithQuery } from '@/test-utils/query';

const { mockCreateSession } = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, createSession: mockCreateSession };
});

const { mockFetchLeagues } = vi.hoisted(() => ({ mockFetchLeagues: vi.fn() }));

vi.mock('@/app/lib/leagues-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/leagues-api')>();
  return { ...actual, fetchLeagues: mockFetchLeagues };
});

function quiz(mode: QuizMode): QuizSummary {
  return {
    id: 7,
    title: 'Night',
    mode,
    updatedAt: '2026-01-01T00:00:00.000Z',
    rounds: [],
  };
}

function open(mode: QuizMode) {
  return renderWithQuery(
    <StartSessionDialog
      quiz={quiz(mode)}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
}

describe('StartSessionDialog', () => {
  beforeEach(() => {
    mockCreateSession.mockReset();
    mockCreateSession.mockResolvedValue({ joinCode: 'ABCDEF' });
    mockFetchLeagues.mockReset();
    mockFetchLeagues.mockResolvedValue({
      items: [
        {
          id: 4,
          name: 'Winter',
          startsOn: '2026-01-01',
          endsOn: '2026-12-31',
          current: true,
          sessions: [],
        },
      ],
    });
  });

  it('offers a pub quiz leagues and a power-ups tab, with no question timer', async () => {
    open('pub');

    expect(await screen.findByLabelText('Winter')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Power-ups' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByLabelText('Jokers')).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Quickfire question timer/),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(mockCreateSession.mock.calls[0][1]).toHaveProperty('startingCoins');
  });

  it('offers a quickfire quiz the timer only and sends no coin settings', async () => {
    open('quickfire');

    await waitFor(() => expect(mockFetchLeagues).toHaveBeenCalled());
    expect(screen.queryByLabelText('Winter')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Power-ups' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.queryByLabelText('Jokers')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(/Quickfire question timer/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    const sent = mockCreateSession.mock.calls[0][1];
    expect(sent).not.toHaveProperty('startingCoins');
    expect(sent).not.toHaveProperty('powerUps');
  });
});
