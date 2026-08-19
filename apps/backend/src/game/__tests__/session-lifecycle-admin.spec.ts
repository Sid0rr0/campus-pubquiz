import {
  GameStateService,
  SessionCloseBlockedError,
} from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
} from './test-utils';

describe('GameStateService — session lifecycle admin surface (phase 4)', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  describe('listSessions', () => {
    it('lists the one session created at boot', () => {
      expect(service.listSessions()).toEqual([
        { joinCode, quizId: 1, status: 'lobby', teamCount: 0 },
      ]);
    });

    it('includes every concurrently-running session after creating another one', async () => {
      const created = await service.createSession(2);

      expect(service.listSessions()).toEqual(
        expect.arrayContaining([
          { joinCode, quizId: 1, status: 'lobby', teamCount: 0 },
          {
            joinCode: created.joinCode,
            quizId: 2,
            status: 'lobby',
            teamCount: 0,
          },
        ]),
      );
    });

    it("reflects each session's own status and roster size", async () => {
      await service.applyAction(joinCode, 'START_QUIZ');
      service.setTeams(joinCode, [
        { teamId: 31, teamName: 'The Quizzards' },
        { teamId: 32, teamName: 'Pub Quiz Ninjas' },
      ]);

      const [listed] = service.listSessions();

      expect(listed).toEqual({
        joinCode,
        quizId: 1,
        status: 'rules',
        teamCount: 2,
      });
    });
  });

  describe('closeSession', () => {
    it('rejects closing a session that has not ended yet', async () => {
      await service.createSession(2);
      await service.applyAction(joinCode, 'START_QUIZ');

      expect(() => service.closeSession(joinCode)).toThrow(
        SessionCloseBlockedError,
      );
      expect(service.listSessions()).toEqual(
        expect.arrayContaining([expect.objectContaining({ joinCode })]),
      );
    });

    it('evicts a session once it has ended', async () => {
      await service.createSession(2);
      await service.applyAction(joinCode, 'START_QUIZ');
      await service.applyAction(joinCode, 'END_QUIZ');

      service.closeSession(joinCode);

      expect(
        service.listSessions().some((session) => session.joinCode === joinCode),
      ).toBe(false);
      expect(() => service.getSnapshot(joinCode)).toThrow(
        /Unknown game session/,
      );
    });
  });
});
