import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import type { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import { LeaguesController } from '@/league/leagues.controller';
import {
  LeagueNotFoundError,
  SessionNotEndedError,
  type LeagueService,
} from '@/league/league.service';

function makeController() {
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addSession: jest.fn(),
    removeSession: jest.fn(),
    move: jest.fn(),
  };
  const rest = {
    refreshLeagueLobbies: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new LeaguesController(
    service as unknown as LeagueService,
    rest as unknown as LiveSessionRest,
  );
  return { controller, service, rest };
}

const valid = { name: 'Autumn', startsOn: '2026-09-01', endsOn: '2026-12-20' };

/** Whether the real RolesGuard lets a user of this role reach the handler. */
function allows(handlerName: keyof LeaguesController, role: UserRole): boolean {
  const handler = LeaguesController.prototype[handlerName];
  const context = {
    getHandler: () => handler,
    getClass: () => LeaguesController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 1, role } }),
    }),
  } as unknown as ExecutionContext;
  return new RolesGuard(new Reflector()).canActivate(context);
}

describe('LeaguesController', () => {
  it('sits behind SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', LeaguesController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('lets a moderator read but not write', () => {
    expect(allows('list', 'moderator')).toBe(true);
    for (const write of [
      'create',
      'update',
      'remove',
      'addSession',
      'removeSession',
      'move',
    ] as const) {
      expect(allows(write, 'moderator')).toBe(false);
      expect(allows(write, 'admin')).toBe(true);
    }
  });

  describe('list', () => {
    it('passes the current filter through', async () => {
      const { controller, service } = makeController();
      service.list.mockResolvedValue({ items: [] });

      await controller.list({ current: 'true' });
      await controller.list({});

      expect(service.list).toHaveBeenNthCalledWith(1, { current: true });
      expect(service.list).toHaveBeenNthCalledWith(2, { current: false });
    });

    it('rejects a junk current value', async () => {
      const { controller } = makeController();
      await expect(controller.list({ current: 'maybe' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('move', () => {
    it('passes the direction to the service', async () => {
      const { controller, service } = makeController();

      await controller.move(3, { direction: 'up' });

      expect(service.move).toHaveBeenCalledWith(3, 'up');
    });

    it('rejects a missing or unknown direction', async () => {
      const { controller, service } = makeController();

      await expect(controller.move(3, {})).rejects.toThrow(BadRequestException);
      await expect(controller.move(3, { direction: 'left' })).rejects.toThrow(
        BadRequestException,
      );
      expect(service.move).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown league', async () => {
      const { controller, service } = makeController();
      service.move.mockRejectedValue(new LeagueNotFoundError(9));

      await expect(controller.move(9, { direction: 'down' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create and update validation', () => {
    it('creates with trimmed name', async () => {
      const { controller, service } = makeController();
      service.create.mockResolvedValue({ id: 1 });

      await controller.create({ ...valid, name: '  Autumn  ' });

      expect(service.create).toHaveBeenCalledWith(valid);
    });

    it.each([
      ['a blank name', { ...valid, name: '   ' }],
      ['a missing name', { startsOn: valid.startsOn, endsOn: valid.endsOn }],
      ['a malformed date', { ...valid, startsOn: '1 Sept' }],
      ['an end before the start', { ...valid, endsOn: '2026-08-31' }],
    ])('rejects %s on create and update', async (_label, body) => {
      const { controller, service } = makeController();

      await expect(controller.create(body)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.update(1, body)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.create).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    });

    it('accepts a one-day league', async () => {
      const { controller, service } = makeController();
      service.create.mockResolvedValue({ id: 1 });

      await controller.create({ ...valid, endsOn: valid.startsOn });

      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('lobby league refresh', () => {
    it.each([
      ['update', (c: LeaguesController) => c.update(1, valid)],
      ['remove', (c: LeaguesController) => c.remove(1)],
      [
        'addSession',
        (c: LeaguesController) => c.addSession(1, { gameSessionId: 4 }),
      ],
      ['removeSession', (c: LeaguesController) => c.removeSession(1, 4)],
    ])('refreshes the league lobbies once after %s', async (_name, act) => {
      const { controller, rest } = makeController();

      await act(controller);

      expect(rest.refreshLeagueLobbies).toHaveBeenCalledTimes(1);
    });

    it('refreshes nothing when the change was refused', async () => {
      const { controller, service, rest } = makeController();
      service.addSession.mockRejectedValue(new SessionNotEndedError(4));

      await expect(
        controller.addSession(1, { gameSessionId: 4 }),
      ).rejects.toThrow(ConflictException);

      expect(rest.refreshLeagueLobbies).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it('an unknown league is a 404', async () => {
      const { controller, service } = makeController();
      service.update.mockRejectedValue(new LeagueNotFoundError(9));
      service.remove.mockRejectedValue(new LeagueNotFoundError(9));

      await expect(controller.update(9, valid)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.remove(9)).rejects.toThrow(NotFoundException);
    });

    it('adding a live session is a 409', async () => {
      const { controller, service } = makeController();
      service.addSession.mockRejectedValue(new SessionNotEndedError(4));

      await expect(
        controller.addSession(1, { gameSessionId: 4 }),
      ).rejects.toThrow(ConflictException);
    });

    it('adding needs a numeric gameSessionId', async () => {
      const { controller } = makeController();

      await expect(controller.addSession(1, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.addSession(1, { gameSessionId: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
