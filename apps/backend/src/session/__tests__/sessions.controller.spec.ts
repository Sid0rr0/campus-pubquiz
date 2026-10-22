import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DEFAULT_SESSION_SETTINGS,
  type ActiveSessionSummary,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import type { SeedService } from '@/db/seed.service';
import {
  UnknownLiveSessionError,
  type LiveSessionRest,
} from '@/game/rest/live-session-rest.service';
import {
  QuizHasEmptyRoundError,
  SessionCloseBlockedError,
  SessionSettingsUpdateBlockedError,
  type GameStateService,
} from '@/game/state/game-state.service';
import {
  InvalidLeagueIdsError,
  SessionEndedError,
  type LeagueService,
} from '@/league/league.service';
import type { QuizService } from '@/quiz/quiz.service';
import { SessionsController } from '@/session/sessions.controller';

type LiveSessionRestParse = Parameters<
  LiveSessionRest['updateSettingsAndLeagues']
>[1];

function makeController() {
  const gameState = {
    listSessions: jest.fn(),
    createSession: jest.fn(),
  };
  const quizService = { findTitles: jest.fn() };
  // The real REST entry parses the request body once the session is known to
  // be live; this stand-in does the same, then records what it parsed.
  const settingsApplied = jest.fn();
  const rest = {
    closeSession: jest.fn(),
    updateSettingsAndLeagues: jest.fn(
      (joinCode: string, parseRequest: LiveSessionRestParse) => {
        const { partial, leagueIds } = parseRequest();
        settingsApplied(joinCode, partial, leagueIds);
        return Promise.resolve();
      },
    ),
  };
  const seedService = {
    findStartedAtByJoinCodes: jest.fn().mockResolvedValue(new Map()),
    findNamesByJoinCodes: jest.fn().mockResolvedValue(new Map()),
  };
  const leagues = {
    assertAssignable: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new SessionsController(
    gameState as unknown as GameStateService,
    quizService as unknown as QuizService,
    seedService as unknown as SeedService,
    leagues as unknown as LeagueService,
    rest as unknown as LiveSessionRest,
  );
  return {
    controller,
    gameState,
    quizService,
    rest,
    settingsApplied,
    seedService,
    leagues,
  };
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
      isJoinOverlayVisible: false,
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
    currentQuestion: null,
    blockQuestions: [],
    revealQuestions: [],
    leaderboard: [],
    joinCode: 'GHIJKL',
    teams: [],
    questionLockAt: null,
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

  it('lets a moderator create sessions and tick leagues', () => {
    for (const handler of ['create', 'updateSettings'] as const) {
      const context = {
        getHandler: () => SessionsController.prototype[handler],
        getClass: () => SessionsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 1, role: 'moderator' } }),
        }),
      } as unknown as ExecutionContext;
      expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
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
        [],
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
        [],
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
        [],
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
        [],
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

    it('ticks the requested leagues on the new session', async () => {
      const { controller, gameState, quizService, leagues } = makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL' }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));

      await controller.create({ quizId: 2, leagueIds: [4, 5] });

      expect(leagues.assertAssignable).toHaveBeenCalledWith([4, 5]);
      expect(gameState.createSession).toHaveBeenCalledWith(
        2,
        expect.anything(),
        undefined,
        [4, 5],
      );
    });

    it('ticks no league when none is ticked', async () => {
      const { controller, gameState, quizService } = makeController();
      gameState.createSession.mockResolvedValue(
        snapshot({ joinCode: 'GHIJKL' }),
      );
      quizService.findTitles.mockResolvedValue(new Map([[2, 'Imported Quiz']]));

      await controller.create({ quizId: 2 });

      expect(gameState.createSession).toHaveBeenCalledWith(
        2,
        expect.anything(),
        undefined,
        [],
      );
    });

    it('400s on an unknown or non-current league before creating the session', async () => {
      const { controller, gameState, leagues } = makeController();
      leagues.assertAssignable.mockRejectedValue(
        new InvalidLeagueIdsError([9]),
      );

      await expect(
        controller.create({ quizId: 2, leagueIds: [9] }),
      ).rejects.toThrow(BadRequestException);
      expect(gameState.createSession).not.toHaveBeenCalled();
    });

    it('400s with the round named when the quiz has a round with no questions', async () => {
      const { controller, gameState } = makeController();
      gameState.createSession.mockRejectedValue(
        new QuizHasEmptyRoundError(2, 'Music'),
      );

      await expect(controller.create({ quizId: 2 })).rejects.toThrow(
        new BadRequestException(
          'Cannot start a session: Round 2 "Music" has no questions',
        ),
      );
    });

    it('400s on a malformed leagueIds', async () => {
      const { controller, gameState } = makeController();

      for (const leagueIds of ['3', [1.5], [0], [-1], [1, 'x']]) {
        await expect(
          controller.create({
            quizId: 2,
            leagueIds: leagueIds as unknown as number[],
          }),
        ).rejects.toThrow(BadRequestException);
      }
      expect(gameState.createSession).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('makes one update call with the parsed settings', async () => {
      const { controller, settingsApplied } = makeController();

      await controller.updateSettings('GHIJKL', { lockGraceSeconds: 15 });

      expect(settingsApplied).toHaveBeenCalledWith(
        'GHIJKL',
        { lockGraceSeconds: 15 },
        undefined,
      );
    });

    it('404s for an unknown join code', async () => {
      const { controller, rest } = makeController();
      rest.updateSettingsAndLeagues.mockRejectedValue(
        new UnknownLiveSessionError('NOPE12'),
      );

      await expect(
        controller.updateSettings('NOPE12', { lockGraceSeconds: 15 }),
      ).rejects.toThrow(new NotFoundException('Unknown session "NOPE12"'));
    });

    it('400s on an invalid settings body for a live session, applying nothing', async () => {
      const { controller, settingsApplied } = makeController();

      await expect(
        controller.updateSettings('GHIJKL', { lockGraceSeconds: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(settingsApplied).not.toHaveBeenCalled();
    });

    it('404s for an unknown join code even when the body is invalid', async () => {
      const { controller, rest } = makeController();
      // The real REST entry refuses an unknown session before it parses the body.
      rest.updateSettingsAndLeagues.mockRejectedValue(
        new UnknownLiveSessionError('NOPE12'),
      );

      await expect(
        controller.updateSettings('NOPE12', { lockGraceSeconds: 0 }),
      ).rejects.toThrow(new NotFoundException('Unknown session "NOPE12"'));
    });

    it('maps a blocked update (game already started) to 409', async () => {
      const { controller, rest } = makeController();
      rest.updateSettingsAndLeagues.mockRejectedValue(
        new SessionSettingsUpdateBlockedError('GHIJKL', 'already started'),
      );

      await expect(
        controller.updateSettings('GHIJKL', { lockGraceSeconds: 15 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateSettings with leagueIds', () => {
    it('hands only leagueIds when only leagueIds is sent', async () => {
      const { controller, settingsApplied } = makeController();

      await controller.updateSettings('GHIJKL', { leagueIds: [4] });

      expect(settingsApplied).toHaveBeenCalledWith('GHIJKL', {}, [4]);
    });

    it('hands settings and leagues in the same call', async () => {
      const { controller, rest, settingsApplied } = makeController();

      await controller.updateSettings('GHIJKL', {
        lockGraceSeconds: 15,
        leagueIds: [],
      });

      expect(rest.updateSettingsAndLeagues).toHaveBeenCalledTimes(1);
      expect(settingsApplied).toHaveBeenCalledWith(
        'GHIJKL',
        { lockGraceSeconds: 15 },
        [],
      );
    });

    it('400s on a bad league id', async () => {
      const { controller, rest } = makeController();
      rest.updateSettingsAndLeagues.mockRejectedValue(
        new InvalidLeagueIdsError([9]),
      );

      await expect(
        controller.updateSettings('GHIJKL', {
          lockGraceSeconds: 15,
          leagueIds: [9],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('409s once the session has ended', async () => {
      const { controller, rest } = makeController();
      rest.updateSettingsAndLeagues.mockRejectedValue(
        new SessionEndedError('G'),
      );

      await expect(
        controller.updateSettings('GHIJKL', { leagueIds: [4] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('close', () => {
    it('makes one close call', async () => {
      const { controller, rest } = makeController();

      await controller.close('GHIJKL');

      expect(rest.closeSession).toHaveBeenCalledWith('GHIJKL');
    });

    it('404s for an unknown join code', async () => {
      const { controller, rest } = makeController();
      rest.closeSession.mockRejectedValue(
        new UnknownLiveSessionError('NOPE12'),
      );

      await expect(controller.close('NOPE12')).rejects.toThrow(
        new NotFoundException('Unknown session "NOPE12"'),
      );
    });

    it('maps a blocked close to 409 conflict', async () => {
      const { controller, rest } = makeController();
      rest.closeSession.mockRejectedValue(
        new SessionCloseBlockedError('GHIJKL', 'still in progress'),
      );

      await expect(controller.close('GHIJKL')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lets unexpected errors bubble up unchanged', async () => {
      const { controller, rest } = makeController();
      rest.closeSession.mockRejectedValue(new Error('db down'));

      await expect(controller.close('GHIJKL')).rejects.toThrow('db down');
    });
  });
});
