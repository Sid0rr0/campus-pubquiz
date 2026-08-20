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
  it('allows kicking a disconnected team', async () => {
    const onKickTeam = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={onKickTeam}
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
