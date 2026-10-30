import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MatchAnswer } from '@/app/play/match-answer';
import { SortAnswer } from '@/app/play/sort-answer';

const pin = { kind: 'pin_one', item: 'Cat', position: 0 } as const;

describe('SortAnswer with a pin', () => {
  it('puts the pinned item in its place, locks it, and submits it there', async () => {
    const onSubmit = vi.fn();
    render(
      <SortAnswer
        options={['Horse', 'Mouse', 'Cat']}
        pin={pin}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText('Drag to reorder Cat')).toBeDisabled();
    expect(screen.getByLabelText('Move Cat down')).toBeDisabled();

    await userEvent.click(screen.getByLabelText('Move Horse down'));
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith('Cat|Mouse|Horse');
  });

  it('moves a neighbour past the pinned item without moving the pin', async () => {
    const onSubmit = vi.fn();
    render(
      <SortAnswer
        options={['Horse', 'Cat', 'Mouse']}
        pin={{ kind: 'pin_one', item: 'Cat', position: 1 }}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByLabelText('Move Horse down'));
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith('Mouse|Cat|Horse');
  });
});

describe('MatchAnswer with a pin', () => {
  it('starts with the pinned right-hand item beside its left item and locks it', () => {
    render(
      <MatchAnswer
        leftItems={['France', 'Italy']}
        rightItems={['Rome', 'Paris']}
        pin={{ kind: 'pin_one', item: 'Paris', position: 0 }}
        onSubmit={vi.fn()}
      />,
    );

    const handles = screen.getAllByLabelText(/Drag to reorder/);
    expect(handles.map((h) => h.getAttribute('aria-label'))).toEqual([
      'Drag to reorder Paris',
      'Drag to reorder Rome',
    ]);
    expect(handles[0]).toBeDisabled();
    expect(handles[1]).toBeEnabled();
  });
});
