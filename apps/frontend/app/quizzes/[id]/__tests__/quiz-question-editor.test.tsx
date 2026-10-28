import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  makeMatchPair,
  makeOption,
  makeQuestion,
  type EditorQuestion,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { QuizQuestionEditor } from '@/app/quizzes/[id]/quiz-question-editor';

function renderEditor(
  patch: Partial<EditorQuestion>,
  isOpened: boolean,
  onChange = vi.fn(),
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuizQuestionEditor
        question={{ ...makeQuestion('q'), ...patch }}
        index={0}
        isFirstMovable
        isLast
        isPinned={false}
        moveTargets={[]}
        isOpened={isOpened}
        isKahootRound={false}
        issues={[]}
        onChange={onChange}
        onDelete={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onMoveToRound={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return onChange;
}

const enabled = (el: HTMLElement) => expect(el).toBeEnabled();
const disabled = (el: HTMLElement) => expect(el).toBeDisabled();

describe('QuizQuestionEditor on an opened question', () => {
  it.each([
    [true, disabled],
    [false, enabled],
  ])('multiple choice (opened=%s)', (isOpened, check) => {
    renderEditor(
      {
        type: 'multiple_choice',
        options: [
          { ...makeOption('A'), isCorrect: true },
          makeOption('B'),
          makeOption('C'),
        ],
      },
      isOpened,
    );
    screen
      .getAllByRole('button', {
        name: /^(Multiple|Sort|Match|Number|Text|Free)/i,
      })
      .forEach((button) => check(button));
    check(screen.getByDisplayValue('A'));
    check(screen.getByRole('button', { name: 'Remove option 1' }));
    check(screen.getByRole('button', { name: /Add option/ }));
    enabled(screen.getByLabelText('Mark option 2 as correct'));
    enabled(screen.getByRole('spinbutton', { name: /Points/ }));
  });

  it.each([
    [true, disabled],
    [false, enabled],
  ])('sort: items fixed, scoring open (opened=%s)', (isOpened, check) => {
    renderEditor({ type: 'sort', sortItems: ['a', 'b', 'c'] }, isOpened);
    check(screen.getByDisplayValue('b'));
    check(screen.getByRole('button', { name: 'Move item 2 up' }));
    check(screen.getByRole('button', { name: 'Remove item 1' }));
    check(screen.getByRole('button', { name: /Add item/ }));
    enabled(screen.getByRole('combobox', { name: /Scoring/ }));
  });

  it.each([
    [true, disabled],
    [false, enabled],
  ])('match: pairs fixed, scoring open (opened=%s)', (isOpened, check) => {
    renderEditor(
      {
        type: 'match',
        matchPairs: [
          makeMatchPair('l1', 'r1'),
          makeMatchPair('l2', 'r2'),
          makeMatchPair('l3', 'r3'),
        ],
      },
      isOpened,
    );
    check(screen.getByDisplayValue('l1'));
    check(screen.getByDisplayValue('r1'));
    check(screen.getByRole('button', { name: 'Remove pair 1' }));
    check(screen.getByRole('button', { name: /Add pair/ }));
    enabled(screen.getByRole('combobox', { name: /Scoring/ }));
  });

  it('changing the scoring mode of an opened sort updates the draft', async () => {
    const onChange = renderEditor({ type: 'sort' }, true);
    const select = screen.getByRole('combobox', { name: /Scoring/ });
    const other = Array.from(select.querySelectorAll('option')).find(
      (option) => option.value !== (select as HTMLSelectElement).value,
    )!;
    await userEvent.selectOptions(select, other.value);
    expect(onChange).toHaveBeenCalledWith({ scoringMode: other.value });
  });

  it('number: answer and margin stay enabled when opened', () => {
    renderEditor({ type: 'number', correctText: '5' }, true);
    enabled(screen.getByRole('spinbutton', { name: /Correct answer/ }));
    enabled(screen.getByRole('spinbutton', { name: /Margin/ }));
    enabled(screen.getByRole('button', { name: '%' }));
  });

  it('the notice mentions scoring', () => {
    renderEditor({}, true);
    expect(screen.getByText(/or scoring re-scores/)).toBeInTheDocument();
  });
});
