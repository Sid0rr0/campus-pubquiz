import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  AnswersUpdatedPayload,
  QuizSummaryRound,
} from '@campus-pubquiz/types';
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

function renderPanel(
  selectedQuestionId: number | null,
  liveAnswers: AnswersUpdatedPayload | null = null,
) {
  render(
    <QuestionBrowserPanel
      rounds={ROUNDS}
      currentRoundIndex={0}
      activeBlockStartIndex={0}
      selectedQuestionId={selectedQuestionId}
      indicators={{
        titleCardRoundIndex: null,
        breakRoundIndex: null,
        onDisplayQuestionId: null,
      }}
      onSelectQuestion={() => {}}
      liveAnswers={liveAnswers}
      teams={[]}
      onGrade={() => {}}
      fallbackQuestions={[]}
      ungradedQuestionIds={[]}
    />,
  );
}

describe('QuestionBrowserPanel notes', () => {
  it('shows the notes of the selected question', () => {
    renderPanel(1);

    expect(screen.getByText('Accept "Abba".')).toBeInTheDocument();
  });

  it('shows the notes under the correct answer, above the answers list', () => {
    renderPanel(1, {
      questionId: 1,
      question: {
        type: 'free_text',
        prompt: 'Band?',
        points: 1,
        correctAnswer: 'ABBA',
        roundTitle: 'Music',
        roundNumber: 1,
        questionNumberInRound: 1,
        totalQuestionsInRound: 2,
      },
      answers: [],
    });

    const notes = screen.getByText('Accept "Abba".');
    const correct = screen.getByText(/Correct answer/);
    expect(
      correct.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows no notes block for a selected question without notes', () => {
    renderPanel(2);

    expect(screen.queryByText('Accept "Abba".')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Notes$/)).not.toBeInTheDocument();
  });

  it("shows a round's note under its heading, and none for a round without one", () => {
    renderPanel(null);

    expect(
      screen.getByText(/Play the jingle first\./, { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Round note/i)).toHaveLength(1);
  });
});
