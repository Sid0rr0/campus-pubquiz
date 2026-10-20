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
