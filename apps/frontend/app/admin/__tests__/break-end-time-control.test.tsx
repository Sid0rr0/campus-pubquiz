import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BreakEndTimeControl } from '@/app/admin/break-end-time-control';

describe('BreakEndTimeControl', () => {
  it('is hidden outside a break status when not on the last question before a break', () => {
    render(
      <BreakEndTimeControl
        progressStatus="question_open"
        breakEndsAt={null}
        onSetBreakEndTime={vi.fn()}
        isLastQuestionBeforeBreak={false}
      />,
    );

    expect(screen.queryByText(/break ends at/i)).not.toBeInTheDocument();
  });

  it('is visible and settable while on the last question before a break', async () => {
    const onSetBreakEndTime = vi.fn();
    render(
      <BreakEndTimeControl
        progressStatus="locking"
        breakEndsAt={null}
        onSetBreakEndTime={onSetBreakEndTime}
        isLastQuestionBeforeBreak={true}
      />,
    );

    expect(screen.getByText(/break ends at/i)).toBeInTheDocument();
    expect(screen.getByText(/sets the upcoming break/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/break ends at/i), '2145');
    await userEvent.click(screen.getByRole('button', { name: /^set$/i }));

    expect(onSetBreakEndTime).toHaveBeenCalledWith(expect.any(Number));
  });

  it('stays visible during the break statuses without the pre-break hint, regardless of the flag', () => {
    render(
      <BreakEndTimeControl
        progressStatus="break_intro"
        breakEndsAt={1_700_000_000_000}
        onSetBreakEndTime={vi.fn()}
        isLastQuestionBeforeBreak={false}
      />,
    );

    expect(screen.getByText(/break ends at/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/sets the upcoming break/i),
    ).not.toBeInTheDocument();
  });
});
