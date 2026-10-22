import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoundsList } from '@/app/components/rounds-list';

const repeatedPrompt =
  'Name both the titles and artists of the two songs. (Half point for each)';

describe('RoundsList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every question when a round repeats the same prompt, without a duplicate-key warning', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <RoundsList
        rounds={[
          {
            title: 'Music',
            breakAfter: false,
            questions: [
              { type: 'free_text', prompt: repeatedPrompt, answer: 'A / B' },
              { type: 'free_text', prompt: repeatedPrompt, answer: 'C / D' },
            ],
          },
          {
            title: 'Music',
            breakAfter: false,
            questions: [
              { type: 'free_text', prompt: repeatedPrompt, answer: 'E / F' },
            ],
          },
        ]}
      />,
    );

    expect(screen.getAllByText(/Name both the titles/)).toHaveLength(3);
    expect(
      consoleError.mock.calls.some((args) =>
        args.some((arg) => String(arg).includes('same key')),
      ),
    ).toBe(false);
  });
});
