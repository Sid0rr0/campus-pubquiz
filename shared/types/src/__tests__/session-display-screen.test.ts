import { describe, expect, it } from 'vitest';
import { getPlayingMediaUrl, type DisplayScreen } from '../display-screen';
import type { GameProgress } from '../game-state';
import type { BlockRevealQuestionView } from '../question-views';
import {
  assembleDisplayScreen,
  describeSessionDisplayScreen,
  trimOnAirQuestion,
} from '../session-display-screen';
import type { SessionState } from '../session-state';
import { buildSnapshot } from '../session-snapshot';
import {
  closestGuessQuestion,
  round,
  sessionWith,
  SUMMARY,
} from './session-fixtures';
import { progressAt } from './session-progress-fixtures';

function revealView(
  id: number,
  guessed = true,
): BlockRevealQuestionView & { id: number } {
  return {
    ...closestGuessQuestion(id),
    revealKind: 'closest_guess',
    closestGuess: guessed ? SUMMARY : { hasSubmissions: false },
  } as unknown as BlockRevealQuestionView & { id: number };
}

describe('trimOnAirQuestion', () => {
  const views = [revealView(10), revealView(11)];

  it('shows only the on-air question as far as its step has got, in reveal', () => {
    const [earlier, onAir] = trimOnAirQuestion(
      views,
      progressAt('reveal', { revealIndex: 1 }),
      0,
    );

    expect(earlier).toBe(views[0]);
    expect(onAir).toMatchObject({
      revealKind: 'closest_guess_pending',
      closestGuess: { hasSubmissions: true },
    });
    expect(onAir).not.toHaveProperty('answer');
  });

  it('leaves the later questions of the block whole too', () => {
    const [onAir, later] = trimOnAirQuestion(views, progressAt('reveal'), 0);

    expect(onAir).toMatchObject({ revealKind: 'closest_guess_pending' });
    expect(later).toBe(views[1]);
  });

  it('sends every question whole outside reveal, whatever the step', () => {
    const trimmed = trimOnAirQuestion(views, progressAt('break'), 0);

    expect(trimmed[0]).toBe(views[0]);
    expect(trimmed[1]).toBe(views[1]);
  });

  it('shows more of the on-air question as the step advances', () => {
    const [onAir] = trimOnAirQuestion(views, progressAt('reveal'), 3);

    expect(onAir).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
    });
    expect(onAir).not.toHaveProperty('closestGuess.closestGuesses');
  });
});

describe('describeSessionDisplayScreen', () => {
  const rounds = [round(1, [10, 11], { title: 'Alpha' })];

  function revealSession(step: number): SessionState {
    return sessionWith(
      [
        round(1, [10, 11], {
          questions: [closestGuessQuestion(10), closestGuessQuestion(11)],
        }),
      ],
      {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 1,
        furthestOpenIndex: 1,
      },
      {
        revealStep: step,
        closestGuessSummaries: { 10: SUMMARY, 11: SUMMARY },
      },
    );
  }

  it('names the lobby screen in the lobby', () => {
    expect(describeSessionDisplayScreen(sessionWith(rounds))).toEqual({
      kind: 'lobby',
    });
  });

  it('carries the open question on the question screen', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith(rounds, {
        status: 'question_open',
        furthestOpenIndex: 0,
      }),
    );

    expect(screen).toMatchObject({
      kind: 'question',
      question: { id: 10, prompt: 'Question 10' },
    });
  });

  it('holds the closest-guess answer back at the first reveal step', () => {
    const screen = describeSessionDisplayScreen(revealSession(0));

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { id: 10, revealKind: 'closest_guess_pending' },
    });
    expect(screen).not.toHaveProperty('question.answer');
  });

  it('carries the answer once the reveal has stepped to it', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith(
        [
          round(1, [10], {
            questions: [closestGuessQuestion(10)],
          }),
        ],
        {
          status: 'reveal',
          roundIndex: 0,
          questionIndex: 0,
          furthestOpenIndex: 0,
        },
        { revealStep: 3, closestGuessSummaries: { 10: SUMMARY } },
      ),
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { id: 10, revealKind: 'closest_guess', answer: '55' },
    });
  });

  it('sends a non-closest-guess reveal whole', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith([round(1, [10])], {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 0,
        furthestOpenIndex: 0,
      }),
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { id: 10, answer: 'Answer 10' },
    });
  });
});

describe('the Display screen content', () => {
  /** Two rounds in one block (round 1 has no break), questions 10, 11 and 12. */
  const blockRounds = [
    round(1, [10, 11], { title: 'Alpha', breakAfter: false }),
    round(2, [12], { title: 'Bravo' }),
  ];

  function inBreak(
    status: GameProgress['status'],
    revealIndex: number,
  ): SessionState {
    return sessionWith(blockRounds, {
      status,
      roundIndex: 1,
      questionIndex: 0,
      revealIndex,
      furthestOpenIndex: 2,
    });
  }

  it('names the round title card with its category, author and number', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith(
        [round(1, [10], { title: 'Alpha', category: 'Music', author: 'Sam' })],
        { status: 'round_intro' },
      ),
    );

    expect(screen).toEqual({
      kind: 'round_title',
      roundNumber: 1,
      title: 'Alpha',
      category: 'Music',
      author: 'Sam',
      note: '',
    });
  });

  it('leaves the category and author empty when the round has none', () => {
    const screen = describeSessionDisplayScreen(
      sessionWith([round(1, [10], { title: 'Alpha' })], {
        status: 'round_intro',
      }),
    );

    expect(screen).toMatchObject({ category: '', author: '' });
  });

  it('sends blank for a round title card whose round does not exist', () => {
    const session = sessionWith([round(1, [10])]);

    expect(
      assembleDisplayScreen(
        session,
        buildSnapshot(session),
        { kind: 'round_title', roundIndex: 5 },
        0,
      ),
    ).toEqual({ kind: 'blank' });
  });

  it('carries the question under review on the break review screen', () => {
    expect(describeSessionDisplayScreen(inBreak('break', 1))).toMatchObject({
      kind: 'break_review',
      question: { id: 11 },
    });
  });

  it('sends blank for a break review whose question is not in the block', () => {
    const session = inBreak('break', 0);

    expect(
      assembleDisplayScreen(
        session,
        buildSnapshot(session),
        { kind: 'break_review', questionId: 99 },
        0,
      ),
    ).toEqual({ kind: 'blank' });
  });

  it('names the break round title card after the question it introduces', () => {
    expect(
      describeSessionDisplayScreen(inBreak('break_round_intro', 2)),
    ).toEqual({
      kind: 'break_round_title',
      roundNumber: 2,
      title: 'Bravo',
      note: '',
    });
  });

  it('sends blank for a break round title whose question is not in the block', () => {
    const session = inBreak('break_round_intro', 0);

    expect(
      assembleDisplayScreen(
        session,
        buildSnapshot(session),
        { kind: 'break_round_title', roundIndex: 0, questionId: 99 },
        0,
      ),
    ).toEqual({ kind: 'blank' });
  });

  it('names the ended screen, with the feedback prompt following the setting', () => {
    const collecting = sessionWith(blockRounds, { status: 'ended' });
    const silent: SessionState = {
      ...collecting,
      seededGame: {
        ...collecting.seededGame,
        settings: { ...collecting.seededGame.settings, collectFeedback: false },
      },
    };

    expect(describeSessionDisplayScreen(collecting)).toEqual({
      kind: 'ended',
      isFeedbackPromptShown: true,
    });
    expect(describeSessionDisplayScreen(silent)).toEqual({
      kind: 'ended',
      isFeedbackPromptShown: false,
    });
  });

  describe('the leaderboard crowning the winners', () => {
    const twoBlocks = [round(1, [10]), round(2, [11])];

    function isFinal(session: SessionState): unknown {
      return (describeSessionDisplayScreen(session) as { isFinal: unknown })
        .isFinal;
    }

    it('is not final mid-quiz', () => {
      expect(
        isFinal(
          sessionWith(twoBlocks, {
            status: 'question_open',
            isLeaderboardVisible: true,
          }),
        ),
      ).toBe(false);
    });

    it('is not final in a break that is not the last', () => {
      expect(
        isFinal(
          sessionWith(twoBlocks, {
            status: 'break_intro',
            roundIndex: 0,
            isLeaderboardVisible: true,
          }),
        ),
      ).toBe(false);
    });

    it('is final in the last break', () => {
      expect(
        isFinal(
          sessionWith(twoBlocks, {
            status: 'break_intro',
            roundIndex: 1,
            isLeaderboardVisible: true,
          }),
        ),
      ).toBe(true);
    });

    it('is final once the quiz has ended', () => {
      expect(
        isFinal(
          sessionWith(twoBlocks, {
            status: 'ended',
            isLeaderboardVisible: true,
          }),
        ),
      ).toBe(true);
    });
  });
});

describe('getPlayingMediaUrl', () => {
  const question = (extra: object) =>
    ({ kind: 'question', question: extra }) as unknown as DisplayScreen;
  const reveal = (extra: object) =>
    ({ kind: 'reveal', question: extra }) as unknown as DisplayScreen;

  it('plays the open question’s own media', () => {
    expect(getPlayingMediaUrl(question({ mediaUrl: 'q.mp3' }))).toBe('q.mp3');
  });

  it('plays the answer media on a reveal, replacing the question’s own', () => {
    expect(
      getPlayingMediaUrl(
        reveal({
          revealKind: 'answer',
          mediaUrl: 'q.mp3',
          answerMediaUrl: 'a.mp3',
        }),
      ),
    ).toBe('a.mp3');
  });

  it('falls back to the question’s own media on a reveal with no answer media', () => {
    expect(
      getPlayingMediaUrl(reveal({ revealKind: 'answer', mediaUrl: 'q.mp3' })),
    ).toBe('q.mp3');
  });

  it('plays the answer media on a reveal whose question has no media of its own', () => {
    expect(
      getPlayingMediaUrl(
        reveal({ revealKind: 'answer', answerMediaUrl: 'a.mp3' }),
      ),
    ).toBe('a.mp3');
  });

  it('plays nothing before a closest-guess answer step', () => {
    expect(
      getPlayingMediaUrl(
        reveal({
          revealKind: 'closest_guess_pending',
          mediaUrl: 'q.mp3',
          answerMediaUrl: 'a.mp3',
        }),
      ),
    ).toBeUndefined();
  });

  it.each([
    { kind: 'lobby' },
    { kind: 'break_review', question: { mediaUrl: 'q.mp3' } },
    { kind: 'blank' },
  ])('plays nothing on $kind', (screen) => {
    expect(
      getPlayingMediaUrl(screen as unknown as DisplayScreen),
    ).toBeUndefined();
  });
});

describe('assembleDisplayScreen', () => {
  it('draws the screen it is given on air, not the one the session implies', () => {
    const session = sessionWith([round(1, [10])], {
      status: 'question_open',
      furthestOpenIndex: 0,
    });

    const screen = assembleDisplayScreen(
      session,
      buildSnapshot(session),
      { kind: 'rules' },
      0,
    );

    expect(screen).toEqual({ kind: 'rules' });
  });

  it('trims the on-air reveal question to the step it is given', () => {
    const session = sessionWith(
      [round(1, [10], { questions: [closestGuessQuestion(10)] })],
      {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 0,
        furthestOpenIndex: 0,
      },
      { revealStep: 4, closestGuessSummaries: { 10: SUMMARY } },
    );

    const screen = assembleDisplayScreen(
      session,
      buildSnapshot(session),
      { kind: 'reveal', roundIndex: 0, questionId: 10 },
      0,
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { revealKind: 'closest_guess_pending' },
    });
  });
});
