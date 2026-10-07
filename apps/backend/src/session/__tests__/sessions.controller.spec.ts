import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_DISPLAY_TEXT_SCALE,
  DEFAULT_SESSION_SETTINGS,
  type ActiveSessionSummary,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import type { SeedService } from '@/db/seed.service';
import type { GameGateway } from '@/game/game.gateway';
import {
  SessionCloseBlockedError,
  SessionSettingsUpdateBlockedError,
  type GameStateService,
} from '@/game/state/game-state.service';
import type { QuizService } from '@/quiz/quiz.service';
import { SessionsController } from '@/session/sessions.controller';

function makeController() {
  const gameState = {
    listSessions: jest.fn(),
    createSession: jest.fn(),
    hasSession: jest.fn(),
    closeSession: jest.fn(),
    updateSessionSettings: jest.fn(),
  };
  const quizService = { findTitles: jest.fn() };
  const gameGateway = {
    notifySessionClosed: jest.fn(),
    notifySettingsUpdated: jest.fn(),
  };
  const seedService = {
    findStartedAtByJoinCodes: jest.fn().mockResolvedValue(new Map()),
    findNamesByJoinCodes: jest.fn().mockResolvedValue(new Map()),
  };
  const controller = new SessionsController(
    gameState as unknown as GameStateService,
    quizService as unknown as QuizService,
    gameGateway as unknown as GameGateway,
    seedService as unknown as SeedService,
  );
  return { controller, gameState, quizService, gameGateway, seedService };
}

function snapshot(
  overrides: Partial<StateSnapshotPayload> = {},
): StateSnapshotPayload {
  return {
    progress: {
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    },
    quizStructure: {
      blockCount: 1,
      topicsPerBlock: 1,
      breakRoundNumbers: [1],
      minQuestionsPerTopic: 1,
      maxQuestionsPerTopic: 1,
    },
    roundTitle: '',
    isCurrentRoundKahoot: false,
    roundTitles: [],
    currentQuestion: null,
    blockQuestions: [],
    revealQuestions: [],
    answeredTeamIds: [],
    leaderboard: [],
    joinCode: 'GHIJKL',
    teams: [],
    questionLockAt: null,
    closestGuessRevealStep: 0,
    breakEndsAt: null,
    displayTextScale: DEFAULT_DISPLAY_TEXT_SCALE,
    settings: DEFAULT_SESSION_SETTINGS,
    activeShowdown: null,
    showdownRevealStep: 0,
    ...overrides,
  };
}

function methodGuards(propertyKey: keyof SessionsController): unknown[] {
  return (Reflect.getMetadata(
    '__guards__',
    SessionsController.prototype[propertyKey],
  ) ?? []) as unknown[];
}

describe('SessionsController', () => {
  it('protects list, create, close, and updateSettings with SessionGuard + RolesGuard', () => {
    for (const method of [
      'list',
      'create',
      'close',
      'updateSettings',
    ] as const) {
      const guards = methodGuards(method);
      expect(guards).toContain(SessionGuard);
      expect(guards).toContain(RolesGuard);
    }
  });

  it('leaves listPublic unguarded — /display has no admin login to offer', () => {
    expect(methodGuards('listPublic')).toEqual([]);
  });

  describe('listPublic', () => {
    it('returns every running session with its quiz title and start time, no auth required', async () => {
      const { controller, gameState, quizService, seedService } =
        makeController();
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
      ]);
      quizService.findTitles.mockResolvedValue(
        new Map([[1, 'Campus Pub Quiz Night']]),
      );
      seedService.findStartedAtByJoinCodes.mockResolvedValue(
        new Map([['ABCDEF', new Date('2026-09-16T12:00:00.000Z')]]),
      );

      const result = await controller.listPublic();

      expect(result).toEqual<ActiveSessionSummary[]>([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          quizTitle: 'Campus Pub Quiz Night',
          name: 'Campus Pub Quiz Night',
          status: 'lobby',
          teamCount: 0,
          startedAt: '2026-09-16T12:00:00.000Z',
        },
      ]);
    });
  });

  describe('list', () => {
    it('attaches each session its quiz title and start time', async () => {
      const { controller, gameState, quizService, seedService } =
        makeController();
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
        {
          joinCode: 'GHIJKL',
          quizId: 2,
          status: 'question_open',
          teamCount: 3,
        },
      ]);
      quizService.findTitles.mockResolvedValue(
        new Map([
          [1, 'Campus Pub Quiz Night'],
          [2, 'Imported Quiz'],
        ]),
      );
      seedService.findStartedAtByJoinCodes.mockResolvedValue(
        new Map([
          ['ABCDEF', new Date('2026-09-16T12:00:00.000Z')],
          ['GHIJKL', new Date('2026-09-16T13:00:00.000Z')],
        ]),
      );

      const result = await controller.list();

      expect(quizService.findTitles).toHaveBeenCalledWith([1, 2]);
      expect(seedService.findStartedAtByJoinCodes).toHaveBeenCalledWith([
        'ABCDEF',
        'GHIJKL',
      ]);
      expect(result).toEqual<ActiveSessionSummary[]>([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          quizTitle: 'Campus Pub Quiz Night',
          name: 'Campus Pub Quiz Night',
          status: 'lobby',
          teamCount: 0,
          startedAt: '2026-09-16T12:00:00.000Z',
        },
        {
          joinCode: 'GHIJKL',
          quizId: 2,
          quizTitle: 'Imported Quiz',
          name: 'Imported Quiz',
          status: 'question_open',
          teamCount: 3,
          startedAt: '2026-09-16T13:00:00.000Z',
        },
      ]);
    });

    it('falls back to a placeholder title when the quiz lookup misses', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
      ]);
      quizService.findTitles.mockResolvedValue(new Map());

      const [result] = await controller.list();

      expect(result.quizTitle).toBe('Unknown quiz');
    });

    it("uses the session's custom display name when one was set, over the quiz title", async () => {
      const { controller, gameState, quizService, seedService } =
        makeController();
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
      ]);
      quizService.findTitles.mockResolvedValue(
        new Map([[1, 'Campus Pub Quiz Night']]),
      );
      seedService.findNamesByJoinCodes.mockResolvedValue(
        new Map([['ABCDEF', 'Week 3 Social']]),
      );

      const [result] = await controller.list();

      expect(result.name).toBe('Week 3 Social');
    });

    it('falls back to the quiz title when no custom name was set', async () => {
      const { controller, gameState, quizService, seedService } =
        makeController();
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
      ]);
      quizService.findTitles.mockResolvedValue(
        new Map([[1, 'Campus Pub Quiz Night']]),
      );
      seedService.findNamesByJoinCodes.mockResolvedValue(
        new Map([['ABCDEF', null]]),
      );

      const [result] = await controller.list();

      expect(result.name).toBe('Campus Pub Quiz Night');
    });
  });

  describe('create', () => {
    it('creates a session and returns its summary', async () => {
      const { controller, gameState, quizService, seedService } =
        makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL', teams: [] }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));
      seedService.findStartedAtByJoinCodes.mockResolvedValue(
        new Map([['GHIJKL', new Date('2026-09-16T12:00:00.000Z')]]),
      );

      const result = await controller.create({ quizId: 2 });

      expect(gameState.createSession).toHaveBeenCalledWith(
        2,
        DEFAULT_SESSION_SETTINGS,
        undefined,
      );
      expect(seedService.findStartedAtByJoinCodes).toHaveBeenCalledWith([
        'GHIJKL',
      ]);
      expect(result).toEqual<ActiveSessionSummary>({
        joinCode: 'GHIJKL',
        quizId: 2,
        quizTitle: 'Imported Quiz',
        name: 'Imported Quiz',
        status: 'lobby',
        teamCount: 0,
        startedAt: '2026-09-16T12:00:00.000Z',
      });
    });

    it('passes a trimmed custom name through and uses it in the response', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL', teams: [] }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));

      const result = await controller.create({
        quizId: 2,
        name: '  Week 3 Social  ',
      });

      expect(gameState.createSession).toHaveBeenCalledWith(
        2,
        DEFAULT_SESSION_SETTINGS,
        'Week 3 Social',
      );
      expect(result.name).toBe('Week 3 Social');
    });

    it('treats a blank name as absent, defaulting to the quiz title', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL', teams: [] }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));

      const result = await controller.create({ quizId: 2, name: '   ' });

      expect(gameState.createSession).toHaveBeenCalledWith(
        2,
        DEFAULT_SESSION_SETTINGS,
        undefined,
      );
      expect(result.name).toBe('Imported Quiz');
    });

    it('resolves a partial settings override over the defaults', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL' }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));

      await controller.create({
        quizId: 2,
        settings: { lockGraceSeconds: 15 },
      });

      expect(gameState.createSession).toHaveBeenCalledWith(
        2,
        { ...DEFAULT_SESSION_SETTINGS, lockGraceSeconds: 15 },
        undefined,
      );
    });

    it('rejects an invalid settings override', async () => {
      const { controller } = makeController();

      await expect(
        controller.create({ quizId: 2, settings: { lockGraceSeconds: -5 } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a body without a numeric quizId', async () => {
      const { controller } = makeController();

      await expect(controller.create({} as { quizId: number })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateSettings', () => {
    it('updates settings and notifies clients while in the lobby', async () => {
      const { controller, gameState, gameGateway } = makeController();
      gameState.hasSession.mockReturnValue(true);

      await controller.updateSettings('GHIJKL', { lockGraceSeconds: 15 });

      expect(gameState.updateSessionSettings).toHaveBeenCalledWith('GHIJKL', {
        lockGraceSeconds: 15,
      });
      expect(gameGateway.notifySettingsUpdated).toHaveBeenCalledWith('GHIJKL');
    });

    it('404s for an unknown join code', async () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(false);

      await expect(
        controller.updateSettings('NOPE12', { lockGraceSeconds: 15 }),
      ).rejects.toThrow(NotFoundException);
      expect(gameState.updateSessionSettings).not.toHaveBeenCalled();
    });

    it('rejects an invalid settings body before calling GameStateService', async () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(true);

      await expect(
        controller.updateSettings('GHIJKL', { lockGraceSeconds: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(gameState.updateSessionSettings).not.toHaveBeenCalled();
    });

    it('maps a blocked update (game already started) to 409 without notifying clients', async () => {
      const { controller, gameState, gameGateway } = makeController();
      gameState.hasSession.mockReturnValue(true);
      gameState.updateSessionSettings.mockRejectedValue(
        new SessionSettingsUpdateBlockedError('GHIJKL', 'already started'),
      );

      await expect(
        controller.updateSettings('GHIJKL', { lockGraceSeconds: 15 }),
      ).rejects.toThrow(ConflictException);
      expect(gameGateway.notifySettingsUpdated).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes a known session', async () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(true);

      await controller.close('GHIJKL');

      expect(gameState.closeSession).toHaveBeenCalledWith('GHIJKL');
    });

    it('notifies connected players once the session is evicted', async () => {
      const { controller, gameState, gameGateway } = makeController();
      gameState.hasSession.mockReturnValue(true);

      await controller.close('GHIJKL');

      expect(gameGateway.notifySessionClosed).toHaveBeenCalledWith('GHIJKL');
    });

    it('404s for an unknown join code', async () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(false);

      await expect(controller.close('NOPE12')).rejects.toThrow(
        NotFoundException,
      );
      expect(gameState.closeSession).not.toHaveBeenCalled();
    });

    it('maps a blocked close to 409 conflict without notifying players', async () => {
      const { controller, gameState, gameGateway } = makeController();
      gameState.hasSession.mockReturnValue(true);
      gameState.closeSession.mockImplementation(() => {
        throw new SessionCloseBlockedError('GHIJKL', 'still in progress');
      });

      await expect(controller.close('GHIJKL')).rejects.toThrow(
        ConflictException,
      );
      expect(gameGateway.notifySessionClosed).not.toHaveBeenCalled();
    });

    it('404s when the session was closed by a close that ran first', async () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValueOnce(true).mockReturnValue(false);
      gameState.closeSession.mockRejectedValue(
        new Error('Unknown game session for join code "GHIJKL"'),
      );

      await expect(controller.close('GHIJKL')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets unexpected errors bubble up unchanged', async () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(true);
      gameState.closeSession.mockImplementation(() => {
        throw new Error('db down');
      });

      await expect(controller.close('GHIJKL')).rejects.toThrow('db down');
    });
  });
});
