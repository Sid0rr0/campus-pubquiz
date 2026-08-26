import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinForm } from '@/app/components/join-form';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchPublicSessions } = vi.hoisted(() => ({
  mockFetchPublicSessions: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, fetchPublicSessions: mockFetchPublicSessions };
});

function ControlledJoinForm({
  connectionError = null,
  onSubmit = vi.fn(),
}: {
  connectionError?: string | null;
  onSubmit?: () => void;
}) {
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [teamCodeInput, setTeamCodeInput] = useState('');
  return (
    <JoinForm
      nameInput={nameInput}
      onNameInputChange={setNameInput}
      codeInput={codeInput}
      onCodeInputChange={setCodeInput}
      teamCodeInput={teamCodeInput}
      onTeamCodeInputChange={setTeamCodeInput}
      connectionError={connectionError}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    />
  );
}

describe('JoinForm', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows team name and game code fields', () => {
    renderWithQuery(<ControlledJoinForm />);

    expect(
      screen.getByRole('textbox', { name: /team name/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /game code/i }),
    ).toBeInTheDocument();
  });

  it('hides the team code field until "Played before?" is clicked', async () => {
    renderWithQuery(<ControlledJoinForm />);

    expect(
      screen.queryByRole('textbox', { name: /team code/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /played before/i }),
    );
    expect(
      screen.getByRole('textbox', { name: /team code/i }),
    ).toBeInTheDocument();
  });

  it('shows the team code field and a connectionError alert when reconnecting fails', () => {
    renderWithQuery(
      <ControlledJoinForm connectionError="Team name taken — enter its team code" />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/team name taken/i);
    expect(
      screen.getByRole('textbox', { name: /team code/i }),
    ).toBeInTheDocument();
  });

  it('fills the game code field when a live session is picked from the select', async () => {
    mockFetchPublicSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
      },
    ]);
    const user = userEvent.setup();
    renderWithQuery(<ControlledJoinForm />);

    await user.click(
      await screen.findByRole('combobox', { name: /pick the quiz/i }),
    );
    await user.click(
      await screen.findByRole('option', { name: /campus pub quiz night/i }),
    );

    expect(screen.getByRole('textbox', { name: /game code/i })).toHaveValue(
      'ABCDEF',
    );
  });

  it('calls onSubmit when the form is submitted', async () => {
    const onSubmit = vi.fn();
    renderWithQuery(<ControlledJoinForm onSubmit={onSubmit} />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /game code/i }),
      'ABCDEF',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /join the quiz/i }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
