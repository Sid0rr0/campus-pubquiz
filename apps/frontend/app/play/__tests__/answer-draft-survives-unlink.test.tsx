import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuestionView } from '@campus-pubquiz/types';
import { QuestionBrowser } from '@/app/play/question-browser';

const QUESTION = {
  id: 1,
  type: 'free_text',
  prompt: 'Capital of France?',
  points: 1,
} as QuestionView;

function browser(isAnswerable: boolean) {
  return (
    <QuestionBrowser
      mode="answering"
      selected={{
        question: QUESTION,
        answer: undefined,
        clue: null,
        points: null,
        verdict: null,
        jokerExtra: null,
        isDoubledRound: false,
        purchases: [],
        isAnsweringNow: isAnswerable,
      }}
      pickerRounds={[]}
      totalPickerSlots={0}
      isQuickfireMode={false}
      myAnswers={{}}
      onSelectQuestion={vi.fn()}
      onSubmitAnswer={vi.fn()}
    />
  );
}

describe('an answer being typed while the phone is unlinked', () => {
  it('is still in the box once the phone is linked again', async () => {
    const { rerender } = render(browser(true));
    await userEvent.type(screen.getByLabelText('Your answer'), 'Par');

    rerender(browser(false));
    expect(screen.getByLabelText('Your answer')).not.toBeVisible();

    rerender(browser(true));
    expect(screen.getByLabelText('Your answer')).toHaveValue('Par');
  });
});
