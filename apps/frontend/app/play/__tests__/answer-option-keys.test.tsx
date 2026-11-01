import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnswerForm } from '@/app/play/answer-form';

describe('AnswerForm — the options', () => {
  it('keeps two options with the same text apart', () => {
    const consoleError = vi.spyOn(console, 'error');

    render(
      <AnswerForm
        question={
          {
            id: 1,
            type: 'multiple_choice',
            options: ['Same', 'Same', 'Other'],
          } as never
        }
        initialValue=""
        isKahootMode={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: /Same/ })).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
