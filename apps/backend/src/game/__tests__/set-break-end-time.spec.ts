import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type GameAction,
  type SocketRoomName,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const BREAK_ENDS_AT = 1_700_000_000_000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

describe('GameGateway — set break end time', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function lastState(room: SocketRoomName) {
    return game
      .payloadsTo<StateSnapshotPayload>(room, SOCKET_EVENTS.STATE_UPDATED)
      .at(-1);
  }

  describe('the SET_BREAK_END_TIME event', () => {
    beforeEach(async () => {
      game = await harness.createGateway();
    });

    it('sets breakEndsAt and broadcasts it to every room', async () => {
      const admin = await game.connectAdmin();
      game.clearEmits();

      await game.gateway.handleSetBreakEndTime(asSocket(admin), {
        breakEndsAt: BREAK_ENDS_AT,
      });

      for (const room of [
        SOCKET_ROOMS.DISPLAY,
        SOCKET_ROOMS.ADMIN,
        SOCKET_ROOMS.PLAYERS,
      ]) {
        expect(lastState(room)?.breakEndsAt).toBe(BREAK_ENDS_AT);
      }
    });

    it('clears breakEndsAt when sent null', async () => {
      const admin = await game.connectAdmin();
      await game.gateway.handleSetBreakEndTime(asSocket(admin), {
        breakEndsAt: BREAK_ENDS_AT,
      });

      await game.gateway.handleSetBreakEndTime(asSocket(admin), {
        breakEndsAt: null,
      });

      expect(lastState(SOCKET_ROOMS.ADMIN)?.breakEndsAt).toBeNull();
    });

    it('rejects SET_BREAK_END_TIME from a non-admin client', async () => {
      const player = await game.connectPlayer();

      await expect(
        game.gateway.handleSetBreakEndTime(asSocket(player), {
          breakEndsAt: BREAK_ENDS_AT,
        }),
      ).resolves.toMatchObject({ success: false });
      expect((await game.snapshot()).breakEndsAt).toBeNull();
    });

    it('rejects a non-numeric, non-null breakEndsAt payload', async () => {
      const admin = await game.connectAdmin();

      await expect(
        game.gateway.handleSetBreakEndTime(asSocket(admin), {
          breakEndsAt: 'soon',
        }),
      ).resolves.toMatchObject({ success: false });
      expect((await game.snapshot()).breakEndsAt).toBeNull();
    });
  });

  // A quiz with two separate breakAfter rounds (unlike the shared one-block
  // fixtures) so this suite can drive the session through two full break
  // cycles — the only way to exercise the "a *second* fresh break clears a
  // leftover end-time from the first" reset path.
  describe('breakEndsAt reset on a fresh break', () => {
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
    });

    async function actAll(actions: GameAction[]) {
      let snapshot = await game.snapshot();
      for (const action of actions) {
        snapshot = await game.act(action);
      }
      return snapshot;
    }

    async function setBreakEnd(breakEndsAt: number): Promise<void> {
      const admin = await game.connectAdmin();
      await game.gateway.handleSetBreakEndTime(asSocket(admin), {
        breakEndsAt,
      });
    }

    it('carries a set end-time through the same break, then clears it once a second break starts fresh', async () => {
      const firstBreak = await actAll([
        'START_QUIZ', // -> rules
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1 (question_open)
        'ADVANCE', // -> locking (last q, breakAfter)
        'ADVANCE', // -> break_intro
      ]);
      expect(firstBreak.progress.status).toBe('break_intro');
      expect(firstBreak.breakEndsAt).toBeNull();

      await setBreakEnd(555);
      expect((await game.snapshot()).breakEndsAt).toBe(555);

      const stillInBreak = await game.act('PREVIOUS'); // -> break (same cycle)
      expect(stillInBreak.progress.status).toBe('break');
      expect(stillInBreak.breakEndsAt).toBe(555);

      const secondBreak = await actAll([
        'ADVANCE', // -> reveal_intro
        'ADVANCE', // -> reveal
        'ADVANCE', // -> round_intro(1), behind the end-of-block board
        'TOGGLE_LEADERBOARD', // hides the board
        'ADVANCE', // -> r2q1 (question_open)
        'ADVANCE', // -> locking
        'ADVANCE', // -> break_intro (fresh)
      ]);

      expect(secondBreak.progress.status).toBe('break_intro');
      expect(secondBreak.breakEndsAt).toBeNull();
    });

    it('keeps a future end-time the admin set in advance, while still on the last question, once the break actually starts', async () => {
      const locking = await actAll([
        'START_QUIZ', // -> rules
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1 (question_open)
        'ADVANCE', // -> locking (last q, breakAfter)
      ]);
      expect(locking.progress.status).toBe('locking');

      const futureEndsAt = Date.now() + TEN_MINUTES_MS;
      await setBreakEnd(futureEndsAt);
      expect((await game.snapshot()).breakEndsAt).toBe(futureEndsAt);

      const firstBreak = await game.act('ADVANCE'); // -> break_intro
      expect(firstBreak.progress.status).toBe('break_intro');
      expect(firstBreak.breakEndsAt).toBe(futureEndsAt);
    });
  });
});
