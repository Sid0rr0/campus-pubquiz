import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { ShowdownPanel } from '@/app/admin/showdown-panel';

describe('ShowdownPanel', () => {
  it('is hidden while ineligible (e.g. grading still in progress) even with a tie', () => {
    render(
      <ShowdownPanel
        isEligible={false}
        activeShowdown={null}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.queryByText(/showdown tiebreaker/i)).not.toBeInTheDocument();
  });

  it('is hidden while eligible when nobody is tied for 1st', () => {
    render(
      <ShowdownPanel
        isEligible={true}
        activeShowdown={null}
        tiedTeamNames={[]}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.queryByText(/showdown tiebreaker/i)).not.toBeInTheDocument();
  });

  it('shows the trigger once two or more teams are tied for 1st, and opens the create modal on click', async () => {
    const onCreateShowdownRound = vi.fn();
    render(
      <ShowdownPanel
        isEligible={true}
        activeShowdown={null}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={onCreateShowdownRound}
      />,
    );

    expect(screen.getByText(/tied for 1st: team a, team b/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/question/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /create showdown/i }),
    );
    await userEvent.type(
      screen.getByLabelText('Question'),
      'How many people are in this room?',
    );
    await userEvent.type(screen.getByLabelText(/answer/i), '42');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onCreateShowdownRound).toHaveBeenCalledWith(
      'How many people are in this room?',
      '42',
      1,
    );
  });

  it('disables the save button until a question and a numeric answer are filled in', async () => {
    render(
      <ShowdownPanel
        isEligible={true}
        activeShowdown={null}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /create showdown/i }),
    );
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Question'), 'How many?');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/answer/i), '10');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('shows live guess status without a trigger once a round is active and not tied', () => {
    const activeShowdown: ActiveShowdownView = {
      id: 900,
      question: 'How many?',
      participants: [
        { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: true },
        { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: false },
      ],
    };
    render(
      <ShowdownPanel
        isEligible={true}
        activeShowdown={activeShowdown}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create showdown/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ask another question/i }),
    ).not.toBeInTheDocument();
  });

  it('offers "Ask another question" once a round resolves as a tie, opening the modal pre-labeled for it', async () => {
    const onCreateShowdownRound = vi.fn();
    const activeShowdown: ActiveShowdownView = {
      id: 900,
      question: 'How many?',
      participants: [
        { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: true, guess: '40' },
        { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: true, guess: '44' },
      ],
      answer: '42',
      winnerTeamId: null,
      isTie: true,
    };
    render(
      <ShowdownPanel
        isEligible={true}
        activeShowdown={activeShowdown}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={onCreateShowdownRound}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /ask another question/i }),
    );
    await userEvent.type(screen.getByLabelText('Question'), 'Round 2');
    await userEvent.type(screen.getByLabelText(/answer/i), '7');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onCreateShowdownRound).toHaveBeenCalledWith('Round 2', '7', 1);
  });
});
