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
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import {
  UnknownLiveSessionError,
  type LiveSessionRest,
} from '@/game/rest/live-session-rest.service';

function makeRest() {
  return {
    listBonusAwards: jest.fn(),
    editBonus: jest.fn(),
    removeBonus: jest.fn(),
  };
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

  it('returns what the REST entry lists for the team', async () => {
    const rest = makeRest();
    rest.listBonusAwards.mockResolvedValue({ teamId: 31, awards: [award] });
    const controller = new BonusAwardsController(
      rest as unknown as LiveSessionRest,
    );

    const result = await controller.list('ABCDEF', 31);

    expect(rest.listBonusAwards).toHaveBeenCalledWith('ABCDEF', 31);
    expect(result).toEqual({ teamId: 31, awards: [award] });
  });

  it('404s for an unknown join code', async () => {
    const rest = makeRest();
    rest.listBonusAwards.mockRejectedValue(
      new UnknownLiveSessionError('NOPE12'),
    );
    const controller = new BonusAwardsController(
      rest as unknown as LiveSessionRest,
    );

    await expect(controller.list('NOPE12', 31)).rejects.toThrow(
      new NotFoundException('Unknown session "NOPE12"'),
    );
  });
});

describe('BonusAwardMutationsController', () => {
  function makeController() {
    const rest = makeRest();
    const controller = new BonusAwardMutationsController(
      rest as unknown as LiveSessionRest,
    );
    return { controller, rest };
  }

  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      BonusAwardMutationsController,
    ) as unknown[] | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  describe('update', () => {
    it('makes one edit call and returns the updated award', async () => {
      const { controller, rest } = makeController();
      rest.editBonus.mockResolvedValue(award);

      const result = await controller.update('ABCDEF', 9, {
        points: 3,
        reason: undefined,
      });

      expect(rest.editBonus).toHaveBeenCalledWith('ABCDEF', 9, 3, undefined);
      expect(result).toEqual(award);
    });

    it('404s for an unknown join code', async () => {
      const { controller, rest } = makeController();
      rest.editBonus.mockRejectedValue(new UnknownLiveSessionError('NOPE12'));

      await expect(
        controller.update('NOPE12', 9, { points: 3 }),
      ).rejects.toThrow(new NotFoundException('Unknown session "NOPE12"'));
    });

    it('maps BonusAwardNotFoundError to a 404', async () => {
      const { controller, rest } = makeController();
      rest.editBonus.mockRejectedValue(
        new BonusAwardNotFoundError('Bonus award 999 not found'),
      );

      await expect(
        controller.update('ABCDEF', 999, { points: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps InvalidBonusAwardError to a 400', async () => {
      const { controller, rest } = makeController();
      rest.editBonus.mockRejectedValue(
        new InvalidBonusAwardError('Bonus points must be a non-zero number'),
      );

      await expect(
        controller.update('ABCDEF', 9, { points: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('makes one remove call', async () => {
      const { controller, rest } = makeController();
      rest.removeBonus.mockResolvedValue(undefined);

      await controller.remove('ABCDEF', 9);

      expect(rest.removeBonus).toHaveBeenCalledWith('ABCDEF', 9);
    });

    it('404s for an unknown join code', async () => {
      const { controller, rest } = makeController();
      rest.removeBonus.mockRejectedValue(new UnknownLiveSessionError('NOPE12'));

      await expect(controller.remove('NOPE12', 9)).rejects.toThrow(
        new NotFoundException('Unknown session "NOPE12"'),
      );
    });

    it('maps BonusAwardNotFoundError to a 404', async () => {
      const { controller, rest } = makeController();
      rest.removeBonus.mockRejectedValue(
        new BonusAwardNotFoundError('Bonus award 999 not found'),
      );

      await expect(controller.remove('ABCDEF', 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
