import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnswersPanel } from '@/app/control/answers-panel';

const liveAnswers = {
  questionId: 101,
  question: {
    type: 'clues' as const,
    prompt: 'Who am I?',
    points: 2.5,
    correctAnswer: 'Marie Curie',
    roundTitle: 'People',
    roundNumber: 1,
    questionNumberInRound: 1,
    totalQuestionsInRound: 1,
  },
  answers: [
    {
      answerId: 41,
      teamId: 1,
      teamName: 'The Quizzards',
      value: 'Curie',
      pointsAwarded: 0,
      gradedAt: null,
      gradingState: 'ungraded' as const,
      powerUps: [],
      verdict: null,
      clue: 3,
    },
  ],
};

describe('AnswersPanel — a Clue question', () => {
  it('shows the clue each answer was locked in on', () => {
    render(
      <AnswersPanel
        liveAnswers={liveAnswers}
        teams={[{ teamId: 1, teamName: 'The Quizzards', isConnected: true }]}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText('Clue 3')).toBeInTheDocument();
  });

  it('offers no half grade and grades right at the answer clue value', async () => {
    const onGrade = vi.fn();
    render(
      <AnswersPanel
        liveAnswers={liveAnswers}
        teams={[{ teamId: 1, teamName: 'The Quizzards', isConnected: true }]}
        onGrade={onGrade}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /half points/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Grade The Quizzards full points' }),
    );
    expect(onGrade).toHaveBeenCalledWith(41, 1.5);
  });
});
