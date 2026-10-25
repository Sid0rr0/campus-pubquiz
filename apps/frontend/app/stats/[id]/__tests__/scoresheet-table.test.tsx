import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type {
  SessionDetailQuestionRow,
  SessionDetailRoundRow,
  SessionDetailScoresheetCell,
  SessionDetailStandingRow,
} from '@campus-pubquiz/types';
import { ScoresheetTable } from '@/app/stats/[id]/scoresheet-table';

function team(
  teamId: number,
  teamName: string,
  overrides: Partial<SessionDetailStandingRow> = {},
): SessionDetailStandingRow {
  return {
    rank: teamId,
    rankTo: teamId,
    hasLeft: false,
    isWinner: teamId === 1,
    teamId,
    teamName,
    playerCount: null,
    answerPoints: 0,
    bonusPoints: 0,
    total: 0,
    correctCount: 0,
    avgResponseMs: null,
    ...overrides,
  };
}

function round(roundId: number, title: string): SessionDetailRoundRow {
  return {
    roundId,
    title,
    category: null,
    rating: null,
    correctRate: null,
    pointsPercent: 0,
    avgResponseMs: null,
  };
}

function question(
  questionId: number,
  roundId: number,
  answer: string,
): SessionDetailQuestionRow {
  return {
    questionId,
    roundId,
    roundTitle: '',
    orderIndex: 0,
    prompt: 'Name this song',
    type: 'free_text',
    answer,
    points: 2,
    answeredCount: 0,
    correctCount: 0,
    correctRate: null,
    fastestResponseMs: null,
  };
}

function cell(
  teamId: number,
  questionId: number,
  verdict: SessionDetailScoresheetCell['verdict'],
  pointsAwarded: number,
  answer = 'Their answer',
): SessionDetailScoresheetCell {
  return { teamId, questionId, verdict, pointsAwarded, isJoker: false, answer };
}

const ROUNDS = [round(100, 'Music'), round(200, 'Films')];
const QUESTIONS = [
  question(1, 100, 'Bohemian Rhapsody'),
  question(2, 100, 'Africa'),
  question(3, 200, 'Jaws'),
];

function renderScoresheet(
  standings: SessionDetailStandingRow[],
  scoresheet: SessionDetailScoresheetCell[],
) {
  render(
    <ScoresheetTable
      standings={standings}
      rounds={ROUNDS}
      questions={QUESTIONS}
      scoresheet={scoresheet}
    />,
  );
}

function rowOf(teamName: string): HTMLElement {
  return screen.getByText(teamName).closest('tr')!;
}

function teamOrder(): string[] {
  return screen
    .getAllByRole('row')
    .slice(2)
    .map((row) => within(row).getAllByRole('cell')[1].textContent ?? '');
}

describe('ScoresheetTable', () => {
  it('groups the question columns by round, each header naming its prompt and answer', () => {
    renderScoresheet([team(1, 'Alpha')], []);

    expect(screen.getByText('Round 1')).toHaveAttribute('title', 'Music');
    expect(screen.getByText('Round 2')).toHaveAttribute('title', 'Films');
    const firstQuestions = screen.getAllByText('Q1');
    expect(firstQuestions[0]).toHaveAttribute(
      'title',
      'Name this song\nAnswer: Bohemian Rhapsody',
    );
    expect(firstQuestions[1]).toHaveAttribute(
      'title',
      'Name this song\nAnswer: Jaws',
    );
    expect(screen.getByText('Q2')).toHaveAttribute(
      'title',
      'Name this song\nAnswer: Africa',
    );
  });

  it('draws a border before each later round and before the totals', () => {
    renderScoresheet([team(1, 'Alpha')], []);

    const border = 'border-l';
    expect(screen.getByText('Round 1').closest('th')).not.toHaveClass(border);
    expect(screen.getByText('Round 2').closest('th')).toHaveClass(border);
    const cells = within(rowOf('Alpha')).getAllByRole('cell');
    // Rank, Team, R1 Q1, R1 Q2, R2 Q1, Bonus, Total.
    expect(cells.map((c) => c.classList.contains(border))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      false,
    ]);
  });

  it('shows points coloured by verdict, a dash for no answer and a muted ? while ungraded', () => {
    renderScoresheet(
      [team(1, 'Alpha', { bonusPoints: 3, total: 6 })],
      [
        cell(1, 1, 'correct', 2, 'Bohemian Rhapsody'),
        cell(1, 2, 'partial', 1),
        cell(1, 3, null, 0, 'Jaw'),
      ],
    );

    const cells = within(rowOf('Alpha')).getAllByRole('cell');
    // Rank, Team, Q1, Q2, Q3, Bonus, Total.
    expect(cells.map((c) => c.textContent)).toEqual([
      '1.',
      'Alpha',
      '2',
      '1',
      '?',
      '3',
      '6',
    ]);
    expect(cells[2]).toHaveClass('bg-green/25');
    expect(within(cells[2]).getByText('2')).toHaveAttribute(
      'title',
      'Bohemian Rhapsody',
    );
    expect(cells[3]).toHaveClass('bg-yellow/35');
    expect(cells[4].className).not.toMatch(/bg-/);
    expect(within(cells[4]).getByText('?')).toHaveAttribute('title', 'Jaw');
  });

  it('marks the cells of a team’s joker round with the doubled points', () => {
    renderScoresheet(
      [team(1, 'Alpha', { total: 5 })],
      [
        { ...cell(1, 1, 'correct', 4), isJoker: true },
        { ...cell(1, 2, 'incorrect', 0), isJoker: true },
        cell(1, 3, 'correct', 1),
      ],
    );

    const cells = within(rowOf('Alpha')).getAllByRole('cell');
    // Rank, Team, Q1, Q2, Q3, Bonus, Total.
    expect(cells[2]).toHaveTextContent('4');
    expect(within(cells[2]).getByLabelText('Joker round')).toBeInTheDocument();
    expect(within(cells[3]).getByLabelText('Joker round')).toBeInTheDocument();
    expect(within(cells[4]).queryByLabelText('Joker round')).toBeNull();
  });

  it('shows a dash for a question the team never answered', () => {
    renderScoresheet([team(1, 'Alpha')], [cell(1, 1, 'incorrect', 0)]);

    const cells = within(rowOf('Alpha')).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('0');
    expect(cells[3]).toHaveTextContent('—');
    expect(cells[4]).toHaveTextContent('—');
  });

  it('lists a team that left, greyed out', () => {
    renderScoresheet(
      [
        team(1, 'Alpha'),
        team(2, 'Gone', { rank: null, rankTo: null, hasLeft: true }),
      ],
      [cell(2, 1, 'correct', 2)],
    );

    const row = rowOf('Gone');
    expect(row).toHaveClass('text-foreground/50');
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('left');
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('2');
  });

  it('keeps the server order until a question column is sorted', async () => {
    const user = userEvent.setup();
    renderScoresheet(
      [team(1, 'Alpha'), team(2, 'Bravo'), team(3, 'Charlie')],
      [cell(1, 2, 'incorrect', 0), cell(2, 2, 'correct', 2)],
    );

    expect(teamOrder()).toEqual(['Alpha', 'Bravo', 'Charlie']);

    await user.click(screen.getByRole('button', { name: 'Q2' }));
    const ascending = teamOrder();
    await user.click(screen.getByRole('button', { name: 'Q2' }));
    const descending = teamOrder();

    // Charlie never answered, so it sorts below every scored answer.
    expect([ascending, descending]).toContainEqual([
      'Bravo',
      'Alpha',
      'Charlie',
    ]);
    expect([ascending, descending]).toContainEqual([
      'Charlie',
      'Alpha',
      'Bravo',
    ]);
  });

  it('says so when no team joined', () => {
    renderScoresheet([], []);

    expect(
      screen.getByText('No teams joined this session.'),
    ).toBeInTheDocument();
  });
});
