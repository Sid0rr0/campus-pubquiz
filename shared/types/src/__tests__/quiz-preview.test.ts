import { describe, expect, it } from 'vitest';
import { planNextPress } from '../move-plan';
import { buildQuizPreview } from '../quiz-preview';
import { projectScreen } from '../screen-projection';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import { freshSessionState, type SeededRound } from '../session-state';
import { SOCKET_ROOMS } from '../socket-events';
import type { SeededQuestion } from '../question-views';

function question(
  id: number,
  extra: Partial<SeededQuestion> = {},
): SeededQuestion {
  return {
    id,
    type: 'free_text',
    prompt: `Question ${id}?`,
    answer: `Answer ${id}`,
    points: 1000,
    ...extra,
  };
}

function round(
  id: number,
  questions: SeededQuestion[],
  extra: Partial<SeededRound> = {},
): SeededRound {
  return {
    id,
    title: `Round ${id}`,
    breakAfter: true,
    questions,
    ...extra,
  };
}

/** Compact label for each step: 'title:1', 'q:3', 'a:3'. */
function labels(rounds: SeededRound[]): string[] {
  return buildQuizPreview(rounds, 'answer_after_question').steps.map(
    ({ screen }) => {
      switch (screen.kind) {
        case 'round_title':
          return `title:${screen.roundNumber}`;
        case 'question':
          return `q:${screen.question.id}`;
        case 'reveal':
          return `a:${screen.question.id}`;
        default:
          return `unexpected:${screen.kind}`;
      }
    },
  );
}

const NIGHT_KINDS = [
  'round_overview',
  'round_title',
  'question',
  'break_intro',
  'reveal_intro',
  'reveal',
];

/** The display screens a real session reaches pressing Start quiz, then Advance, to the end. */
function screensByAdvancing(rounds: SeededRound[]) {
  let session = freshSessionState({
    quizId: 0,
    gameSessionId: 0,
    joinCode: '',
    rounds,
    settings: {
      ...DEFAULT_SESSION_SETTINGS,
      funFactsEnabled: false,
      showRoundOverview: true,
    },
  });
  const screens = [projectScreen(session, SOCKET_ROOMS.DISPLAY).screen];
  for (let press = 0; press < 200; press += 1) {
    const step = planNextPress(session);
    if (step.kind === 'transition' || step.kind === 'leaderboard_hide') {
      session = { ...session, progress: step.progress };
    } else if (step.kind === 'leaderboard_reveal') {
      session = {
        ...session,
        leaderboardRevealCount: session.leaderboardRevealCount + 1,
      };
    } else if (step.kind === 'reveal_step') {
      session = step.session;
    } else {
      break;
    }
    screens.push(projectScreen(session, SOCKET_ROOMS.DISPLAY).screen);
  }
  return screens;
}

describe('buildQuizPreview, night', () => {
  const multiBlockQuiz = () => [
    round(1, [question(1), question(2)]),
    round(2, [question(3), question(4)], { kahootMode: true }),
    round(3, [question(5)], { breakAfter: false }),
    round(4, [question(6)]),
  ];

  it('shows the screens a real session reaches by Advance, kind for kind, minus the left-out kinds', () => {
    const rounds = multiBlockQuiz();
    const expected = screensByAdvancing(rounds)
      .filter(({ kind }) => NIGHT_KINDS.includes(kind))
      .map(({ kind }) => kind);
    const { steps } = buildQuizPreview(rounds, 'night');
    expect(steps.map(({ screen }) => screen.kind)).toEqual(expected);
    // The quiz really passes through the kinds the preview leaves out.
    expect(screensByAdvancing(rounds).length).toBeGreaterThan(expected.length);
  });

  it('orders a block as questions, break intro, reveal intro, then its reveals', () => {
    const { steps } = buildQuizPreview(
      [round(1, [question(1), question(2)])],
      'night',
    );
    expect(steps.map(({ screen }) => screen.kind)).toEqual([
      'round_overview',
      'round_title',
      'question',
      'question',
      'break_intro',
      'reveal_intro',
      'reveal',
      'reveal',
    ]);
  });

  it('leaves out lobby, rules, join overlay, locking, break review, leaderboard, showdown and ended', () => {
    const { steps } = buildQuizPreview(multiBlockQuiz(), 'night');
    expect(steps.every(({ screen }) => NIGHT_KINDS.includes(screen.kind))).toBe(
      true,
    );
  });

  it('gives the break intro no deadline, no feedback prompt and no fun facts', () => {
    const { steps } = buildQuizPreview(multiBlockQuiz(), 'night');
    const intros = steps.flatMap(({ screen }) =>
      screen.kind === 'break_intro' ? [screen] : [],
    );
    expect(intros.length).toBeGreaterThan(0);
    for (const intro of intros) {
      expect(intro.breakEndsAt).toBeNull();
      expect(intro.isFeedbackPromptShown).toBe(false);
      expect(intro.funFacts).toEqual([]);
    }
  });

  it('marks a block end after the last reveal of each block', () => {
    const { steps } = buildQuizPreview(multiBlockQuiz(), 'night');
    const ends = steps.flatMap((step) =>
      step.isBlockEnd && step.screen.kind === 'reveal'
        ? [step.screen.question.id]
        : [],
    );
    // Every kahoot question is its own block; round 3 has no break, so it
    // shares a block with round 4.
    expect(ends).toEqual([2, 3, 4, 6]);
    expect(steps.filter((step) => step.isBlockEnd)).toHaveLength(4);
  });

  it('records round and question positions on the steps', () => {
    const { steps } = buildQuizPreview(
      [round(1, [question(1)]), round(2, [question(2)])],
      'night',
    );
    const at = steps.map(({ screen, roundIndex, questionIndex }) => [
      screen.kind,
      roundIndex,
      questionIndex,
    ]);
    expect(at).toContainEqual(['question', 1, 0]);
    expect(at).toContainEqual(['reveal', 0, 0]);
    expect(at).toContainEqual(['round_title', 1, null]);
  });

  it('gives no steps and no error for an empty quiz', () => {
    expect(buildQuizPreview([], 'night').steps).toEqual([]);
  });

  describe('a round with no questions', () => {
    /** Compact label per step: 'overview', 'title:N', 'q:id', 'a:id', or the kind. */
    const nightLabels = (rounds: SeededRound[]) =>
      buildQuizPreview(rounds, 'night').steps.map(({ screen }) => {
        switch (screen.kind) {
          case 'round_title':
            return `title:${screen.roundNumber}`;
          case 'question':
            return `q:${screen.question.id}`;
          case 'reveal':
            return `a:${screen.question.id}`;
          default:
            return screen.kind;
        }
      });

    it('previews without errors when it comes first', () => {
      expect(nightLabels([round(1, []), round(2, [question(1)])])).toEqual([
        'round_overview',
        'title:1',
        'title:2',
        'q:1',
        'break_intro',
        'reveal_intro',
        'a:1',
      ]);
    });

    it('previews without errors when it sits between two rounds', () => {
      const rounds = [
        round(1, [question(1)]),
        round(2, []),
        round(3, [question(2)]),
      ];
      expect(nightLabels(rounds)).toEqual([
        'round_overview',
        'title:1',
        'q:1',
        'break_intro',
        'reveal_intro',
        'a:1',
        'title:2',
        'title:3',
        'q:2',
        'break_intro',
        'reveal_intro',
        'a:2',
      ]);
    });

    it('previews without errors when it comes last', () => {
      expect(nightLabels([round(1, [question(1)]), round(2, [])])).toEqual([
        'round_overview',
        'title:1',
        'q:1',
        'break_intro',
        'reveal_intro',
        'a:1',
        'title:2',
      ]);
    });

    it('numbers the rounds after it by their place in the quiz', () => {
      const { steps } = buildQuizPreview(
        [round(1, []), round(2, [question(1)])],
        'night',
      );
      const numbers = steps.flatMap(({ screen }) =>
        screen.kind === 'reveal_intro' || screen.kind === 'break_intro'
          ? [screen.roundNumber]
          : screen.kind === 'reveal'
            ? [screen.question.roundNumber]
            : [],
      );
      expect(numbers.every((number) => number === 2)).toBe(true);
      expect(
        steps.filter(({ screen }) => screen.kind === 'question')[0].roundIndex,
      ).toBe(1);
    });
  });
});

describe('buildQuizPreview, answer_after_question', () => {
  it('gives each round a title card, then every question followed by its answer', () => {
    const rounds = [
      round(1, [question(1), question(2)], { breakAfter: false }),
      round(2, [question(3), question(4)]),
    ];
    expect(labels(rounds)).toEqual([
      'title:1',
      'q:1',
      'a:1',
      'q:2',
      'a:2',
      'title:2',
      'q:3',
      'a:3',
      'q:4',
      'a:4',
    ]);
  });

  it('marks a block end after the last question of each block, answer included', () => {
    const rounds = [
      round(1, [question(1), question(2)]),
      round(2, [question(3)], { breakAfter: false }),
      round(3, [question(4)]),
    ];
    const { steps } = buildQuizPreview(rounds, 'answer_after_question');
    const blockEnds = steps
      .filter((step) => step.isBlockEnd)
      .map(({ screen }) =>
        screen.kind === 'reveal' ? screen.question.id : screen.kind,
      );
    // Round 2 has no break, so its question shares a block with round 3's.
    expect(blockEnds).toEqual([2, 4]);
  });

  it('puts the answer step, not the question step, at the block end', () => {
    const { steps } = buildQuizPreview(
      [round(1, [question(1)])],
      'answer_after_question',
    );
    expect(steps.map((step) => step.isBlockEnd)).toEqual([false, false, true]);
  });

  it('records each step position as round and question indexes', () => {
    const { steps } = buildQuizPreview(
      [round(1, [question(1)]), round(2, [question(2), question(3)])],
      'answer_after_question',
    );
    expect(
      steps.map(({ roundIndex, questionIndex }) => [roundIndex, questionIndex]),
    ).toEqual([
      [0, null],
      [0, 0],
      [0, 0],
      [1, null],
      [1, 0],
      [1, 0],
      [1, 1],
      [1, 1],
    ]);
  });

  it('shows a kahoot round like any other: question then answer', () => {
    const rounds = [
      round(1, [question(1), question(2)], { kahootMode: true }),
      round(2, [question(3)]),
    ];
    expect(labels(rounds)).toEqual([
      'title:1',
      'q:1',
      'a:1',
      'q:2',
      'a:2',
      'title:2',
      'q:3',
      'a:3',
    ]);
    const { steps } = buildQuizPreview(rounds, 'answer_after_question');
    // Every kahoot question is its own block.
    expect(steps.map((step) => step.isBlockEnd)).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      true,
    ]);
  });

  it("shows a closest_guess question's correct answer with no team guesses", () => {
    const { steps } = buildQuizPreview(
      [round(1, [question(1, { type: 'closest_guess', answer: '1969' })])],
      'answer_after_question',
    );
    const reveal = steps[2].screen;
    expect(reveal.kind).toBe('reveal');
    if (reveal.kind !== 'reveal') return;
    expect(reveal.question.revealKind).toBe('closest_guess');
    if (reveal.question.revealKind !== 'closest_guess') return;
    expect(reveal.question.answer).toBe('1969');
    expect(reveal.question.closestGuess).toEqual({
      hasSubmissions: false,
      closestGuesses: [],
    });
  });

  it('carries hideVideo and clip bounds through to the question and its reveal', () => {
    const { steps } = buildQuizPreview(
      [
        round(1, [
          question(1, {
            mediaUrl: 'https://example.com/clip.mp4',
            mediaStartSeconds: 5,
            mediaEndSeconds: 12,
            isVideoHidden: true,
            answerMediaUrl: 'https://example.com/answer.mp4',
            revealStartSeconds: 3,
            revealEndSeconds: 9,
          }),
        ]),
      ],
      'answer_after_question',
    );
    const [, open, reveal] = steps.map((step) => step.screen);
    expect(open).toMatchObject({
      kind: 'question',
      question: {
        mediaStartSeconds: 5,
        mediaEndSeconds: 12,
        isVideoHidden: true,
      },
    });
    expect(reveal).toMatchObject({
      kind: 'reveal',
      question: {
        mediaStartSeconds: 5,
        isVideoHidden: true,
        answerMediaUrl: 'https://example.com/answer.mp4',
        revealStartSeconds: 3,
        revealEndSeconds: 9,
      },
    });
  });

  it("shows the round's title, category, author and on-screen note on its title card", () => {
    const { steps } = buildQuizPreview(
      [
        round(1, [question(1)], {
          category: 'Film',
          author: 'Sam',
          note: 'Host only text',
          showNoteOnScreen: true,
        }),
        round(2, [question(2)], { note: 'Hidden note' }),
      ],
      'answer_after_question',
    );
    expect(steps[0].screen).toEqual({
      kind: 'round_title',
      roundNumber: 1,
      title: 'Round 1',
      category: 'Film',
      author: 'Sam',
      note: 'Host only text',
    });
    expect(steps[3].screen).toMatchObject({ kind: 'round_title', note: '' });
  });

  it('carries no live-only content: no teams, no fun facts, no break deadline', () => {
    const { steps, quiz } = buildQuizPreview(
      [round(1, [question(1)])],
      'answer_after_question',
    );
    expect(quiz.settings.funFactsEnabled).toBe(false);
    expect(quiz.roundTitles).toEqual(['Round 1']);
    expect(quiz.roundCategories).toEqual(['']);
    expect(quiz.roundAuthors).toEqual(['']);
    expect(
      steps.every(({ screen }) =>
        ['round_title', 'question', 'reveal'].includes(screen.kind),
      ),
    ).toBe(true);
    expect(JSON.stringify(steps)).not.toContain('breakEndsAt');
  });

  it('gives no steps and no error for an empty quiz', () => {
    expect(buildQuizPreview([], 'answer_after_question').steps).toEqual([]);
  });

  it('keeps the title card of a round with no questions and previews the rest', () => {
    expect(labels([round(1, []), round(2, [question(1)])])).toEqual([
      'title:1',
      'title:2',
      'q:1',
      'a:1',
    ]);
  });
});

describe('buildQuizPreview, host-only text', () => {
  const NONE = { roundNote: null, questionNote: null };

  it.each(['answer_after_question', 'night'] as const)(
    'carries a question note on its question and reveal steps (%s)',
    (mode) => {
      const rounds = [
        round(1, [question(1), question(2)], {
          questionNotesById: { 1: 'Accept "Paris, France"', 2: null },
        }),
      ];
      const { steps } = buildQuizPreview(rounds, mode);
      const forQuestion = (id: number) =>
        steps.filter(
          (step) =>
            (step.screen.kind === 'question' ||
              step.screen.kind === 'reveal') &&
            step.screen.question.id === id,
        );
      expect(forQuestion(1)).toHaveLength(2);
      for (const step of forQuestion(1)) {
        expect(step.hostOnly).toEqual({
          roundNote: null,
          questionNote: 'Accept "Paris, France"',
        });
      }
      for (const step of forQuestion(2)) expect(step.hostOnly).toEqual(NONE);
    },
  );

  it.each(['answer_after_question', 'night'] as const)(
    'carries a round note the big screen does not show on its title card (%s)',
    (mode) => {
      const rounds = [
        round(1, [question(1)], {
          note: 'Read slowly',
          showNoteOnScreen: false,
        }),
      ];
      const { steps } = buildQuizPreview(rounds, mode);
      const title = steps.find((step) => step.screen.kind === 'round_title');
      expect(title?.hostOnly).toEqual({
        roundNote: 'Read slowly',
        questionNote: null,
      });
      expect(
        steps
          .filter((step) => step.screen.kind !== 'round_title')
          .every((step) => step.hostOnly.roundNote === null),
      ).toBe(true);
    },
  );

  it.each(['answer_after_question', 'night'] as const)(
    'carries no host-only round note when the title card shows it (%s)',
    (mode) => {
      const rounds = [
        round(1, [question(1)], {
          note: 'Read slowly',
          showNoteOnScreen: true,
        }),
      ];
      const { steps } = buildQuizPreview(rounds, mode);
      const title = steps.find((step) => step.screen.kind === 'round_title');
      expect(title?.hostOnly).toEqual(NONE);
      expect(title?.screen).toMatchObject({ note: 'Read slowly' });
    },
  );

  it('carries nothing on steps with neither a note', () => {
    const { steps } = buildQuizPreview(
      [round(1, [question(1)])],
      'answer_after_question',
    );
    expect(steps.every((step) => step.hostOnly.roundNote === null)).toBe(true);
    expect(steps.every((step) => step.hostOnly.questionNote === null)).toBe(
      true,
    );
  });
});
