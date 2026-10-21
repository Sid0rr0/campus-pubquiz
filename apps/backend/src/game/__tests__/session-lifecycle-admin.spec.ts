import { GameSession } from '@/db/entities/game-session.entity';
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

  async function rowCreatedAt(joinCode: string): Promise<string> {
    const row = await game.orm.em
      .fork()
      .findOneOrFail(GameSession, { joinCode });
    return row.createdAt.toISOString();
  }

  describe('listSessions', () => {
    it('lists the session created at boot with its summary', async () => {
      expect(game.gameState.listSessions()).toEqual([
        {
          joinCode: game.joinCode,
          quizId: game.quizId,
          quizTitle: 'Real Store Quiz',
          name: 'Real Store Quiz',
          status: 'lobby',
          teamCount: 0,
          startedAt: await rowCreatedAt(game.joinCode),
        },
      ]);
    });

    it('includes every concurrently-running session after creating another one', async () => {
      const created = await createOtherSession();

      expect(game.gameState.listSessions()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            joinCode: game.joinCode,
            quizId: game.quizId,
          }),
          expect.objectContaining({
            joinCode: created.joinCode,
            quizId: other.quizId,
          }),
        ]),
      );
    });

    it("reflects each session's own status and roster size", async () => {
      await game.joinTeam('The Quizzards');
      await game.joinTeam('Pub Quiz Ninjas');
      await game.act('START_QUIZ');

      const [listed] = game.gameState.listSessions();

      expect(listed).toMatchObject({
        joinCode: game.joinCode,
        status: 'rules',
        teamCount: 2,
      });
    });

    it('shows a quiz rename made through the Live edit save on a lobby session', async () => {
      await game.saveQuizEdit(undefined, 'Renamed Quiz');

      expect(game.gameState.listSessions()[0]).toMatchObject({
        quizTitle: 'Renamed Quiz',
        name: 'Renamed Quiz',
      });
    });

    it('keeps the start time and custom name across a restart', async () => {
      const created = await game.inRequestContext(() =>
        game.gameState.createSession(other.quizId, undefined, 'Week 3 Social'),
      );

      const restarted = await game.restart();

      const listed = restarted.gameState
        .listSessions()
        .find((session) => session.joinCode === created.joinCode);
      expect(listed).toEqual(created);
      expect(listed?.name).toBe('Week 3 Social');
    });
  });

  describe('renameHeldSession (a stats rename reaching the picker)', () => {
    it('shows the new name on the next list, and the quiz title once cleared', async () => {
      const gameSessionId = game.gameState.getGameSessionId(game.joinCode);

      await game.gameState.renameHeldSession(gameSessionId, 'Week 3 Social');
      expect(game.gameState.listSessions()[0]).toMatchObject({
        quizTitle: 'Real Store Quiz',
        name: 'Week 3 Social',
      });

      await game.gameState.renameHeldSession(gameSessionId, null);
      expect(game.gameState.listSessions()[0]).toMatchObject({
        name: 'Real Store Quiz',
      });
    });

    it('leaves status and team count alone', async () => {
      await game.joinTeam('The Quizzards');
      const before = game.gameState.listSessions()[0];

      await game.gameState.renameHeldSession(
        game.gameState.getGameSessionId(game.joinCode),
        'Renamed',
      );

      expect(game.gameState.listSessions()[0]).toEqual({
        ...before,
        name: 'Renamed',
      });
    });

    it('resolves for a session that is not held, changing nothing', async () => {
      const before = game.gameState.listSessions();

      await expect(
        game.gameState.renameHeldSession(999999, 'Gone'),
      ).resolves.toBeUndefined();

      expect(game.gameState.listSessions()).toEqual(before);
    });
  });

  describe('createSession', () => {
    it('returns the quiz title as the name when none was given, and the row creation time', async () => {
      const created = await createOtherSession();

      expect(created).toEqual({
        joinCode: created.joinCode,
        quizId: other.quizId,
        quizTitle: 'Real Store Quiz',
        name: 'Real Store Quiz',
        status: 'lobby',
        teamCount: 0,
        startedAt: await rowCreatedAt(created.joinCode),
      });
    });

    it('returns the trimmed custom name when one was given', async () => {
      const created = await game.inRequestContext(() =>
        game.gameState.createSession(
          other.quizId,
          undefined,
          '  Week 3 Social  ',
        ),
      );

      expect(created.name).toBe('Week 3 Social');
      expect(created.quizTitle).toBe('Real Store Quiz');
    });

    it('agrees with the next list', async () => {
      const created = await createOtherSession();

      expect(
        game.gameState
          .listSessions()
          .find((session) => session.joinCode === created.joinCode),
      ).toEqual(created);
    });
  });

  describe('closeSession', () => {
    it('rejects closing a session that has not ended yet', async () => {
      await createOtherSession();
      await game.act('START_QUIZ');

      await expect(game.gameState.closeSession(game.joinCode)).rejects.toThrow(
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

      await game.gameState.closeSession(game.joinCode);

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
