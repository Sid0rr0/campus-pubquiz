import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuizOutline } from '@/app/quizzes/[id]/quiz-outline';
import { makeQuestion, makeRound } from '@/app/quizzes/[id]/quiz-draft-state';
import { questionAnchorId } from '@/app/quizzes/[id]/quiz-question-editor';
import { roundAnchorId } from '@/app/quizzes/[id]/quiz-round-editor';

function roundWithQuestions(
  id: string,
  title: string,
  prompts: string[],
): ReturnType<typeof makeRound> {
  return {
    ...makeRound(id, title),
    questions: prompts.map((prompt) => ({
      ...makeQuestion(`${id}-${prompt}`),
      prompt,
    })),
  };
}

describe('QuizOutline', () => {
  it('renders nothing when there are no rounds', () => {
    const { container } = render(
      <QuizOutline
        rounds={[]}
        isLive={false}
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
        isLive={false}
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
        isLive={false}
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
        isLive={false}
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
        isLive={false}
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
        isLive={false}
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
        isLive={false}
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
        isLive={false}
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

  it('disables every drag handle while a session is live', () => {
    const rounds = [roundWithQuestions('round-1', 'Round 1', ['Question 1'])];

    render(
      <QuizOutline
        rounds={rounds}
        isLive={true}
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
});
