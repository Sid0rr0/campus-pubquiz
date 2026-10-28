import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    breakAfter: true,
    questions: [{ id: 3, type: 'free_text', prompt: 'Sport?', answer: 'Golf' }],
  },
];

function renderPanel() {
  render(
    <QuestionBrowserPanel
      rounds={ROUNDS}
      currentRoundIndex={0}
      activeBlockStartIndex={0}
      selectedQuestionId={null}
      indicators={{
        titleCardRoundIndex: null,
        breakRoundIndex: null,
        onDisplayQuestionId: null,
      }}
      onSelectQuestion={() => {}}
      ungradedQuestionIds={[]}
    />,
  );
}

describe('QuestionBrowserPanel notes', () => {
  it("shows a round's note next to its title, and none for a round without one", () => {
    renderPanel();

    expect(
      screen.getByText(/Play the jingle first\./, { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Round note/i)).toHaveLength(1);
  });

  it('leaves the question notes to the detail column', () => {
    renderPanel();

    expect(screen.queryByText('Accept "Abba".')).not.toBeInTheDocument();
  });
});
