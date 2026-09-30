import { SessionCloseBlockedError } from '@/game/state/game-state.service';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameStateService — session lifecycle admin surface (phase 4)', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let other: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
    // A second quiz in the same database, for the sessions created on top.
    other = await harness.createGateway({
      joinCode: 'OTHER1',
      rounds: [
        {
          title: 'Imported Round',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'Q', answer: 'A' }],
        },
      ],
    });
  });

  function createOtherSession() {
    return game.inRequestContext(() =>
      game.gameState.createSession(other.quizId),
    );
  }

  describe('listSessions', () => {
    it('lists the one session created at boot', () => {
      expect(game.gameState.listSessions()).toEqual([
        {
          joinCode: game.joinCode,
          quizId: game.quizId,
          status: 'lobby',
          teamCount: 0,
        },
      ]);
    });

    it('includes every concurrently-running session after creating another one', async () => {
      const created = await createOtherSession();

      expect(game.gameState.listSessions()).toEqual(
        expect.arrayContaining([
          {
            joinCode: game.joinCode,
            quizId: game.quizId,
            status: 'lobby',
            teamCount: 0,
          },
          {
            joinCode: created.joinCode,
            quizId: other.quizId,
            status: 'lobby',
            teamCount: 0,
          },
        ]),
      );
    });

    it("reflects each session's own status and roster size", async () => {
      await game.joinTeam('The Quizzards');
      await game.joinTeam('Pub Quiz Ninjas');
      await game.act('START_QUIZ');

      const [listed] = game.gameState.listSessions();

      expect(listed).toEqual({
        joinCode: game.joinCode,
        quizId: game.quizId,
        status: 'rules',
        teamCount: 2,
      });
    });
  });

  describe('closeSession', () => {
    it('rejects closing a session that has not ended yet', async () => {
      await createOtherSession();
      await game.act('START_QUIZ');

      expect(() => game.gameState.closeSession(game.joinCode)).toThrow(
        SessionCloseBlockedError,
      );
      expect(game.gameState.listSessions()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ joinCode: game.joinCode }),
        ]),
      );
    });

    it('evicts a session once it has ended', async () => {
      await createOtherSession();
      await game.act('START_QUIZ');
      await game.act('END_QUIZ');

      game.gameState.closeSession(game.joinCode);

      expect(
        game.gameState
          .listSessions()
          .some((session) => session.joinCode === game.joinCode),
      ).toBe(false);
      expect(() => game.gameState.getSnapshot(game.joinCode)).toThrow(
        /Unknown game session/,
      );
    });
  });
});
