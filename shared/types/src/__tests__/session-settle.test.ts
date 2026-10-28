import { describe, expect, it } from 'vitest';
import type { GameAction, GameProgress } from '../game-state';
import { JOKER_PICK_SECONDS } from '../joker';
import { settleSession } from '../session-settle';
import type { SessionState } from '../session-state';
import { progressAt, roundOf, sessionOver } from './session-progress-fixtures';

const NOW = 1_700_000_000_000;

// Round 0 is a normal round (ids 1, 2); round 1 is kahoot (ids 3, 4).
const rounds = [
  roundOf(0, [1, 2], { breakAfter: true }),
  roundOf(1, [3, 4], { kahootMode: true }),
];

function move(
  session: SessionState,
  progress: GameProgress,
  action: GameAction = 'ADVANCE',
  now = NOW,
): SessionState {
  return settleSession({
    session,
    progress,
    step: { kind: 'transition', action },
    now,
  });
}

describe('settling the auto-lock deadline', () => {
  it('arms it the lock grace period out when the block starts locking', () => {
    const session = sessionOver(rounds, progressAt('question_open'), {
      lockGraceSeconds: 45,
    });

    const settled = move(session, progressAt('locking'));

    expect(settled.questionLockAt).toBe(NOW + 45_000);
  });

  it('leaves it unarmed outside locking', () => {
    const settled = move(
      sessionOver(rounds, progressAt('locking')),
      progressAt('question_open'),
    );

    expect(settled.questionLockAt).toBeNull();
  });

  it('keeps a running countdown when the join overlay is toggled', () => {
    const session = {
      ...sessionOver(rounds, progressAt('locking')),
      questionLockAt: NOW + 10_000,
    };

    const settled = move(
      session,
      progressAt('locking', { isJoinOverlayVisible: true }),
      'TOGGLE_JOIN_OVERLAY',
      NOW + 5_000,
    );

    expect(settled.questionLockAt).toBe(NOW + 10_000);
  });

  it('re-arms it on any other move that stays on locking', () => {
    const session = {
      ...sessionOver(rounds, progressAt('locking'), { lockGraceSeconds: 20 }),
      questionLockAt: NOW + 10_000,
    };

    const settled = move(
      session,
      progressAt('locking', { isLeaderboardVisible: true }),
      'TOGGLE_LEADERBOARD',
      NOW + 5_000,
    );

    expect(settled.questionLockAt).toBe(NOW + 5_000 + 20_000);
  });
});

describe('settling the kahoot question deadline', () => {
  const kahootOpen = (questionIndex: number) =>
    progressAt('question_open', { roundIndex: 1, questionIndex });
  const timed = { kahootQuestionTimerSeconds: 30 };

  it('arms it from the moment the live question opened', () => {
    const settled = move(
      sessionOver(rounds, progressAt('round_intro', { roundIndex: 1 }), timed),
      kahootOpen(0),
    );

    expect(settled.kahootQuestionEndsAt).toBe(NOW + 30_000);
  });

  it('stays unarmed with no timer configured', () => {
    const settled = move(
      sessionOver(rounds, progressAt('round_intro', { roundIndex: 1 })),
      kahootOpen(0),
    );

    expect(settled.kahootQuestionEndsAt).toBeNull();
  });

  it('stays unarmed in a round that is not kahoot', () => {
    const settled = move(
      sessionOver(rounds, progressAt('lobby'), timed),
      progressAt('question_open'),
    );

    expect(settled.kahootQuestionEndsAt).toBeNull();
  });

  it('stays unarmed once the question is locking', () => {
    const open = move(
      sessionOver(rounds, progressAt('round_intro', { roundIndex: 1 }), timed),
      kahootOpen(0),
    );

    const locking = move(
      open,
      progressAt('locking', { roundIndex: 1 }),
      'ADVANCE',
      NOW + 1_000,
    );

    expect(locking.kahootQuestionEndsAt).toBeNull();
  });

  it('stays unarmed on a question behind the leaderboard, which is not live yet', () => {
    const settled = move(
      sessionOver(rounds, progressAt('reveal', { roundIndex: 1 }), timed),
      { ...kahootOpen(0), isLeaderboardVisible: true },
    );

    expect(settled.kahootQuestionEndsAt).toBeNull();
  });

  it('stays unarmed on an earlier question revisited with Previous', () => {
    const first = move(
      sessionOver(rounds, progressAt('round_intro', { roundIndex: 1 }), timed),
      kahootOpen(0),
    );
    const second = move(first, kahootOpen(1), 'ADVANCE', NOW + 10_000);
    expect(second.kahootQuestionEndsAt).toBe(NOW + 10_000 + 30_000);

    const back = move(second, kahootOpen(0), 'PREVIOUS', NOW + 12_000);

    expect(back.kahootQuestionEndsAt).toBeNull();
  });
});

describe('settling the joker pick deadline', () => {
  it('arms a full pick when the pick opens, even over a stale deadline', () => {
    const session = {
      ...sessionOver(rounds, progressAt('round_overview')),
      jokerPickEndsAt: NOW - 1,
    };

    const settled = move(session, progressAt('joker_pick'));

    expect(settled.jokerPickEndsAt).toBe(NOW + JOKER_PICK_SECONDS * 1000);
  });

  it('re-arms a full pick when the pick has no deadline left to keep', () => {
    const session = sessionOver(rounds, progressAt('joker_pick'));

    const settled = move(
      session,
      progressAt('joker_pick', { isJoinOverlayVisible: true }),
      'TOGGLE_JOIN_OVERLAY',
    );

    expect(settled.jokerPickEndsAt).toBe(NOW + JOKER_PICK_SECONDS * 1000);
  });

  it('keeps the deadline on a move that stays on the pick', () => {
    const session = {
      ...sessionOver(rounds, progressAt('joker_pick')),
      jokerPickEndsAt: NOW + 5_000,
    };

    const settled = move(
      session,
      progressAt('joker_pick', { isLeaderboardVisible: true }),
      'TOGGLE_LEADERBOARD',
      NOW + 1_000,
    );

    expect(settled.jokerPickEndsAt).toBe(NOW + 5_000);
  });
});

describe('settling the break end time', () => {
  const BREAK_END = NOW + 100;

  function intoBreak(
    from: GameProgress,
    to: GameProgress,
    breakEndsAt: number | null,
  ) {
    return move({ ...sessionOver(rounds, from), breakEndsAt }, to).breakEndsAt;
  }

  it('clears a stale end time when a fresh break starts', () => {
    expect(
      intoBreak(progressAt('locking'), progressAt('break_intro'), NOW - 1),
    ).toBeNull();
  });

  it('clears an end time that is exactly now', () => {
    expect(
      intoBreak(progressAt('locking'), progressAt('break_intro'), NOW),
    ).toBeNull();
  });

  it('keeps an end time set in advance that is still in the future', () => {
    expect(
      intoBreak(progressAt('locking'), progressAt('break_intro'), BREAK_END),
    ).toBe(BREAK_END);
  });

  it('leaves it unset when none was set', () => {
    expect(
      intoBreak(progressAt('locking'), progressAt('break_intro'), null),
    ).toBeNull();
  });

  it('keeps a past end time when the move is not into a fresh break', () => {
    expect(
      intoBreak(progressAt('locking'), progressAt('reveal'), NOW - 1),
    ).toBe(NOW - 1);
  });

  it('keeps a past end time when the break was not entered from locking', () => {
    expect(
      intoBreak(progressAt('break_intro'), progressAt('break'), NOW - 1),
    ).toBe(NOW - 1);
    expect(
      intoBreak(progressAt('reveal'), progressAt('break_intro'), NOW - 1),
    ).toBe(NOW - 1);
  });
});

describe('settling the opened questions', () => {
  it('adds the block now in play to those already opened', () => {
    const session = {
      ...sessionOver(rounds, progressAt('lobby')),
      openedQuestionIds: [99],
    };

    const settled = move(
      session,
      progressAt('question_open', { furthestOpenIndex: 1 }),
    );

    expect(settled.openedQuestionIds).toEqual([99, 1, 2]);
  });

  it('adds every earlier block, once, and never drops one on stepping back', () => {
    const session = {
      ...sessionOver(rounds, progressAt('lobby')),
      openedQuestionIds: [1, 2, 3],
    };

    const settled = move(
      session,
      progressAt('question_open', {
        roundIndex: 1,
        questionIndex: 1,
        furthestOpenIndex: 0,
      }),
    );

    expect(settled.openedQuestionIds).toEqual([1, 2, 3, 4]);
  });

  it('keeps stored ids when the new position implies none of them', () => {
    const session = {
      ...sessionOver(rounds, progressAt('lobby')),
      openedQuestionIds: [99],
      revealedKahootQuestionIds: [98],
    };

    const settled = move(session, progressAt('rules'));

    expect(settled.openedQuestionIds).toEqual([99]);
    expect(settled.revealedKahootQuestionIds).toEqual([98]);
  });

  it('opens nothing before the first block starts', () => {
    expect(
      move(sessionOver(rounds, progressAt('lobby')), progressAt('rules'))
        .openedQuestionIds,
    ).toEqual([]);
  });
});

describe('settling the revealed kahoot questions', () => {
  const lobbySession = sessionOver(rounds, progressAt('lobby'));

  it('records the kahoot question that has just been revealed', () => {
    const settled = move(
      lobbySession,
      progressAt('reveal', { roundIndex: 1, questionIndex: 0 }),
    );

    expect(settled.revealedKahootQuestionIds).toEqual([3]);
  });

  it('never drops one on stepping back, and adds the next once, as it is revealed', () => {
    const session = { ...lobbySession, revealedKahootQuestionIds: [3] };

    const steppedBack = move(
      session,
      progressAt('locking', { roundIndex: 1, questionIndex: 0 }),
      'PREVIOUS',
    );
    const nextRevealed = move(
      steppedBack,
      progressAt('reveal', { roundIndex: 1, questionIndex: 1 }),
    );
    const revealedAgain = move(
      nextRevealed,
      progressAt('reveal', { roundIndex: 1, questionIndex: 1 }),
    );

    expect(steppedBack.revealedKahootQuestionIds).toEqual([3]);
    expect(nextRevealed.revealedKahootQuestionIds).toEqual([3, 4]);
    expect(revealedAgain.revealedKahootQuestionIds).toEqual([3, 4]);
  });

  it('records nothing for a kahoot question that is only open or locking', () => {
    for (const status of ['question_open', 'locking'] as const) {
      expect(
        move(lobbySession, progressAt(status, { roundIndex: 1 }))
          .revealedKahootQuestionIds,
      ).toEqual([]);
    }
  });

  it('derives the ones it has moved past, as a session saved before they were stored is restored', () => {
    const placed = (progress: GameProgress, over = rounds) =>
      settleSession({
        session: sessionOver(over, progressAt('lobby')),
        progress,
        step: { kind: 'place' },
        now: NOW,
      }).revealedKahootQuestionIds;

    expect(
      placed(progressAt('question_open', { roundIndex: 1, questionIndex: 1 })),
    ).toEqual([3]);
    expect(
      placed(progressAt('question_open', { roundIndex: 2 }), [
        ...rounds,
        roundOf(2, [5]),
      ]),
    ).toEqual([3, 4]);
  });

  it('records nothing for the reveal of a round that is not kahoot', () => {
    expect(
      move(lobbySession, progressAt('reveal', { roundIndex: 0 }))
        .revealedKahootQuestionIds,
    ).toEqual([]);
  });
});
