import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminTeamView } from '@campus-pubquiz/types';
import { TeamsPanel } from '@/app/control/teams-panel';

const TEAMS: AdminTeamView[] = [
  {
    teamId: 1,
    teamName: 'The Quizzards',
    isConnected: true,
    playerCount: 4,
    isOverPlayerCap: false,
    joker: null,
  },
  {
    teamId: 2,
    teamName: 'Beer Necessities',
    isConnected: false,
    playerCount: null,
    isOverPlayerCap: false,
    joker: null,
  },
];

function teamItem(name: string): HTMLElement {
  return screen.getByText(name).closest('li') as HTMLElement;
}

describe('TeamsPanel player counts', () => {
  const renderPanel = (
    teams: AdminTeamView[] = TEAMS,
    onSetPlayerCount = vi.fn(),
  ) => {
    render(
      <TeamsPanel
        teams={teams}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={vi.fn()}
        onSetPlayerCount={onSetPlayerCount}
        jokerRounds={[]}
        onSetJoker={vi.fn()}
      />,
    );
    return onSetPlayerCount;
  };

  it('shows each team’s count, and a dash for a team with none', () => {
    renderPanel();

    expect(within(teamItem('The Quizzards')).getByText('4')).toBeVisible();
    expect(within(teamItem('Beer Necessities')).getByText('—')).toBeVisible();
  });

  it('flags only a team over the cap', () => {
    renderPanel([
      { ...TEAMS[0], playerCount: 8, isOverPlayerCap: true },
      TEAMS[1],
    ]);

    expect(
      within(teamItem('The Quizzards')).getByText(/over the player cap/i),
    ).toBeVisible();
    expect(
      within(teamItem('Beer Necessities')).queryByText(/over the player cap/i),
    ).not.toBeInTheDocument();
  });

  it('sends the chosen count for that team', async () => {
    const onSetPlayerCount = renderPanel();
    const item = teamItem('Beer Necessities');

    await userEvent.click(
      within(item).getByRole('button', {
        name: /edit player count for beer necessities/i,
      }),
    );
    const input = within(item).getByRole('spinbutton', {
      name: /player count for beer necessities/i,
    });
    await userEvent.type(input, '5');
    await userEvent.click(
      within(item).getByRole('button', { name: /^save$/i }),
    );

    expect(onSetPlayerCount).toHaveBeenCalledWith(2, 5);
  });

  it('starts the editor on the current count', async () => {
    renderPanel();
    const item = teamItem('The Quizzards');

    await userEvent.click(
      within(item).getByRole('button', {
        name: /edit player count for the quizzards/i,
      }),
    );

    expect(
      within(item).getByRole('spinbutton', {
        name: /player count for the quizzards/i,
      }),
    ).toHaveValue(4);
  });

  it.each([['0'], ['21'], ['2.5']])('does not send %s', async (typed) => {
    const onSetPlayerCount = renderPanel();
    const item = teamItem('Beer Necessities');
    await userEvent.click(
      within(item).getByRole('button', {
        name: /edit player count for beer necessities/i,
      }),
    );
    await userEvent.type(
      within(item).getByRole('spinbutton', {
        name: /player count for beer necessities/i,
      }),
      typed,
    );

    expect(
      within(item).getByRole('button', { name: /^save$/i }),
    ).toBeDisabled();
    expect(onSetPlayerCount).not.toHaveBeenCalled();
  });

  it('closes the editor without sending on cancel', async () => {
    const onSetPlayerCount = renderPanel();
    const item = teamItem('The Quizzards');
    await userEvent.click(
      within(item).getByRole('button', {
        name: /edit player count for the quizzards/i,
      }),
    );

    await userEvent.click(
      within(item).getByRole('button', { name: /^cancel$/i }),
    );

    expect(onSetPlayerCount).not.toHaveBeenCalled();
    expect(within(item).queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});

describe('TeamsPanel joker rounds', () => {
  const JOKER_ROUNDS = [
    {
      roundId: 11,
      roundNumber: 2,
      title: 'Film',
      category: '',
      author: '',
    },
    {
      roundId: 12,
      roundNumber: 3,
      title: 'Sport',
      category: '',
      author: '',
    },
  ];
  const JOKER_TEAMS: AdminTeamView[] = [
    {
      ...TEAMS[0],
      joker: {
        roundId: 11,
        source: 'chosen',
        roundNumber: 2,
        roundTitle: 'Film',
      },
    },
    TEAMS[1],
  ];

  function renderPanel(jokerRounds = JOKER_ROUNDS) {
    const onSetJoker = vi.fn();
    render(
      <TeamsPanel
        teams={JOKER_TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={vi.fn()}
        onSetPlayerCount={vi.fn()}
        jokerRounds={jokerRounds}
        onSetJoker={onSetJoker}
      />,
    );
    return onSetJoker;
  }

  it('lets the quiz master pick a team’s joker round from the list', async () => {
    const onSetJoker = renderPanel();

    await userEvent.selectOptions(
      within(teamItem('Beer Necessities')).getByRole('combobox', {
        name: /joker round for beer necessities/i,
      }),
      'Round 3 — Sport',
    );

    expect(onSetJoker).toHaveBeenCalledWith(2, 12);
  });

  it('shows the team’s current joker selected, and nothing selected for a team without one', () => {
    renderPanel();

    expect(
      within(teamItem('The Quizzards')).getByRole('combobox', {
        name: /joker round for the quizzards/i,
      }),
    ).toHaveValue('11');
    expect(
      within(teamItem('Beer Necessities')).getByRole('combobox', {
        name: /joker round for beer necessities/i,
      }),
    ).toHaveValue('');
  });

  it('offers no list when no round can take a joker', () => {
    renderPanel([]);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('TeamsPanel', () => {
  it('asks for confirmation before kicking a team', async () => {
    const onKickTeam = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={onKickTeam}
        onSetPlayerCount={vi.fn()}
        jokerRounds={[]}
        onSetJoker={vi.fn()}
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

    expect(onKickTeam).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', {
      name: /kick beer necessities\?/i,
    });
    const confirmButton = within(dialog).getByRole('button', {
      name: /^kick$/i,
    });

    await userEvent.click(confirmButton);

    expect(onKickTeam).toHaveBeenCalledWith(2);
  });

  it('does not kick a team when the confirmation is cancelled', async () => {
    const onKickTeam = vi.fn();
    render(
      <TeamsPanel
        teams={TEAMS}
        showAnswerStatus={false}
        answeredTeamIds={[]}
        onKickTeam={onKickTeam}
        onSetPlayerCount={vi.fn()}
        jokerRounds={[]}
        onSetJoker={vi.fn()}
      />,
    );

    const disconnectedTeamItem = screen
      .getByText('Beer Necessities')
      .closest('li');
    const kickButton = within(disconnectedTeamItem as HTMLElement).getByRole(
      'button',
      {
        name: /^kick$/i,
      },
    );

    await userEvent.click(kickButton);
    const dialog = screen.getByRole('alertdialog', {
      name: /kick beer necessities\?/i,
    });
    const cancelButton = within(dialog).getByRole('button', {
      name: /^cancel$/i,
    });

    await userEvent.click(cancelButton);

    expect(onKickTeam).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('alertdialog', { name: /kick beer necessities\?/i }),
    ).not.toBeInTheDocument();
  });
});
