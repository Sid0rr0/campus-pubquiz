import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuizOutline } from '@/app/quizzes/[id]/quiz-outline';
import { makeQuestion, makeRound } from '@/app/quizzes/[id]/quiz-draft-state';
import { questionAnchorId } from '@/app/quizzes/[id]/quiz-question-editor';
import { roundAnchorId } from '@/app/quizzes/[id]/quiz-round-editor';

/** Questions get `dbId`s counting up from `firstDbId`, as saved questions have. */
function roundWithQuestions(
  id: string,
  title: string,
  prompts: string[],
  firstDbId = 1,
): ReturnType<typeof makeRound> {
  return {
    ...makeRound(id, title),
    questions: prompts.map((prompt, index) => ({
      ...makeQuestion(`${id}-${prompt}`),
      dbId: firstDbId + index,
      prompt,
    })),
  };
}

function liveEdit(
  currentRoundIndex: number,
  openedQuestionIds: number[] = [],
  hasCurrentBlockStartedLocking = false,
) {
  return {
    openedQuestionIds,
    currentRoundIndex,
    hasCurrentBlockStartedLocking,
  };
}

describe('QuizOutline', () => {
  it('renders nothing when there are no rounds', () => {
    const { container } = render(
      <QuizOutline
        rounds={[]}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('lists round titles and each question prompt with drag handles', () => {
    const rounds = [
      roundWithQuestions('round-1', 'General Knowledge', [
        'What is the capital of France?',
      ]),
    ];

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(screen.getByText(/1\. General Knowledge/)).toBeInTheDocument();
    expect(
      screen.getByText('What is the capital of France?'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder round 1, General Knowledge',
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder question 1, What is the capital of France?',
      }),
    ).toBeEnabled();
  });

  it('truncates a long question prompt to a short preview', () => {
    const longPrompt =
      'This is a very long question prompt that should be truncated in the outline view because it takes up too much space';
    const rounds = [roundWithQuestions('round-1', 'Round 1', [longPrompt])];

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(screen.queryByText(longPrompt)).not.toBeInTheDocument();
    expect(screen.getByText(`${longPrompt.slice(0, 42)}…`)).toBeInTheDocument();
  });

  it('shows a placeholder label for an untitled round and an empty question prompt', () => {
    const rounds = [roundWithQuestions('round-1', '', [''])];

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(screen.getByText(/1\. Untitled round/)).toBeInTheDocument();
    expect(screen.getByText('Untitled question')).toBeInTheDocument();
  });

  it('shows a break marker under a round whose breakAfter is set', () => {
    const rounds = [
      roundWithQuestions('round-1', 'Round 1', ['Question 1']),
      {
        ...roundWithQuestions('round-2', 'Round 2', ['Question 2']),
        breakAfter: true,
      },
      roundWithQuestions('round-3', 'Round 3', ['Question 3']),
    ];

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Break after this round')).toHaveLength(2);
  });

  it('always shows a break marker under the last round, even when its breakAfter is unset', () => {
    const rounds = [
      roundWithQuestions('round-1', 'Round 1', ['Question 1']),
      roundWithQuestions('round-2', 'Round 2', ['Question 2']),
    ];

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Break after this round')).toHaveLength(1);
  });

  it('scrolls the matching round card into view when its title is clicked', async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    const rounds = [
      roundWithQuestions('round-1', 'General Knowledge', ['Question 1']),
    ];
    const target = document.createElement('div');
    target.id = roundAnchorId('round-1');
    document.body.appendChild(target);

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Jump to round 1, General Knowledge',
      }),
    );

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    target.remove();
  });

  it('scrolls the matching question card into view when its preview is clicked', async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    const rounds = [
      roundWithQuestions('round-1', 'General Knowledge', [
        'What is the capital of France?',
      ]),
    ];
    const target = document.createElement('div');
    target.id = questionAnchorId('round-1-What is the capital of France?');
    document.body.appendChild(target);

    render(
      <QuizOutline
        rounds={rounds}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Jump to question 1, What is the capital of France?',
      }),
    );

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    target.remove();
  });

  it('disables round drag handles and the questions of a locking round while a session is live', () => {
    const rounds = [roundWithQuestions('round-1', 'Round 1', ['Question 1'])];

    render(
      <QuizOutline
        rounds={rounds}
        liveEdit={liveEdit(0, [1], true)}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder round 1, Round 1',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder question 1, Question 1',
      }),
    ).toBeDisabled();
  });

  it('keeps question drag handles enabled in rounds after the live current round', () => {
    const rounds = [
      roundWithQuestions('round-1', 'Round 1', ['Question 1']),
      roundWithQuestions('round-2', 'Round 2', ['Question 2'], 2),
    ];

    render(
      <QuizOutline
        rounds={rounds}
        liveEdit={liveEdit(0, [1], true)}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder question 1, Question 1',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder question 1, Question 2',
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder round 2, Round 2',
      }),
    ).toBeDisabled();
  });

  it('disables only the opened questions’ drag handles in the current round before its block locks', () => {
    const rounds = [
      roundWithQuestions('round-1', 'Round 1', ['Opened', 'Next', 'Later']),
    ];

    render(
      <QuizOutline
        rounds={rounds}
        liveEdit={liveEdit(0, [1])}
        onReorderRounds={vi.fn()}
        onReorderQuestions={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Drag to reorder question 1, Opened',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Drag to reorder question 2, Next' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Drag to reorder question 3, Later' }),
    ).toBeEnabled();
  });
});
