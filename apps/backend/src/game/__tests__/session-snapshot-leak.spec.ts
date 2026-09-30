import {
  SOCKET_ROOMS,
  sessionRoom,
  type GameAction,
} from '@campus-pubquiz/types';
import {
  TWO_ROUND_QUIZ,
  TWO_ROUND_QUIZ_HOST_NOTE,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

// Regression test for the leak this feature's design doc explicitly calls
// out: toRevealQuestionViews (block-questions.util.ts) builds
// revealQuestions/pastRevealedQuestions via a blind `{...question}` spread,
// not a field whitelist. If a question's host-only note or the presenter's
// next-question preview were ever stored *on* a question object (instead of
// SeededRound.questionNotesById, a sibling field never spread into a view),
// it would leak into the tri-room broadcast snapshot — reaching /display and
// every connected phone. Asserted on the serialized JSON, not just types,
// since this is a runtime spread issue types can't catch.
describe('GameGateway — presenter-only content never leaks into the broadcast payload', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
  });

  it('never contains note text or a "questionNotesById"/"nextScreen" key at any point across the whole quiz', async () => {
    const actions: GameAction[] = [
      'START_QUIZ',
      'ADVANCE', // round_intro(0)
      'ADVANCE', // r1q1 — currentQuestion
      'ADVANCE', // r1q2
      'ADVANCE', // round_intro(1)
      'ADVANCE', // r2q1
      'ADVANCE', // r2q2
      'ADVANCE', // locking
      'ADVANCE', // break_intro — blockQuestions now the full, just-locked block
      'ADVANCE', // reveal_intro
      'ADVANCE', // reveal — revealQuestions populated
    ];

    for (const action of actions) {
      await game.act(action);
      // Everything /display and the phones received for this action (the
      // admin room legitimately gets the presenter context), plus what a
      // client connecting right now is handed.
      const sharedRooms = [SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.PLAYERS].map(
        (room) => sessionRoom(game.joinCode, room),
      );
      const serialized = JSON.stringify([
        await game.snapshot(),
        game
          .roomEmits()
          .filter(({ rooms }) =>
            rooms.some((room) => sharedRooms.includes(room)),
          )
          .map(({ payload }) => payload),
      ]);

      expect(serialized).not.toContain(TWO_ROUND_QUIZ_HOST_NOTE);
      expect(serialized).not.toContain('questionNotesById');
      expect(serialized).not.toContain('nextScreen');
      game.clearEmits();
    }
  });
});
