import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  AnswersUpdatedPayload,
  QuizSummaryQuestion,
  QuizSummaryRound,
} from '@campus-pubquiz/types';
import { QuestionDetail } from '@/app/control/question-detail';

function roundWith(...questions: QuizSummaryQuestion[]): QuizSummaryRound[] {
  return [
    { title: 'Warm-up', breakAfter: false, questions: [] },
    { title: 'Geography', breakAfter: false, questions },
  ];
}

function renderDetail(
  questionId: number | null,
  rounds: QuizSummaryRound[],
  liveAnswers: AnswersUpdatedPayload | null = null,
  fallbackPrompt?: string,
) {
  render(
    <QuestionDetail
      questionId={questionId}
      rounds={rounds}
      liveAnswers={liveAnswers}
      fallbackQuestions={
        fallbackPrompt
          ? [
              {
                id: 99,
                type: 'free_text',
                prompt: fallbackPrompt,
                points: 1,
              },
            ]
          : []
      }
    />,
  );
}

describe('QuestionDetail', () => {
  it('shows the round line, prompt, correct answer and notes', () => {
    renderDetail(
      1,
      roundWith(
        {
          id: 1,
          type: 'free_text',
          prompt: 'Capital of France?',
          answer: 'Paris',
          notes: 'Accept "Paris, France".',
        },
        { id: 2, type: 'free_text', prompt: 'Capital of Spain?', answer: 'x' },
      ),
    );

    expect(screen.getByText(/round 2 \(geography\)/i)).toHaveTextContent(
      'Q1 of 2',
    );
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByText(/correct answer: paris/i)).toBeInTheDocument();
    expect(screen.getByText('Accept "Paris, France".')).toBeInTheDocument();
  });

  it('lists multiple choice choices and highlights the correct one', () => {
    renderDetail(
      1,
      roundWith({
        id: 1,
        type: 'multiple_choice',
        prompt: 'Pick one',
        options: ['Red', 'Green', 'Blue'],
        answer: 'Green',
      }),
    );

    const list = screen.getByRole('list', { name: /choices/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('Green')).toHaveAttribute(
      'data-correct',
      'true',
    );
    expect(within(list).getByText('Red')).not.toHaveAttribute('data-correct');
  });

  it('lists the items of a sort question', () => {
    renderDetail(
      1,
      roundWith({
        id: 1,
        type: 'sort',
        prompt: 'Order them',
        options: ['Venus', 'Earth', 'Mercury'],
        answer: 'Mercury|Venus|Earth',
      }),
    );

    const list = screen.getByRole('list', { name: /items/i });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Venus', 'Earth', 'Mercury']);
  });

  it('lists the left items and the match targets of a match question', () => {
    renderDetail(
      1,
      roundWith({
        id: 1,
        type: 'match',
        prompt: 'Pair them',
        options: ['arthur', 'captain america'],
        matchTargets: ['shield', 'excalibur'],
        answer: 'excalibur|shield',
      }),
    );

    expect(
      within(screen.getByRole('list', { name: /left items/i }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['arthur', 'captain america']);
    expect(
      within(screen.getByRole('list', { name: /match targets/i }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['shield', 'excalibur']);
  });

  it('shows no options section for a type without options', () => {
    renderDetail(
      1,
      roundWith({ id: 1, type: 'number', prompt: 'How many?', answer: '7' }),
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('falls back to the live answers context when the round list has not loaded', () => {
    renderDetail(5, [], {
      questionId: 5,
      question: {
        type: 'multiple_choice',
        prompt: 'Name a fruit',
        options: ['Apple', 'Pear'],
        points: 1,
        correctAnswer: 'Pear',
        roundTitle: 'Fruit & Veg',
        roundNumber: 2,
        questionNumberInRound: 3,
        totalQuestionsInRound: 4,
      },
      answers: [],
    });

    expect(screen.getByText(/round 2 \(fruit & veg\)/i)).toHaveTextContent(
      'Q3 of 4',
    );
    expect(screen.getByText('Pear', { selector: 'li' })).toHaveAttribute(
      'data-correct',
      'true',
    );
  });

  it('shows just the prompt from the live snapshot while nothing else has loaded', () => {
    renderDetail(99, [], null, 'Loading gap prompt');

    expect(screen.getByText('Loading gap prompt')).toBeInTheDocument();
  });
});
