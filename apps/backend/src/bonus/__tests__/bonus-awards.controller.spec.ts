import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { BonusAwardAdminView } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import {
  BonusAwardMutationsController,
  BonusAwardsController,
} from '@/bonus/bonus-awards.controller';
import {
  BonusAwardNotFoundError,
  BonusService,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import type { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import type { SessionOutcome } from '@/game/state/session-outcome';
import type { GameStateService } from '@/game/state/game-state.service';

function makeListController() {
  const bonusService = { listForTeamAdmin: jest.fn() };
  const gameState = { hasSession: jest.fn(), getGameSessionId: jest.fn() };
  const controller = new BonusAwardsController(
    bonusService as unknown as BonusService,
    gameState as unknown as GameStateService,
  );
  return { controller, bonusService, gameState };
}

const BONUS_CHANGED_OUTCOME = {
  marker: 'bonus-changed',
} as unknown as SessionOutcome;

function makeMutationsController() {
  const bonusService = { update: jest.fn(), remove: jest.fn() };
  const gameState = {
    hasSession: jest.fn(),
    getGameSessionId: jest.fn(),
    bonusChanged: jest.fn().mockResolvedValue(BONUS_CHANGED_OUTCOME),
  };
  const broadcaster = { deliver: jest.fn().mockResolvedValue(undefined) };
  const controller = new BonusAwardMutationsController(
    bonusService as unknown as BonusService,
    gameState as unknown as GameStateService,
    broadcaster as unknown as SessionBroadcaster,
  );
  return { controller, bonusService, gameState, broadcaster };
}

const award: BonusAwardAdminView = {
  id: 9,
  category: 'shot',
  points: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('BonusAwardsController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', BonusAwardsController) as
      | unknown[]
      | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('returns the awards list for a known session/team', async () => {
    const { controller, bonusService, gameState } = makeListController();
    gameState.hasSession.mockReturnValue(true);
    gameState.getGameSessionId.mockReturnValue(101);
    bonusService.listForTeamAdmin.mockResolvedValue([award]);

    const result = await controller.list('ABCDEF', 31);

    expect(gameState.getGameSessionId).toHaveBeenCalledWith('ABCDEF');
    expect(bonusService.listForTeamAdmin).toHaveBeenCalledWith(101, 31);
    expect(result).toEqual({ teamId: 31, awards: [award] });
  });

  it('404s for an unknown join code', async () => {
    const { controller, gameState, bonusService } = makeListController();
    gameState.hasSession.mockReturnValue(false);

    await expect(controller.list('NOPE12', 31)).rejects.toThrow(
      NotFoundException,
    );
    expect(bonusService.listForTeamAdmin).not.toHaveBeenCalled();
  });
});

describe('BonusAwardMutationsController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      BonusAwardMutationsController,
    ) as unknown[] | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  describe('update', () => {
    it('updates the award and runs the bonus-changed write and delivers its outcome', async () => {
      const { controller, bonusService, gameState, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(true);
      gameState.getGameSessionId.mockReturnValue(101);
      bonusService.update.mockResolvedValue(award);

      const result = await controller.update('ABCDEF', 9, {
        points: 3,
        reason: undefined,
      });

      expect(bonusService.update).toHaveBeenCalledWith(101, 9, 3, undefined);
      expect(gameState.bonusChanged).toHaveBeenCalledWith('ABCDEF');
      expect(broadcaster.deliver).toHaveBeenCalledWith(
        'ABCDEF',
        BONUS_CHANGED_OUTCOME,
      );
      expect(result).toEqual(award);
    });

    it('404s for an unknown join code', async () => {
      const { controller, gameState, bonusService, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(false);

      await expect(
        controller.update('NOPE12', 9, { points: 3 }),
      ).rejects.toThrow(NotFoundException);
      expect(bonusService.update).not.toHaveBeenCalled();
      expect(gameState.bonusChanged).not.toHaveBeenCalled();
      expect(broadcaster.deliver).not.toHaveBeenCalled();
    });

    it('maps BonusAwardNotFoundError to a 404', async () => {
      const { controller, gameState, bonusService, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(true);
      gameState.getGameSessionId.mockReturnValue(101);
      bonusService.update.mockRejectedValue(
        new BonusAwardNotFoundError('Bonus award 999 not found'),
      );

      await expect(
        controller.update('ABCDEF', 999, { points: 3 }),
      ).rejects.toThrow(NotFoundException);
      expect(gameState.bonusChanged).not.toHaveBeenCalled();
      expect(broadcaster.deliver).not.toHaveBeenCalled();
    });

    it('maps InvalidBonusAwardError to a 400', async () => {
      const { controller, gameState, bonusService, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(true);
      gameState.getGameSessionId.mockReturnValue(101);
      bonusService.update.mockRejectedValue(
        new InvalidBonusAwardError('Bonus points must be a non-zero number'),
      );

      await expect(
        controller.update('ABCDEF', 9, { points: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(gameState.bonusChanged).not.toHaveBeenCalled();
      expect(broadcaster.deliver).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the award and runs the bonus-changed write and delivers its outcome', async () => {
      const { controller, bonusService, gameState, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(true);
      gameState.getGameSessionId.mockReturnValue(101);
      bonusService.remove.mockResolvedValue(undefined);

      await controller.remove('ABCDEF', 9);

      expect(bonusService.remove).toHaveBeenCalledWith(101, 9);
      expect(gameState.bonusChanged).toHaveBeenCalledWith('ABCDEF');
      expect(broadcaster.deliver).toHaveBeenCalledWith(
        'ABCDEF',
        BONUS_CHANGED_OUTCOME,
      );
    });

    it('404s for an unknown join code', async () => {
      const { controller, gameState, bonusService, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(false);

      await expect(controller.remove('NOPE12', 9)).rejects.toThrow(
        NotFoundException,
      );
      expect(bonusService.remove).not.toHaveBeenCalled();
      expect(gameState.bonusChanged).not.toHaveBeenCalled();
      expect(broadcaster.deliver).not.toHaveBeenCalled();
    });

    it('maps BonusAwardNotFoundError to a 404', async () => {
      const { controller, gameState, bonusService, broadcaster } =
        makeMutationsController();
      gameState.hasSession.mockReturnValue(true);
      gameState.getGameSessionId.mockReturnValue(101);
      bonusService.remove.mockRejectedValue(
        new BonusAwardNotFoundError('Bonus award 999 not found'),
      );

      await expect(controller.remove('ABCDEF', 999)).rejects.toThrow(
        NotFoundException,
      );
      expect(gameState.bonusChanged).not.toHaveBeenCalled();
      expect(broadcaster.deliver).not.toHaveBeenCalled();
    });
  });
});
