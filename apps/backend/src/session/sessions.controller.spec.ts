import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActiveSessionSummary,
  StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import {
  SessionCloseBlockedError,
  type GameStateService,
} from '@/game/game-state.service';
import type { QuizService } from '@/quiz/quiz.service';
import { SessionsController } from '@/session/sessions.controller';

function makeController() {
  const gameState = {
    listSessions: jest.fn(),
    createSession: jest.fn(),
    hasSession: jest.fn(),
    closeSession: jest.fn(),
  };
  const quizService = { findTitles: jest.fn() };
  const controller = new SessionsController(
    gameState as unknown as GameStateService,
    quizService as unknown as QuizService,
  );
  return { controller, gameState, quizService };
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
    quizStructure: { blockCount: 1, topicsPerBlock: 1 },
    roundTitle: '',
    currentQuestion: null,
    blockQuestions: [],
    upcomingQuestions: [],
    revealQuestions: [],
    answeredTeamIds: [],
    leaderboard: [],
    leaderboardRevealCount: 0,
    joinCode: 'GHIJKL',
    teams: [],
    questionLockAt: null,
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
  it('protects list, create, and close with SessionGuard + RolesGuard', () => {
    for (const method of ['list', 'create', 'close'] as const) {
      const guards = methodGuards(method);
      expect(guards).toContain(SessionGuard);
      expect(guards).toContain(RolesGuard);
    }
  });

  it('leaves listPublic unguarded — /display has no admin login to offer', () => {
    expect(methodGuards('listPublic')).toEqual([]);
  });

  describe('listPublic', () => {
    it('returns every running session with its quiz title, no auth required', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
      ]);
      quizService.findTitles.mockResolvedValue(
        new Map([[1, 'Campus Pub Quiz Night']]),
      );

      const result = await controller.listPublic();

      expect(result).toEqual<ActiveSessionSummary[]>([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          quizTitle: 'Campus Pub Quiz Night',
          status: 'lobby',
          teamCount: 0,
        },
      ]);
    });
  });

  describe('list', () => {
    it('attaches each session its quiz title', async () => {
      const { controller, gameState, quizService } = makeController();
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

      const result = await controller.list();

      expect(quizService.findTitles).toHaveBeenCalledWith([1, 2]);
      expect(result).toEqual<ActiveSessionSummary[]>([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          quizTitle: 'Campus Pub Quiz Night',
          status: 'lobby',
          teamCount: 0,
        },
        {
          joinCode: 'GHIJKL',
          quizId: 2,
          quizTitle: 'Imported Quiz',
          status: 'question_open',
          teamCount: 3,
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
  });

  describe('create', () => {
    it('creates a session and returns its summary', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL', teams: [] }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));

      const result = await controller.create({ quizId: 2 });

      expect(gameState.createSession).toHaveBeenCalledWith(2);
      expect(result).toEqual<ActiveSessionSummary>({
        joinCode: 'GHIJKL',
        quizId: 2,
        quizTitle: 'Imported Quiz',
        status: 'lobby',
        teamCount: 0,
      });
    });

    it('rejects a body without a numeric quizId', async () => {
      const { controller } = makeController();

      await expect(controller.create({} as { quizId: number })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('close', () => {
    it('closes a known session', () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(true);

      controller.close('GHIJKL');

      expect(gameState.closeSession).toHaveBeenCalledWith('GHIJKL');
    });

    it('404s for an unknown join code', () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(false);

      expect(() => controller.close('NOPE12')).toThrow(NotFoundException);
      expect(gameState.closeSession).not.toHaveBeenCalled();
    });

    it('maps a blocked close to 409 conflict', () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(true);
      gameState.closeSession.mockImplementation(() => {
        throw new SessionCloseBlockedError('GHIJKL', 'still in progress');
      });

      expect(() => controller.close('GHIJKL')).toThrow(ConflictException);
    });

    it('lets unexpected errors bubble up unchanged', () => {
      const { controller, gameState } = makeController();
      gameState.hasSession.mockReturnValue(true);
      gameState.closeSession.mockImplementation(() => {
        throw new Error('db down');
      });

      expect(() => controller.close('GHIJKL')).toThrow('db down');
    });
  });
});
