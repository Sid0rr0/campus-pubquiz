import { WsException } from '@nestjs/websockets';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_WALK_STEPS = 20;

describe('GameGateway — leaderboard', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['First', 'Second'] });
  });

  /** Opens the first question; "First" answers it correctly (2 points), "Second" wrongly. */
  async function scoreFirstTeamOnFirstQuestion(): Promise<void> {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    await game.act('ADVANCE'); // -> first question
    for (const [{ socket, teamId }, value] of [
      [game.teams[0], 'Paris'],
      [game.teams[1], 'London'],
    ] as const) {
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: game.questionIds.multipleChoice,
        teamId,
        value,
      });
    }
  }

  it('toggles the leaderboard without disturbing the underlying status', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    await game.act('ADVANCE'); // -> r1q1

    const withLeaderboard = await game.act('TOGGLE_LEADERBOARD');

    expect(withLeaderboard.progress.status).toBe('question_open');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.currentQuestion?.id).toBe(
      game.questionIds.multipleChoice,
    );
  });

  it('reveals teams one at a time via REVEAL_NEXT_TEAM, bottom-up and bounded by team count', async () => {
    await scoreFirstTeamOnFirstQuestion();
    await game.act('TOGGLE_LEADERBOARD');
    expect((await game.snapshot()).leaderboardRevealCount).toBe(0);

    expect((await game.act('REVEAL_NEXT_TEAM')).leaderboardRevealCount).toBe(1);
    expect((await game.act('REVEAL_NEXT_TEAM')).leaderboardRevealCount).toBe(2);

    // Bounded: a further reveal doesn't exceed the number of teams.
    expect((await game.act('REVEAL_NEXT_TEAM')).leaderboardRevealCount).toBe(2);
  });

  it('rejects REVEAL_NEXT_TEAM while the leaderboard is hidden', async () => {
    await expect(game.act('REVEAL_NEXT_TEAM')).rejects.toThrow(WsException);
  });

  it('also advances the leaderboard reveal on ADVANCE while the board is visible', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    await game.act('TOGGLE_LEADERBOARD');

    const afterAdvance = await game.act('ADVANCE'); // -> r1q1, board still visible

    expect(afterAdvance.leaderboardRevealCount).toBe(1);
  });

  it('resets the reveal count whenever the leaderboard is toggled', async () => {
    await game.act('START_QUIZ');
    await game.act('TOGGLE_LEADERBOARD');
    expect((await game.act('REVEAL_NEXT_TEAM')).leaderboardRevealCount).toBe(1);

    expect((await game.act('TOGGLE_LEADERBOARD')).leaderboardRevealCount).toBe(
      0,
    ); // hide
    expect((await game.act('TOGGLE_LEADERBOARD')).leaderboardRevealCount).toBe(
      0,
    ); // show again, fresh
  });

  it('shows "Quiz complete!" rather than the leaderboard when the End Quiz button ends the quiz, until the admin reveals it', async () => {
    await game.act('START_QUIZ');

    const ended = await game.act('END_QUIZ');

    expect(ended.progress.status).toBe('ended');
    expect(ended.progress.isLeaderboardVisible).toBe(false);
    expect(ended.leaderboardRevealCount).toBe(0);

    const withLeaderboard = await game.act('TOGGLE_LEADERBOARD');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.leaderboardRevealCount).toBe(0);

    const afterFirstReveal = await game.act('REVEAL_NEXT_TEAM');
    expect(afterFirstReveal.leaderboardRevealCount).toBe(1);
  });

  it('shows the leaderboard screen when advancing past the last reveal question ends the quiz naturally', async () => {
    await game.act('START_QUIZ');

    // Walk ADVANCE all the way through the round's questions, the break,
    // and every reveal step — same as an admin just clicking through to the
    // end without ever pressing the separate "End Quiz" button.
    let snapshot = await game.snapshot();
    for (
      let step = 0;
      step < MAX_WALK_STEPS && snapshot.progress.status !== 'ended';
      step += 1
    ) {
      snapshot = await game.act('ADVANCE');
    }

    expect(snapshot.progress.status).toBe('ended');
    expect(snapshot.progress.isLeaderboardVisible).toBe(true);
    // Unlike a mid-game TOGGLE_LEADERBOARD reveal, crossing into 'ended'
    // starts the final leaderboard empty rather than counting itself as the
    // first reveal step — same as the explicit End Quiz button.
    expect(snapshot.leaderboardRevealCount).toBe(0);
  });

  it('shows the leaderboard between reveal blocks, before the next round intro card is revealed', async () => {
    const twoBlocks = await harness.createGateway({
      joinCode: 'BLOCKS',
      teamNames: ['Third'],
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'Q1', answer: 'A1' }],
        },
        {
          title: 'Round B',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'Q2', answer: 'A2' }],
        },
      ],
    });
    for (const action of [
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> r1q1
      'ADVANCE', // -> locking (round A breakAfter)
      'ADVANCE', // -> break_intro
      'ADVANCE', // -> reveal_intro (round 0)
      'ADVANCE', // -> reveal (revealIndex 0)
    ] as const) {
      await twoBlocks.act(action);
    }

    const afterReveal = await twoBlocks.act('ADVANCE'); // -> round_intro(1), board up

    expect(afterReveal.progress.status).toBe('round_intro');
    expect(afterReveal.progress.roundIndex).toBe(1);
    expect(afterReveal.progress.isLeaderboardVisible).toBe(true);
    // A fresh mid-quiz reveal, same as the final leaderboard on 'ended' —
    // never inherits a stale count from an earlier reveal.
    expect(afterReveal.leaderboardRevealCount).toBe(0);

    const afterClose = await twoBlocks.act('TOGGLE_LEADERBOARD');
    expect(afterClose.progress.status).toBe('round_intro');
    expect(afterClose.progress.roundIndex).toBe(1);
    expect(afterClose.progress.isLeaderboardVisible).toBe(false);
  });

  it('starts with an empty leaderboard when no team has joined', async () => {
    const empty = await harness.createGateway({ joinCode: 'EMPTY1' });

    expect((await empty.snapshot()).leaderboard).toEqual([]);
  });

  it('ranks teams by the points their answers earned', async () => {
    await scoreFirstTeamOnFirstQuestion();

    expect((await game.snapshot()).leaderboard).toEqual([
      expect.objectContaining({
        teamId: game.teams[0].teamId,
        teamName: 'First',
        totalPoints: 2,
        bonusPoints: 0,
      }),
      expect.objectContaining({
        teamId: game.teams[1].teamId,
        teamName: 'Second',
        totalPoints: 0,
        bonusPoints: 0,
      }),
    ]);
  });
});
