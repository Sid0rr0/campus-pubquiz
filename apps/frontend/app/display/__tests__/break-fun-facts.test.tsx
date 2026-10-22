import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FunFact, QuizStructureSummary } from '@campus-pubquiz/types';
import { BreakIntroScreen } from '@/app/display/break-intro-screen';
import {
  FUN_FACT_ROTATE_MS,
  FUN_FACT_START_DELAY_MS,
} from '@/app/display/fun-fact-rotator';

const QUIZ_STRUCTURE: QuizStructureSummary = {
  roundCount: 2,
  breakCount: 2,
  lastBreakNumber: 2,
} as unknown as QuizStructureSummary;

const QUESTION = {
  questionId: 7,
  roundNumber: 2,
  questionNumberInRound: 3,
  prompt: 'Which river runs through Cairo?',
  answer: 'The Nile',
};

const BONUS_FACT: FunFact = {
  kind: 'bonus_awards_so_far',
  counts: [{ category: 'shot', count: 42 }],
};

function renderBreak(funFacts: FunFact[]) {
  return render(
    <BreakIntroScreen
      roundNumber={2}
      breakNumber={1}
      enabledBonusCategories={[]}
      breakEndsAt={null}
      quizStructure={QUIZ_STRUCTURE}
      showBonusList={false}
      isFeedbackPromptShown={false}
      funFacts={funFacts}
    />,
  );
}

function rotate(times = 1) {
  act(() => {
    vi.advanceTimersByTime(FUN_FACT_ROTATE_MS * times);
  });
}

function waitForStartDelay() {
  act(() => {
    vi.advanceTimersByTime(FUN_FACT_START_DELAY_MS);
  });
}

describe('BreakIntroScreen — fun facts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no fact until the start delay has passed, then the first one', () => {
    renderBreak([BONUS_FACT]);
    expect(screen.queryByTestId('fun-fact')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(FUN_FACT_START_DELAY_MS - 1);
    });
    expect(screen.queryByTestId('fun-fact')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('42 shots')).toBeInTheDocument();
  });

  it('waits the delay out with BREAK already on screen', () => {
    renderBreak([BONUS_FACT]);
    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
  });

  it('shows the first fact, then the next after each rotation, wrapping round', () => {
    renderBreak([BONUS_FACT, { kind: 'nobody_got_it', question: QUESTION }]);
    waitForStartDelay();
    expect(screen.getByText('42 shots')).toBeInTheDocument();
    expect(screen.queryByText('Nobody got it')).not.toBeInTheDocument();

    rotate();
    expect(screen.getByText('Nobody got it')).toBeInTheDocument();
    expect(screen.queryByText('42 shots')).not.toBeInTheDocument();

    rotate();
    expect(screen.getByText('42 shots')).toBeInTheDocument();
  });

  it("doesn't rotate a single fact", () => {
    renderBreak([BONUS_FACT]);
    waitForStartDelay();
    rotate(3);
    expect(screen.getByText('42 shots')).toBeInTheDocument();
  });

  it('keeps BREAK on screen beside the fact', () => {
    renderBreak([BONUS_FACT]);
    waitForStartDelay();
    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
  });

  it('fades in under reduced motion instead of dropping the entrance', () => {
    renderBreak([BONUS_FACT]);
    waitForStartDelay();
    const { className } = screen.getByTestId('fun-fact');
    expect(className).toContain('motion-reduce:animate-fun-fact-fade');
    expect(className).not.toContain('motion-reduce:animate-none');
  });

  it('shows nothing extra for an empty list', () => {
    const { container } = renderBreak([]);
    waitForStartDelay();
    expect(screen.queryByTestId('fun-fact')).not.toBeInTheDocument();
    rotate(2);
    expect(screen.queryByTestId('fun-fact')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('BREAK 1');
  });

  it.each<[string, FunFact, string[]]>([
    [
      'fastest_correct_answer',
      {
        kind: 'fastest_correct_answer',
        teamName: 'Quizzy Rascals',
        responseMs: 2430,
        question: QUESTION,
      },
      ['Quizzy Rascals', '2.4 s', 'Round 2 · Q3', 'Answer: The Nile'],
    ],
    [
      'toughest_question',
      { kind: 'toughest_question', correctRate: 0.12, question: QUESTION },
      [
        'Round 2 · Q3',
        '12%',
        'Which river runs through Cairo?',
        'Answer: The Nile',
      ],
    ],
    [
      'room_split',
      { kind: 'room_split', correctRate: 0.5, question: QUESTION },
      [
        'Round 2 · Q3',
        '50%',
        'Which river runs through Cairo?',
        'Answer: The Nile',
      ],
    ],
    [
      'nobody_got_it',
      { kind: 'nobody_got_it', question: QUESTION },
      ['Nobody got it', 'Round 2 · Q3', 'Answer: The Nile'],
    ],
    [
      'clean_sweep',
      { kind: 'clean_sweep', teamNames: ['Alpha', 'Beta'] },
      ['Alpha', 'Beta', 'Clean sweep'],
    ],
    [
      'joker_favourite_round',
      {
        kind: 'joker_favourite_round',
        roundNumber: 4,
        roundTitle: 'Music',
        teamCount: 5,
      },
      ['Round 4 — Music', '5 teams', 'joker'],
    ],
    [
      'joker_favourite_round for a single team',
      {
        kind: 'joker_favourite_round',
        roundNumber: 4,
        roundTitle: 'Music',
        teamCount: 1,
      },
      ['Round 4 — Music', '1 team '],
    ],
    [
      'joker_snubbed_round',
      { kind: 'joker_snubbed_round', roundNumber: 6, roundTitle: 'Sport' },
      ['Nobody trusted themselves with Round 6 — Sport'],
    ],
    [
      'joker_drawn_count',
      { kind: 'joker_drawn_count', teamCount: 3 },
      ['3 teams', 'random joker'],
    ],
    [
      'best_joker',
      {
        kind: 'best_joker',
        teamName: 'Quizzly Bears',
        roundNumber: 2,
        roundTitle: 'Music',
        extraPoints: 14,
      },
      ['Quizzly Bears', 'Best joker', 'Round 2 — Music', '+14'],
    ],
    [
      'joker_backfired',
      {
        kind: 'joker_backfired',
        teamName: 'Quizzly Bears',
        roundNumber: 2,
        roundTitle: 'Music',
      },
      ['Quizzly Bears', 'backfired', 'Round 2 — Music'],
    ],
    [
      'bonus_awards_so_far',
      {
        kind: 'bonus_awards_so_far',
        counts: [
          { category: 'shot', count: 7 },
          { category: 'selfie', count: 1 },
        ],
      },
      ['7 shots', '1 selfie'],
    ],
  ])('renders the %s wording', (_kind, fact, expected) => {
    renderBreak([fact]);
    waitForStartDelay();
    const text = screen.getByTestId('fun-fact').textContent ?? '';
    for (const part of expected) expect(text).toContain(part);
  });
});
