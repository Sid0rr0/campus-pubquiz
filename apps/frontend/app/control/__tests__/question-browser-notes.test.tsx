import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuizSummaryRound } from '@campus-pubquiz/types';
import { QuestionBrowserPanel } from '@/app/control/question-browser-panel';

const ROUNDS: QuizSummaryRound[] = [
  {
    title: 'Music',
    note: 'Play the jingle first.\nThen read the rules.',
    breakAfter: false,
    questions: [
      {
        id: 1,
        type: 'free_text',
        prompt: 'Band?',
        answer: 'ABBA',
        notes: 'Accept "Abba".',
      },
      { id: 2, type: 'free_text', prompt: 'Song?', answer: 'Waterloo' },
    ],
  },
  {
    title: 'Sport',
    breakAfter: false,
    breakNumber: 1,
    isFinalBreak: true,
    questions: [{ id: 3, type: 'free_text', prompt: 'Sport?', answer: 'Golf' }],
  },
];

function renderPanel(onSelect = vi.fn()) {
  render(
    <QuestionBrowserPanel
      rounds={ROUNDS}
      currentRoundIndex={0}
      activeBlockStartIndex={0}
      selected={null}
      indicators={{
        titleCardRoundIndex: null,
        breakRoundIndex: null,
        onDisplayQuestionId: null,
      }}
      onSelect={onSelect}
      ungradedQuestionIds={[]}
    />,
  );
}

describe('QuestionBrowserPanel notes', () => {
  it('leaves the Round note and the question notes to the detail column', () => {
    renderPanel();

    expect(screen.queryByText(/Round note/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Play the jingle/)).not.toBeInTheDocument();
    expect(screen.queryByText('Accept "Abba".')).not.toBeInTheDocument();
  });
});

describe('QuestionBrowserPanel markers', () => {
  it("shows a B marker wherever the round has break fields, including the last round's", () => {
    renderPanel();

    expect(
      screen.getAllByRole('button', { name: /show break after/i }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /show break after sport/i }),
    ).toBeInTheDocument();
  });

  it('selects a title card, a break and a question when their markers are clicked', async () => {
    const onSelect = vi.fn();
    renderPanel(onSelect);

    await userEvent.click(
      screen.getByRole('button', { name: /show title card of music/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /show break after sport/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /grade question 2 of music/i }),
    );

    expect(onSelect.mock.calls).toEqual([
      [{ kind: 'title', roundIndex: 0 }],
      [{ kind: 'break', roundIndex: 1 }],
      [{ kind: 'question', questionId: 2 }],
    ]);
  });
});
