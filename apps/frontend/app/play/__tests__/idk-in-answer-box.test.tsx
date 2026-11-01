import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IDK_ANSWER_VALUE, type QuestionView } from '@campus-pubquiz/types';
import { AnswerForm } from '@/app/play/answer-form';

describe('a question answered with "I don\'t know"', () => {
  it.each(['free_text', 'number'] as const)(
    'leaves the %s answer box empty and marks the button as chosen',
    (type) => {
      render(
        <AnswerForm
          question={{ id: 1, type, prompt: 'Q?', points: 1 } as QuestionView}
          initialValue={IDK_ANSWER_VALUE}
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByLabelText('Your answer')).toHaveValue(
        type === 'number' ? null : '',
      );
      expect(
        screen.getByRole('button', { name: /i don't know/i }),
      ).toHaveAttribute('aria-pressed', 'true');
    },
  );
});
