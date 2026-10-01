import type { GameAction } from '@campus-pubquiz/types';
import {
  TWO_ROUND_QUIZ,
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const START_OF_TIME = '2024-01-01T00:00:00.000Z';

describe('GameGateway — phase elapsed timer', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function actAll(actions: GameAction[]) {
    let snapshot = await game.snapshot();
    for (const action of actions) {
      snapshot = await game.act(action);
    }
    return snapshot;
  }

  afterEach(() => {
    restoreClock();
  });

  // Fixture is two rounds of two questions each (round 1: breakAfter false,
  // round 2: breakAfter true).
  describe('within one block', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
      freezeClockAt(START_OF_TIME);
    });

    it('closes a question’s elapsed time only once a genuinely new question opens, and Previous shows that fixed value', async () => {
      await actAll([
        'START_QUIZ',
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1 (live)
      ]);

      advanceClockBy(12_345);
      const afterAdvance = await game.act('ADVANCE'); // -> r1q2 (fresh, live)

      expect(afterAdvance.progress).toMatchObject({
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 1,
      });
      expect(afterAdvance.phaseStartedAt).toBe(Date.now());
      expect(afterAdvance.phaseElapsedMs).toBeNull();

      const back = await game.act('PREVIOUS'); // -> r1q1 (already closed)

      expect(back.progress).toMatchObject({
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 0,
      });
      expect(back.phaseStartedAt).toBeNull();
      expect(back.phaseElapsedMs).toBe(12_345);
    });

    it('keeps the current question ticking in the background while Previous browses an older, already-closed question — and shows the full undiminished elapsed time once back on it', async () => {
      await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']); // -> r1q1 (live)
      advanceClockBy(12_345);
      const afterAdvance = await game.act('ADVANCE'); // -> r1q2 (live), closes r1q1 @ 12_345
      const r1q2StartedAt = afterAdvance.phaseStartedAt as number;

      advanceClockBy(5_000); // r1q2 ticks another 5s in the background
      const back = await game.act('PREVIOUS'); // -> r1q1 (frozen, unrelated to r1q2)
      expect(back.phaseStartedAt).toBeNull();
      expect(back.phaseElapsedMs).toBe(12_345);

      advanceClockBy(3_000); // more time passes while the admin is looking at r1q1
      const reenter = await game.act('ADVANCE'); // -> r1q2 again (still the same frontier)

      expect(reenter.progress).toMatchObject({
        status: 'question_open',
        questionIndex: 1,
      });
      // r1q2 was never touched by any of the Previous/Advance browsing above —
      // its start time is exactly what it always was, so its live elapsed now
      // reflects the full 5_000 + 3_000 = 8_000ms, undiminished by the detour.
      expect(reenter.phaseStartedAt).toBe(r1q2StartedAt);
      expect(Date.now() - reenter.phaseStartedAt!).toBe(8_000);
    });

    it('keeps one uninterrupted live timer across question_open -> locking on the same question', async () => {
      const r2q2 = await actAll([
        'START_QUIZ',
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1
        'ADVANCE', // -> r1q2
        'ADVANCE', // -> round_intro(1)
        'ADVANCE', // -> r2q1
        'ADVANCE', // -> r2q2 (live)
      ]);
      const startedAt = r2q2.phaseStartedAt;
      expect(startedAt).toBe(Date.now());

      advanceClockBy(30_000);
      const locking = await game.act('ADVANCE'); // -> locking

      expect(locking.progress.status).toBe('locking');
      expect(locking.phaseStartedAt).toBe(startedAt);
      expect(locking.phaseElapsedMs).toBeNull();
    });

    it('keeps the frontier live and untouched through an untimed detour (round_intro), showing the full elapsed time once redisplayed', async () => {
      const opened = await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']); // -> r1q1 (live)
      const startedAt = opened.phaseStartedAt as number;

      advanceClockBy(2_000);
      const toRoundIntro = await game.act('PREVIOUS'); // -> round_intro(0), untimed
      expect(toRoundIntro.phaseStartedAt).toBeNull();
      expect(toRoundIntro.phaseElapsedMs).toBeNull();

      advanceClockBy(3_000); // time passes while parked on the untimed intro card
      const back = await game.act('ADVANCE'); // -> r1q1 again (same frontier)

      expect(back.phaseStartedAt).toBe(startedAt);
      expect(Date.now() - back.phaseStartedAt!).toBe(5_000);
    });

    it('never resets the block timer while browsing break <-> break_round_intro within one block', async () => {
      const breakIntro = await actAll([
        'START_QUIZ',
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1
        'ADVANCE', // -> r1q2
        'ADVANCE', // -> round_intro(1)
        'ADVANCE', // -> r2q1
        'ADVANCE', // -> r2q2
        'ADVANCE', // -> locking
        'ADVANCE', // -> break_intro (fresh block timer)
      ]);
      const blockStartedAt = breakIntro.phaseStartedAt;
      expect(blockStartedAt).toBe(Date.now());

      advanceClockBy(5_000);
      const break1 = await game.act('PREVIOUS'); // -> break (revealIndex 3, r2q2)
      expect(break1.progress.status).toBe('break');
      expect(break1.phaseStartedAt).toBe(blockStartedAt);
      expect(break1.phaseElapsedMs).toBeNull();

      const break2 = await game.act('PREVIOUS'); // -> break (revealIndex 2, r2q1)
      expect(break2.progress.status).toBe('break');
      expect(break2.phaseStartedAt).toBe(blockStartedAt);

      const breakRoundIntro = await game.act('PREVIOUS'); // -> break_round_intro (round 2's title)
      expect(breakRoundIntro.progress.status).toBe('break_round_intro');
      expect(breakRoundIntro.phaseStartedAt).toBe(blockStartedAt);

      const backToBreak = await game.act('ADVANCE'); // -> break again
      expect(backToBreak.progress.status).toBe('break');
      expect(backToBreak.phaseStartedAt).toBe(blockStartedAt);
      expect(backToBreak.phaseElapsedMs).toBeNull();
    });

    it('does not disturb the frontier on END_QUIZ mid-question; Previous from ended shows it still live, undiminished', async () => {
      const opened = await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']); // -> r1q1 (live)
      const startedAt = opened.phaseStartedAt as number;

      advanceClockBy(8_000);
      const ended = await game.act('END_QUIZ');

      expect(ended.progress.status).toBe('ended');
      expect(ended.phaseStartedAt).toBeNull();
      expect(ended.phaseElapsedMs).toBeNull(); // 'ended' itself is untimed

      advanceClockBy(2_000); // time passes on the "quiz complete" screen
      const restored = await game.act('PREVIOUS'); // -> back to r1q1

      expect(restored.progress).toMatchObject({
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 0,
      });
      // Never touched — same start time as when it first opened, so the full
      // 8_000 + 2_000 = 10_000ms shows up once it's live again.
      expect(restored.phaseStartedAt).toBe(startedAt);
      expect(Date.now() - restored.phaseStartedAt!).toBe(10_000);
    });

    it('leaves the frontier untouched for TOGGLE_LEADERBOARD and REVEAL_NEXT_TEAM, which never change the timed phase', async () => {
      await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']); // -> r1q1 (live)

      advanceClockBy(4_000);
      const toggled = await game.act('TOGGLE_LEADERBOARD');

      expect(toggled.progress.status).toBe('question_open');
      expect(toggled.progress.isLeaderboardVisible).toBe(true);
      const startedAt = toggled.phaseStartedAt;
      expect(startedAt).not.toBeNull();
      expect(toggled.phaseElapsedMs).toBeNull();

      advanceClockBy(1_000);
      const revealed = await game.act('REVEAL_NEXT_TEAM');

      expect(revealed.progress.status).toBe('question_open');
      expect(revealed.phaseStartedAt).toBe(startedAt);
      expect(revealed.phaseElapsedMs).toBeNull();
    });
  });

  // A quiz with two separate one-question breakAfter rounds, so this suite can
  // drive the session through a full block boundary (break -> reveal -> the
  // NEXT round's genuinely-new first question) — the only way to exercise "a
  // grading block's timer survives the entire reveal walk and only closes once
  // truly superseded."
  describe('across a full block boundary', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: [
          {
            title: 'Round 1',
            breakAfter: true,
            questions: [{ type: 'free_text', prompt: 'Q1', answer: 'A1' }],
          },
          {
            title: 'Round 2',
            breakAfter: true,
            questions: [{ type: 'free_text', prompt: 'Q2', answer: 'A2' }],
          },
        ],
      });
      freezeClockAt(START_OF_TIME);
    });

    it('keeps the break’s timer running through the entire reveal walk, closing it only once the next round’s first question genuinely opens', async () => {
      const breakIntro = await actAll([
        'START_QUIZ', // -> rules
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1 (question_open)
        'ADVANCE', // -> locking
        'ADVANCE', // -> break_intro
      ]);
      expect(breakIntro.progress.status).toBe('break_intro');

      advanceClockBy(20_000); // grading takes 20s
      const revealIntro = await game.act('ADVANCE'); // -> reveal_intro
      expect(revealIntro.phaseStartedAt).toBeNull(); // reveal itself is untimed
      await game.act('ADVANCE'); // -> reveal

      advanceClockBy(50_000); // revealing/awarding bonuses takes 50s
      await game.act('ADVANCE'); // -> round_intro(1), untimed, behind the board
      await game.act('TOGGLE_LEADERBOARD'); // hides the end-of-block board
      const r2q1 = await game.act('ADVANCE'); // -> r2q1 (genuinely new question)

      expect(r2q1.progress).toMatchObject({
        status: 'question_open',
        roundIndex: 1,
      });
      expect(r2q1.phaseStartedAt).toBe(Date.now()); // the new frontier

      // Walk all the way back into the first block's break to see its final,
      // now-closed value — it was live and ticking the entire time above.
      await game.act('PREVIOUS'); // -> round_intro(1)
      await game.act('PREVIOUS'); // -> reveal (round 0's last question)
      await game.act('PREVIOUS'); // -> reveal_intro (round 0)
      const backInBreak = await game.act('PREVIOUS'); // -> break (round 0)

      expect(backInBreak.progress.status).toBe('break');
      expect(backInBreak.phaseStartedAt).toBeNull();
      expect(backInBreak.phaseElapsedMs).toBe(70_000);
    });
  });
});
