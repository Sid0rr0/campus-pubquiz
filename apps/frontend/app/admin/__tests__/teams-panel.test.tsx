import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TeamView } from '@campus-pubquiz/types';
import { TeamsPanel } from '@/app/admin/teams-panel';

const TEAMS: TeamView[] = [
  { teamId: 1, teamName: 'The Quizzards', isConnected: true },
  { teamId: 2, teamName: 'Beer Necessities', isConnected: false },
];

describe('TeamsPanel', () => {
  it('opens a bonus award form for a team and awards a predefined-category bonus at its default 1 point', async () => {
    const onAwardBonus = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={vi.fn()}
        onAwardBonus={onAwardBonus}
      />,
    );

    await userEvent.click(
      screen.getAllByRole('button', { name: /^bonus$/i })[0],
    );
    await userEvent.click(screen.getByRole('button', { name: /^selfie$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

    expect(onAwardBonus).toHaveBeenCalledWith(1, 'selfie', 1, undefined);
  });

  it('requires a reason before a custom bonus can be awarded', async () => {
    const onAwardBonus = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={vi.fn()}
        onAwardBonus={onAwardBonus}
      />,
    );

    await userEvent.click(
      screen.getAllByRole('button', { name: /^bonus$/i })[0],
    );
    await userEvent.click(screen.getByRole('button', { name: /^custom$/i }));
    expect(screen.getByRole('button', { name: /^award$/i })).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/bonus reason/i),
      'Best team name',
    );
    await userEvent.clear(screen.getByLabelText(/bonus points/i));
    await userEvent.type(screen.getByLabelText(/bonus points/i), '3');
    await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

    expect(onAwardBonus).toHaveBeenCalledWith(1, 'custom', 3, 'Best team name');
  });

  it('allows awarding a negative-points penalty', async () => {
    const onAwardBonus = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={vi.fn()}
        onAwardBonus={onAwardBonus}
      />,
    );

    await userEvent.click(
      screen.getAllByRole('button', { name: /^bonus$/i })[0],
    );
    await userEvent.click(screen.getByRole('button', { name: /^custom$/i }));
    await userEvent.type(
      screen.getByLabelText(/bonus reason/i),
      'Late arrival',
    );
    await userEvent.clear(screen.getByLabelText(/bonus points/i));
    await userEvent.type(screen.getByLabelText(/bonus points/i), '-2');
    expect(screen.getByRole('button', { name: /^award$/i })).not.toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

    expect(onAwardBonus).toHaveBeenCalledWith(1, 'custom', -2, 'Late arrival');
  });

  it('cancels the bonus form without awarding', async () => {
    const onAwardBonus = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={vi.fn()}
        onAwardBonus={onAwardBonus}
      />,
    );

    await userEvent.click(
      screen.getAllByRole('button', { name: /^bonus$/i })[0],
    );
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(
      screen.queryByRole('button', { name: /^award$/i }),
    ).not.toBeInTheDocument();
    expect(onAwardBonus).not.toHaveBeenCalled();
  });

  it('allows kicking a disconnected team', async () => {
    const onKickTeam = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={onKickTeam}
        onAwardBonus={vi.fn()}
      />,
    );

    const disconnectedTeamItem = screen
      .getByText('Beer Necessities')
      .closest('li');
    expect(disconnectedTeamItem).not.toBeNull();
    const kickButton = within(disconnectedTeamItem as HTMLElement).getByRole(
      'button',
      {
        name: /^kick$/i,
      },
    );

    await userEvent.click(kickButton);

    expect(onKickTeam).toHaveBeenCalledWith(2);
  });
});
