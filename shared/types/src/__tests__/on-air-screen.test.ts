import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import {
  describeAdminIndicators,
  describeOnAirScreen,
  describePlayersScreen,
  isShowdownAcceptingGuesses,
  screenPositionOf,
  type OnAirInput,
  type PlayersScreenInput,
} from '../on-air-screen';
import type {
  BlockQuestionView,
  BlockRevealQuestionView,
} from '../question-views';
import { lobby } from './game-state-fixtures';

function at(
  status: GameProgress['status'],
  overrides: Partial<GameProgress> = {},
): GameProgress {
  return { ...lobby, status, ...overrides };
}

function blockQuestion(
  id: number,
  roundNumber: number,
  questionNumberInRound: number,
  roundTitle: string,
): BlockQuestionView {
  return {
    id,
    roundNumber,
    questionNumberInRound,
    roundTitle,
  } as unknown as BlockQuestionView;
}

function revealQuestion(
  id: number,
  roundNumber: number,
  questionNumberInRound: number,
  roundTitle: string,
): BlockRevealQuestionView {
  return blockQuestion(
    id,
    roundNumber,
    questionNumberInRound,
    roundTitle,
  ) as unknown as BlockRevealQuestionView;
}

const blockQuestions = [
  blockQuestion(10, 1, 1, 'Alpha'),
  blockQuestion(11, 2, 3, 'Bravo'),
];
const revealQuestions = [
  revealQuestion(20, 3, 2, 'Charlie'),
  revealQuestion(21, 4, 5, 'Delta'),
];

describe('describeOnAirScreen header', () => {
  it.each(['question_open', 'locking'] as const)(
    'labels the round, title and question while %s',
    (status) => {
      const { header } = describeOnAirScreen({
        progress: at(status, { roundIndex: 1, questionIndex: 2 }),
        roundTitle: 'Alpha',
      });

      expect(header).toEqual({
        label: 'ROUND 2',
        title: 'Alpha',
        badge: 'QUESTION 3',
      });
    },
  );

  it('has an empty title while a question is open and the round has none', () => {
    const { header } = describeOnAirScreen({ progress: at('question_open') });

    expect(header).toEqual({
      label: 'ROUND 1',
      title: '',
      badge: 'QUESTION 1',
    });
  });

  it('labels the question under review in a break', () => {
    const { header } = describeOnAirScreen({
      progress: at('break', { revealIndex: 1 }),
      blockQuestions,
    });

    expect(header).toEqual({
      label: 'ROUND 2',
      title: 'Bravo',
      badge: 'QUESTION 3 (BREAK)',
    });
  });

  it('has no header in a break with no question under review', () => {
    expect(
      describeOnAirScreen({ progress: at('break'), blockQuestions: [] }).header,
    ).toEqual({});
  });

  it('labels the question being revealed', () => {
    const { header } = describeOnAirScreen({
      progress: at('reveal', { revealIndex: 1 }),
      revealQuestions,
    });

    expect(header).toEqual({
      label: 'ROUND 4',
      title: 'Delta',
      badge: 'REVEALING ANSWERS · QUESTION 5',
    });
  });

  it('has no header in a reveal with no question being revealed', () => {
    expect(
      describeOnAirScreen({ progress: at('reveal'), revealQuestions: [] })
        .header,
    ).toEqual({});
  });

  it.each([
    'lobby',
    'rules',
    'round_intro',
    'break_intro',
    'break_round_intro',
    'reveal_intro',
    'ended',
  ] as const)('has no header on %s', (status) => {
    expect(
      describeOnAirScreen({
        progress: at(status),
        blockQuestions,
        revealQuestions,
      }).header,
    ).toEqual({});
  });
});

describe('describeOnAirScreen screen and key', () => {
  function describeAt(
    status: GameProgress['status'],
    overrides: Partial<GameProgress> = {},
    input: Omit<OnAirInput, 'progress'> = {},
  ) {
    const { screen, screenKey } = describeOnAirScreen({
      progress: at(status, overrides),
      ...input,
    });
    return { screen, screenKey };
  }

  it.each(['lobby', 'rules', 'round_overview', 'joker_pick'] as const)(
    'names %s as itself, keyed by its status',
    (status) => {
      expect(describeAt(status)).toEqual({
        screen: { kind: status },
        screenKey: status,
      });
    },
  );

  it('names the round title card and keys it by round', () => {
    expect(describeAt('round_intro', { roundIndex: 2 })).toEqual({
      screen: { kind: 'round_title', roundIndex: 2 },
      screenKey: 'round_intro-2',
    });
  });

  it('names the open question and keys it by round and question', () => {
    expect(
      describeAt(
        'question_open',
        { roundIndex: 1, questionIndex: 2 },
        { currentQuestion: { id: 7 } as never },
      ),
    ).toEqual({
      screen: {
        kind: 'question',
        roundIndex: 1,
        questionIndex: 2,
        questionId: 7,
      },
      screenKey: 'question_open-1-2',
    });
  });

  it('names the locking question and keys it by round and question', () => {
    expect(
      describeAt(
        'locking',
        { roundIndex: 1, questionIndex: 2 },
        { currentQuestion: { id: 7 } as never },
      ),
    ).toEqual({
      screen: {
        kind: 'locking',
        roundIndex: 1,
        questionIndex: 2,
        questionId: 7,
      },
      screenKey: 'locking-1-2',
    });
  });

  it('carries no question id when none is open', () => {
    expect(describeAt('question_open').screen).toMatchObject({
      questionId: null,
    });
  });

  it('keys the break intro by round, with the feedback prompt following the setting', () => {
    expect(
      describeAt(
        'break_intro',
        { roundIndex: 3 },
        { settings: { collectFeedback: true } },
      ),
    ).toEqual({
      screen: {
        kind: 'break_intro',
        roundIndex: 3,
        isFeedbackPromptShown: true,
      },
      screenKey: 'break_intro-3',
    });
    expect(describeAt('break_intro', { roundIndex: 3 }).screen).toEqual({
      kind: 'break_intro',
      roundIndex: 3,
      isFeedbackPromptShown: false,
    });
  });

  it('names the question under review in a break, keyed by round and reveal index', () => {
    expect(
      describeAt(
        'break',
        { roundIndex: 3, revealIndex: 1 },
        { blockQuestions },
      ),
    ).toEqual({
      screen: { kind: 'break_review', questionId: 11 },
      screenKey: 'break-3-1',
    });
  });

  it('falls back to the break intro in a break with nothing under review', () => {
    expect(
      describeAt(
        'break',
        { roundIndex: 3 },
        { blockQuestions: [], settings: { collectFeedback: true } },
      ),
    ).toEqual({
      screen: {
        kind: 'break_intro',
        roundIndex: 3,
        isFeedbackPromptShown: true,
      },
      screenKey: 'break-3-0',
    });
  });

  it('names the break round title card after the question it introduces', () => {
    expect(
      describeAt('break_round_intro', { revealIndex: 1 }, { blockQuestions }),
    ).toEqual({
      screen: { kind: 'break_round_title', roundIndex: 1, questionId: 11 },
      screenKey: 'break_round_intro-1',
    });
  });

  it('names the break round title with nothing under review', () => {
    expect(describeAt('break_round_intro').screen).toEqual({
      kind: 'break_round_title',
      roundIndex: null,
      questionId: null,
    });
  });

  it('names the reveal intro after the question being revealed, keyed by its position', () => {
    expect(
      describeAt('reveal_intro', { revealIndex: 1 }, { revealQuestions }),
    ).toEqual({
      screen: { kind: 'reveal_intro', roundIndex: 3, questionId: 21 },
      screenKey: 'reveal_intro-4-5',
    });
  });

  it('keys the reveal intro 0-0 with no question', () => {
    expect(describeAt('reveal_intro')).toEqual({
      screen: { kind: 'reveal_intro', roundIndex: null, questionId: null },
      screenKey: 'reveal_intro-0-0',
    });
  });

  it('names the revealed question, keyed by position and closest-guess step', () => {
    expect(
      describeAt(
        'reveal',
        { revealIndex: 0 },
        { revealQuestions, closestGuessRevealStep: 2 },
      ),
    ).toEqual({
      screen: { kind: 'reveal', roundIndex: 2, questionId: 20 },
      screenKey: 'reveal-3-2-2',
    });
  });

  it('keys a reveal with no question and no step 0-0-0', () => {
    expect(describeAt('reveal')).toEqual({
      screen: { kind: 'reveal', roundIndex: null, questionId: null },
      screenKey: 'reveal-0-0-0',
    });
  });

  it('names the ended screen, with the feedback prompt following the setting', () => {
    expect(describeAt('ended')).toEqual({
      screen: { kind: 'ended', isFeedbackPromptShown: false },
      screenKey: 'ended',
    });
    expect(
      describeAt('ended', {}, { settings: { collectFeedback: true } }).screen,
    ).toEqual({ kind: 'ended', isFeedbackPromptShown: true });
  });

  it('names an active showdown at the end, keyed by id and reveal step', () => {
    expect(describeAt('ended', {}, { activeShowdown: { id: 9 } })).toEqual({
      screen: { kind: 'showdown', showdownId: 9 },
      screenKey: 'ended-showdown-9-0',
    });
    expect(
      describeAt(
        'ended',
        {},
        { activeShowdown: { id: 9 }, showdownRevealStep: 3 },
      ).screenKey,
    ).toBe('ended-showdown-9-3');
  });

  it('puts the leaderboard over any screen', () => {
    expect(
      describeAt('question_open', {
        isLeaderboardVisible: true,
        isJoinOverlayVisible: true,
      }),
    ).toEqual({ screen: { kind: 'leaderboard' }, screenKey: 'leaderboard' });
  });

  it('puts the join overlay over any screen', () => {
    expect(describeAt('question_open', { isJoinOverlayVisible: true })).toEqual(
      {
        screen: { kind: 'join_overlay' },
        screenKey: 'join_overlay',
      },
    );
  });
});

describe('screenPositionOf slots', () => {
  it('places the round intro before the slot of the round its question index is left over from', () => {
    expect(
      screenPositionOf(at('round_intro', { roundIndex: 1, questionIndex: 3 })),
    ).toBe(screenPositionOf(at('round_intro', { roundIndex: 1 })));
  });

  it('puts locking after the open question and before the break', () => {
    const open = screenPositionOf(at('question_open', { questionIndex: 1 }));
    const locking = screenPositionOf(at('locking', { questionIndex: 1 }));
    const review = screenPositionOf(at('break', { questionIndex: 1 }));

    expect(open).toBe(70_004);
    expect(locking).toBe(80_004);
    expect(review).toBe(90_005);
  });
});

describe('describeAdminIndicators', () => {
  function indicatorsAt(
    status: GameProgress['status'],
    overrides: Partial<GameProgress> = {},
    input: Omit<OnAirInput, 'progress'> = {},
  ) {
    return describeAdminIndicators({
      progress: at(status, overrides),
      ...input,
    });
  }
  const none = {
    onDisplayQuestionId: null,
    titleCardRoundIndex: null,
    breakRoundIndex: null,
  };

  it.each(['question_open', 'locking'] as const)(
    'marks the %s question, with no break lit',
    (status) => {
      expect(
        indicatorsAt(status, {}, { currentQuestion: { id: 7 } as never }),
      ).toEqual({ ...none, onDisplayQuestionId: 7 });
    },
  );

  it('marks the revealed question, with no break lit', () => {
    expect(
      indicatorsAt('reveal', { roundIndex: 2 }, { revealQuestions }),
    ).toEqual({ ...none, onDisplayQuestionId: 20 });
  });

  it('marks the reviewed question and lights the block-ending round in a break', () => {
    expect(
      indicatorsAt(
        'break',
        { roundIndex: 2, revealIndex: 1 },
        { blockQuestions },
      ),
    ).toEqual({ ...none, onDisplayQuestionId: 11, breakRoundIndex: 2 });
  });

  it('marks the round title card of a round intro', () => {
    expect(indicatorsAt('round_intro', { roundIndex: 2 })).toEqual({
      ...none,
      titleCardRoundIndex: 2,
    });
  });

  it('marks the round title card of a reveal intro', () => {
    expect(
      indicatorsAt('reveal_intro', { revealIndex: 1 }, { revealQuestions }),
    ).toEqual({
      ...none,
      titleCardRoundIndex: 3,
    });
  });

  it('marks the title card and lights the break on a break round intro', () => {
    expect(
      indicatorsAt(
        'break_round_intro',
        { roundIndex: 5, revealIndex: 1 },
        { blockQuestions },
      ),
    ).toEqual({ ...none, titleCardRoundIndex: 1, breakRoundIndex: 5 });
  });

  it('lights the break on the break intro', () => {
    expect(indicatorsAt('break_intro', { roundIndex: 4 })).toEqual({
      ...none,
      breakRoundIndex: 4,
    });
  });

  it('marks nothing on a screen with no question', () => {
    expect(indicatorsAt('lobby')).toEqual(none);
  });

  it('reads the content under the leaderboard and the join overlay', () => {
    expect(
      indicatorsAt(
        'question_open',
        { isLeaderboardVisible: true, isJoinOverlayVisible: true },
        { currentQuestion: { id: 7 } as never },
      ),
    ).toEqual({ ...none, onDisplayQuestionId: 7 });
  });
});

describe('describePlayersScreen', () => {
  function phoneAt(
    status: GameProgress['status'],
    overrides: Partial<GameProgress> = {},
    input: Partial<Omit<PlayersScreenInput, 'progress'>> = {},
  ) {
    return describePlayersScreen({
      progress: at(status, overrides),
      isAnswerable: false,
      isShowdownResolved: false,
      isJokerPickOpen: false,
      ...input,
    }).phoneScreen;
  }

  it('shows the leaderboard over a block nobody can answer', () => {
    expect(phoneAt('question_open', { isLeaderboardVisible: true })).toEqual({
      kind: 'leaderboard',
    });
  });

  it('shows the block, not the leaderboard, over a block teams can answer', () => {
    expect(
      phoneAt(
        'question_open',
        { isLeaderboardVisible: true },
        { isAnswerable: true },
      ),
    ).toEqual({ kind: 'block', mode: 'answering', onScreenQuestionId: null });
  });

  it('keeps an answerable block in answering mode even in a break or reveal', () => {
    for (const status of ['break', 'reveal'] as const) {
      expect(phoneAt(status, {}, { isAnswerable: true })).toEqual({
        kind: 'block',
        mode: 'answering',
        onScreenQuestionId: null,
      });
    }
  });

  it('shows an answerable block before any screen the status would name', () => {
    expect(
      phoneAt('reveal', {}, { isAnswerable: true, revealQuestions }),
    ).toEqual({ kind: 'block', mode: 'answering', onScreenQuestionId: null });
    expect(phoneAt('rules', {}, { isAnswerable: true })).toEqual({
      kind: 'block',
      mode: 'answering',
      onScreenQuestionId: null,
    });
  });

  it('reads the content under the join overlay', () => {
    expect(phoneAt('rules', { isJoinOverlayVisible: true })).toEqual({
      kind: 'rules',
    });
  });

  it.each(['lobby', 'rules', 'round_overview'] as const)(
    'names %s as itself',
    (status) => {
      expect(phoneAt(status)).toEqual({ kind: status });
    },
  );

  it('tells the joker pick whether it is open', () => {
    expect(phoneAt('joker_pick', {}, { isJokerPickOpen: true })).toEqual({
      kind: 'joker_pick',
      isOpen: true,
    });
    expect(phoneAt('joker_pick')).toEqual({
      kind: 'joker_pick',
      isOpen: false,
    });
  });

  it('shows the round title card with its 1-based round number', () => {
    expect(
      phoneAt('round_intro', { roundIndex: 2 }, { roundTitle: 'Alpha' }),
    ).toEqual({ kind: 'round_title', title: 'Alpha', roundNumber: 3 });
    expect(phoneAt('round_intro')).toEqual({
      kind: 'round_title',
      title: '',
      roundNumber: 1,
    });
  });

  it('follows the question the big screen is revealing, in revealing mode', () => {
    expect(phoneAt('reveal', {}, { revealQuestions })).toEqual({
      kind: 'block',
      mode: 'revealing',
      onScreenQuestionId: 20,
    });
  });

  it('shows the revealed round title card from the reveal questions', () => {
    expect(
      phoneAt(
        'reveal_intro',
        { revealIndex: 1 },
        { revealQuestions, blockQuestions },
      ),
    ).toEqual({ kind: 'round_title', title: 'Delta', roundNumber: 4 });
  });

  it('shows the break round title card from the block questions', () => {
    expect(
      phoneAt(
        'break_round_intro',
        { revealIndex: 1 },
        { revealQuestions, blockQuestions },
      ),
    ).toEqual({ kind: 'round_title', title: 'Bravo', roundNumber: 2 });
  });

  it('falls back to the block when a title card has no question', () => {
    expect(phoneAt('reveal_intro')).toEqual({
      kind: 'block',
      mode: 'revealing',
      onScreenQuestionId: null,
    });
    expect(phoneAt('break_round_intro')).toEqual({
      kind: 'block',
      mode: 'locked',
      onScreenQuestionId: null,
    });
  });

  it('shows a locked block in a break and an answering one while a question is open', () => {
    expect(phoneAt('break_intro')).toEqual({
      kind: 'block',
      mode: 'locked',
      onScreenQuestionId: null,
    });
    expect(phoneAt('question_open')).toEqual({
      kind: 'block',
      mode: 'answering',
      onScreenQuestionId: null,
    });
  });

  it('names the ended screen', () => {
    expect(phoneAt('ended')).toEqual({ kind: 'ended' });
  });

  it('shows the guess form until the showdown is resolved or revealing', () => {
    const showdown = { activeShowdown: { id: 4 } };

    expect(phoneAt('ended', {}, showdown)).toEqual({
      kind: 'showdown_guessing',
    });
    expect(
      phoneAt('ended', {}, { ...showdown, isShowdownResolved: true }),
    ).toEqual({ kind: 'showdown_reveal' });
    expect(
      phoneAt('ended', {}, { ...showdown, showdownRevealStep: 1 }),
    ).toEqual({
      kind: 'showdown_reveal',
    });
  });
});

describe('isShowdownAcceptingGuesses', () => {
  const open = { id: 4, resolved: false };

  it('accepts guesses for the unresolved round named, before the reveal starts', () => {
    expect(isShowdownAcceptingGuesses(open, 4, 0)).toBe(true);
  });

  it.each([
    ['there is no round', null, 4, 0],
    ['another round is named', open, 5, 0],
    ['the round is resolved', { id: 4, resolved: true }, 4, 0],
    ['the reveal has started', open, 4, 1],
  ] as const)('refuses guesses when %s', (_name, round, roundId, step) => {
    expect(isShowdownAcceptingGuesses(round, roundId, step)).toBe(false);
  });
});
