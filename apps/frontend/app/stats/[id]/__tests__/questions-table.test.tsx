import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionDetailQuestionRow } from '@campus-pubquiz/types';
import { QuestionsTable } from '@/app/stats/[id]/questions-table';

function question(
  overrides: Partial<SessionDetailQuestionRow>,
): SessionDetailQuestionRow {
  return {
    questionId: 1,
    roundTitle: 'Music',
    orderIndex: 0,
    prompt: 'Name the band',
    type: 'free_text',
    answer: 'Queen',
    points: 2,
    answeredCount: 4,
    correctCount: 3,
    correctRate: 0.75,
    fastestResponseMs: null,
    ...overrides,
  };
}

describe('QuestionsTable correct rate column', () => {
  it('shows the rate as a percentage', () => {
    render(
      <QuestionsTable
        questions={[question({ correctRate: 0.75 })]}
        allCorrectQuestionIds={[]}
        noneCorrectQuestionIds={[]}
      />,
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows a dash for a question with no rate, and still lists its counts', () => {
    render(
      <QuestionsTable
        questions={[
          question({
            prompt: 'How tall is the tower?',
            type: 'closest_guess',
            answeredCount: 5,
            correctCount: 1,
            correctRate: null,
          }),
        ]}
        allCorrectQuestionIds={[]}
        noneCorrectQuestionIds={[]}
      />,
    );

    const row = screen.getByText('How tall is the tower?').closest('tr')!;
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).queryByText('0%')).not.toBeInTheDocument();
  });
});

describe('QuestionsTable answer column', () => {
  it('shows each question with its correct answer, so repeated prompts are told apart', () => {
    render(
      <QuestionsTable
        questions={[
          question({ questionId: 1, answer: 'Queen' }),
          question({ questionId: 2, answer: 'ABBA' }),
        ]}
        allCorrectQuestionIds={[]}
        noneCorrectQuestionIds={[]}
      />,
    );

    const [first, second] = screen.getAllByText('Name the band');
    expect(within(first.closest('tr')!).getByText('Queen')).toBeInTheDocument();
    expect(within(second.closest('tr')!).getByText('ABBA')).toBeInTheDocument();
  });
});
