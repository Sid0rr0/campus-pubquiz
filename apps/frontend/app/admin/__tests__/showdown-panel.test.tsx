import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { ShowdownPanel } from '@/app/admin/showdown-panel';

describe('ShowdownPanel', () => {
  it('is hidden outside ended status even with a tie', () => {
    render(
      <ShowdownPanel
        progressStatus="question_open"
        activeShowdown={null}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.queryByText(/showdown tiebreaker/i)).not.toBeInTheDocument();
  });

  it('is hidden at ended status when nobody is tied for 1st', () => {
    render(
      <ShowdownPanel
        progressStatus="ended"
        activeShowdown={null}
        tiedTeamNames={[]}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.queryByText(/showdown tiebreaker/i)).not.toBeInTheDocument();
  });

  it('shows the create form once two or more teams are tied for 1st', async () => {
    const onCreateShowdownRound = vi.fn();
    render(
      <ShowdownPanel
        progressStatus="ended"
        activeShowdown={null}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={onCreateShowdownRound}
      />,
    );

    expect(screen.getByText(/tied for 1st: team a, team b/i)).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText(/question/i),
      'How many people are in this room?',
    );
    await userEvent.type(screen.getByLabelText(/answer/i), '42');
    await userEvent.click(
      screen.getByRole('button', { name: /start showdown/i }),
    );

    expect(onCreateShowdownRound).toHaveBeenCalledWith(
      'How many people are in this room?',
      '42',
      5,
    );
  });

  it('disables the submit button until a question and a numeric answer are filled in', async () => {
    render(
      <ShowdownPanel
        progressStatus="ended"
        activeShowdown={null}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /start showdown/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/question/i), 'How many?');
    expect(screen.getByRole('button', { name: /start showdown/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/answer/i), '10');
    expect(screen.getByRole('button', { name: /start showdown/i })).toBeEnabled();
  });

  it('shows live guess status without the create form once a round is active', () => {
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
        progressStatus="ended"
        activeShowdown={activeShowdown}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={vi.fn()}
      />,
    );

    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
    expect(screen.queryByLabelText(/question/i)).not.toBeInTheDocument();
  });

  it('offers "Ask another question" once a round resolves as a tie', async () => {
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
        progressStatus="ended"
        activeShowdown={activeShowdown}
        tiedTeamNames={['Team A', 'Team B']}
        onCreateShowdownRound={onCreateShowdownRound}
      />,
    );

    expect(
      screen.getByRole('button', { name: /ask another question/i }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/question/i), 'Round 2');
    await userEvent.type(screen.getByLabelText(/answer/i), '7');
    await userEvent.click(
      screen.getByRole('button', { name: /ask another question/i }),
    );

    expect(onCreateShowdownRound).toHaveBeenCalledWith('Round 2', '7', 5);
  });
});
