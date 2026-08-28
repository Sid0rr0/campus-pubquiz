import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { ShowdownRevealScreen } from '@/app/components/showdown-reveal-screen';

const TWO_TEAM_ROUND: ActiveShowdownView = {
  id: 900,
  question: 'How many people are in this room?',
  participants: [
    { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: true },
    { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: true },
  ],
};

describe('ShowdownRevealScreen', () => {
  it('shows the question and marks teams Answered once they have guessed, at step 0', () => {
    render(<ShowdownRevealScreen activeShowdown={TWO_TEAM_ROUND} step={0} />);

    expect(
      screen.getByText('How many people are in this room?'),
    ).toBeInTheDocument();
    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getAllByText('Answered')).toHaveLength(2);
    expect(screen.queryByText('ANSWER')).not.toBeInTheDocument();
  });

  it('shows waiting… for a team that has not guessed yet at step 0', () => {
    const round: ActiveShowdownView = {
      ...TWO_TEAM_ROUND,
      participants: [
        { ...TWO_TEAM_ROUND.participants[0], hasGuessed: false },
        TWO_TEAM_ROUND.participants[1],
      ],
    };
    render(<ShowdownRevealScreen activeShowdown={round} step={0} />);

    expect(screen.getAllByText('waiting…')).toHaveLength(1);
    expect(screen.getAllByText('Answered')).toHaveLength(1);
  });

  it("reveals the first team's guess at step 1; second team shows Answered since it has guessed but isn't revealed yet", () => {
    const round: ActiveShowdownView = {
      ...TWO_TEAM_ROUND,
      participants: [
        { ...TWO_TEAM_ROUND.participants[0], guess: '40' },
        TWO_TEAM_ROUND.participants[1],
      ],
    };
    render(<ShowdownRevealScreen activeShowdown={round} step={1} />);

    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText('Answered')).toHaveLength(1);
  });

  it('reveals both guesses at step 2, before the answer', () => {
    const round: ActiveShowdownView = {
      ...TWO_TEAM_ROUND,
      participants: [
        { ...TWO_TEAM_ROUND.participants[0], guess: '40' },
        { ...TWO_TEAM_ROUND.participants[1], guess: '50' },
      ],
    };
    render(<ShowdownRevealScreen activeShowdown={round} step={2} />);

    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.queryByText(/answer/i)).not.toBeInTheDocument();
  });

  it('reveals the answer and marks the winner at the final step', () => {
    const round: ActiveShowdownView = {
      id: 900,
      question: 'How many people are in this room?',
      participants: [
        { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: true, guess: '40' },
        { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: true, guess: '50' },
      ],
      answer: '42',
      winnerTeamId: 31,
      isTie: false,
    };
    render(<ShowdownRevealScreen activeShowdown={round} step={3} />);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('ANSWER')).toBeInTheDocument();
    expect(screen.queryByText(/sudden death/i)).not.toBeInTheDocument();
  });

  it('shows a sudden-death message when the round resolves as a tie', () => {
    const round: ActiveShowdownView = {
      id: 900,
      question: 'How many people are in this room?',
      participants: [
        { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: true, guess: '40' },
        { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: true, guess: '44' },
      ],
      answer: '42',
      winnerTeamId: null,
      isTie: true,
    };
    render(<ShowdownRevealScreen activeShowdown={round} step={3} />);

    expect(screen.getByText(/sudden death/i)).toBeInTheDocument();
  });
});
