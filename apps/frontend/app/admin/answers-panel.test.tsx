import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AnswersUpdatedPayload, TeamView } from '@campus-pubquiz/types';
import { AnswersPanel } from '@/app/admin/answers-panel';

const TEAMS: TeamView[] = [
  { teamId: 1, teamName: 'The Quizzards', isConnected: true },
  { teamId: 2, teamName: 'Beer Necessities', isConnected: true },
];

function liveAnswers(
  overrides: Partial<AnswersUpdatedPayload> = {},
): AnswersUpdatedPayload {
  return {
    questionId: 101,
    question: {
      type: 'free_text',
      prompt: 'Capital of France?',
      points: 2,
      correctAnswer: 'Paris',
      roundTitle: 'Geography',
      roundNumber: 2,
      questionNumberInRound: 3,
      totalQuestionsInRound: 4,
    },
    answers: [
      {
        answerId: 41,
        teamId: 1,
        teamName: 'The Quizzards',
        value: 'Paris',
        pointsAwarded: 0,
        gradedAt: null,
      },
    ],
    ...overrides,
  };
}

describe('AnswersPanel', () => {
  it('shows the round, question position and correct answer', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText(/round 2 \(geography\)/i)).toHaveTextContent(
      'Q3 of 4',
    );
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByText(/correct answer: paris/i)).toBeInTheDocument();
  });

  it('formats sort/match answers and the correct answer as an arrow chain instead of raw pipes', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers({
          question: {
            type: 'sort',
            prompt: 'Order these planets from the sun outward.',
            points: 3,
            correctAnswer: 'Mercury|Venus|Earth',
            roundTitle: 'Space',
            roundNumber: 1,
            questionNumberInRound: 1,
            totalQuestionsInRound: 1,
          },
          answers: [
            {
              answerId: 41,
              teamId: 1,
              teamName: 'The Quizzards',
              value: 'Earth|Venus|Mercury',
              pointsAwarded: 0,
              gradedAt: new Date().toISOString(),
            },
          ],
        })}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Correct answer: Mercury → Venus → Earth'),
    ).toBeInTheDocument();
    expect(screen.getByText('Earth → Venus → Mercury')).toBeInTheDocument();
  });

  it('lists every team, even one that has not answered yet', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('No answer yet')).toBeInTheDocument();
  });

  it('dims the row and disables grading for a team that has not answered', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    const unansweredRow = screen.getByText('No answer yet').closest('li');
    expect(unansweredRow).toHaveClass('opacity-40');
    expect(
      screen.getByRole('button', {
        name: /grade beer necessities full points/i,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /grade beer necessities 0 points/i }),
    ).toBeDisabled();
  });

  it('does not dim a team that has answered', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    const answeredRow = screen.getByText('Paris').closest('li');
    expect(answeredRow).not.toHaveClass('opacity-40');
    expect(
      screen.getByRole('button', { name: /grade the quizzards full points/i }),
    ).toBeEnabled();
  });

  it('grades an answered team with the correct answerId and point value', async () => {
    const user = userEvent.setup();
    const onGrade = vi.fn();
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={onGrade}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /grade the quizzards full points/i }),
    );

    expect(onGrade).toHaveBeenCalledWith(41, 2);
  });

  it('shows the awarded grade as a disabled, checked button once graded', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers({
          answers: [
            {
              answerId: 41,
              teamId: 1,
              teamName: 'The Quizzards',
              value: 'Paris',
              pointsAwarded: 2,
              gradedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        })}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    const fullPointsButton = screen.getByRole('button', {
      name: /grade the quizzards full points/i,
    });
    expect(fullPointsButton).toHaveTextContent('✓ 2');
    expect(fullPointsButton).toBeDisabled();
  });

  it('omits the previous/next controls when no nav is given', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /previous question/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next question/i }),
    ).not.toBeInTheDocument();
  });

  it('shows nav controls and the grading position when nav is given', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
        nav={{ index: 1, total: 3, onPrevious, onNext }}
      />,
    );

    expect(screen.getByText(/grading 2 of 3/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /previous question/i }),
    );
    expect(onPrevious).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /next question/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('disables previous at the first question and next at the last question of the block', () => {
    const { rerender } = render(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
        nav={{ index: 0, total: 3, onPrevious: vi.fn(), onNext: vi.fn() }}
      />,
    );
    expect(
      screen.getByRole('button', { name: /previous question/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /next question/i }),
    ).toBeEnabled();

    rerender(
      <AnswersPanel
        liveAnswers={liveAnswers()}
        teams={TEAMS}
        onGrade={vi.fn()}
        nav={{ index: 2, total: 3, onPrevious: vi.fn(), onNext: vi.fn() }}
      />,
    );
    expect(
      screen.getByRole('button', { name: /previous question/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /next question/i }),
    ).toBeDisabled();
  });
});
