import { BONUS_CATEGORIES } from '@campus-pubquiz/types';
import {
  BonusAwardNotFoundError,
  BonusService,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import type { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import type { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

function createFakeBonusAwardRepository(
  awardedCount = 0,
  teamAwards: Array<{
    id?: number;
    category: string;
    points: number;
    reason?: string;
    createdAt?: Date;
  }> = [],
  foundAward: Record<string, unknown> | null = null,
) {
  const persistAndFlush = jest.fn().mockResolvedValue(undefined);
  const flush = jest.fn().mockResolvedValue(undefined);
  const removeAndFlush = jest.fn().mockResolvedValue(undefined);
  const create = jest.fn((data: Record<string, unknown>) => data);
  return {
    create,
    getEntityManager: jest.fn(() => ({
      persistAndFlush,
      flush,
      removeAndFlush,
    })),
    persistAndFlush,
    flush,
    removeAndFlush,
    countAwards: jest.fn().mockResolvedValue(awardedCount),
    listForTeam: jest.fn().mockResolvedValue(teamAwards),
    findOne: jest.fn().mockResolvedValue(foundAward),
  };
}

// Defaults to "team is on the roster" so tests exercising unrelated
// validation rules (reason/points) don't also have to stub this out.
function createFakeGameSessionTeamRepository(isOnRoster = true) {
  return {
    findOne: jest
      .fn()
      .mockResolvedValue(isOnRoster ? { gameSession: 101, team: 31 } : null),
  };
}

describe('BonusService', () => {
  function createService(isOnRoster = true, awardedCount = 0) {
    const repo = createFakeBonusAwardRepository(awardedCount);
    const gameSessionTeams = createFakeGameSessionTeamRepository(isOnRoster);
    const service = new BonusService(
      repo as unknown as BonusAwardRepository,
      gameSessionTeams as unknown as GameSessionTeamRepository,
    );
    return { service, repo, gameSessionTeams };
  }

  it('persists a predefined-category award, ignoring any reason passed', async () => {
    const { service, repo } = createService();

    const result = await service.award(101, 31, 'shot', 1, 'ignored');

    expect(result).toEqual({ teamId: 31 });
    expect(repo.create).toHaveBeenCalledWith({
      gameSession: 101,
      team: 31,
      category: 'shot',
      reason: undefined,
      points: 1,
    });
    expect(repo.persistAndFlush).toHaveBeenCalled();
  });

  it('trims and stores the reason for a custom award', async () => {
    const { service, repo } = createService();

    await service.award(101, 31, 'custom', 3, '  Best team name  ');

    expect(repo.create).toHaveBeenCalledWith({
      gameSession: 101,
      team: 31,
      category: 'custom',
      reason: 'Best team name',
      points: 3,
    });
  });

  it('rejects a custom award with no reason', async () => {
    const { service, repo } = createService();

    await expect(service.award(101, 31, 'custom', 1)).rejects.toThrow(
      InvalidBonusAwardError,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a custom award with a blank reason', async () => {
    const { service } = createService();

    await expect(service.award(101, 31, 'custom', 1, '   ')).rejects.toThrow(
      InvalidBonusAwardError,
    );
  });

  it('persists a negative-points penalty award', async () => {
    const { service, repo } = createService();

    const result = await service.award(101, 31, 'custom', -2, 'Late arrival');

    expect(result).toEqual({ teamId: 31 });
    expect(repo.create).toHaveBeenCalledWith({
      gameSession: 101,
      team: 31,
      category: 'custom',
      reason: 'Late arrival',
      points: -2,
    });
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects a zero or non-finite points value (%p)',
    async (points) => {
      const { service } = createService();

      await expect(service.award(101, 31, 'shot', points)).rejects.toThrow(
        InvalidBonusAwardError,
      );
    },
  );

  it('rejects awarding a team that is not part of this game session', async () => {
    const { service, repo, gameSessionTeams } = createService(false);

    await expect(service.award(101, 31, 'shot', 1)).rejects.toThrow(
      InvalidBonusAwardError,
    );
    expect(gameSessionTeams.findOne).toHaveBeenCalledWith({
      gameSession: 101,
      team: 31,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('defaults to allowing every BonusCategory when no enabledCategories is passed', async () => {
    const { service, repo } = createService();

    await service.award(101, 31, 'selfie', 1);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'selfie' }),
    );
  });

  it('rejects a category not in the session-specific enabledCategories list', async () => {
    const { service, repo } = createService();

    await expect(
      service.award(101, 31, 'selfie', 1, undefined, ['shot']),
    ).rejects.toThrow(InvalidBonusAwardError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('allows a category present in the session-specific enabledCategories list', async () => {
    const { service, repo } = createService();

    await service.award(101, 31, 'shot', 1, undefined, ['shot']);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'shot' }),
    );
  });

  it('allows the award that reaches the per-category award-count cap', async () => {
    const { service, repo } = createService(true, 1);

    await service.award(101, 31, 'shot', 1, undefined, BONUS_CATEGORIES, {
      shot: 2,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'shot', points: 1 }),
    );
  });

  it('rejects an award once the team has already hit the per-category award-count cap', async () => {
    const { service, repo } = createService(true, 2);

    await expect(
      service.award(101, 31, 'shot', 1, undefined, BONUS_CATEGORIES, {
        shot: 2,
      }),
    ).rejects.toThrow(InvalidBonusAwardError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('ignores the cap for a category with no entry in maxAwardsPerCategory', async () => {
    const { service, repo } = createService(true, 5);

    await service.award(101, 31, 'selfie', 1, undefined, BONUS_CATEGORIES, {
      shot: 2,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'selfie' }),
    );
  });

  it('counts a single award as one toward the cap regardless of its point value', async () => {
    const { service, repo } = createService(true, 1);

    await service.award(101, 31, 'custom', 10, 'Big prize', BONUS_CATEGORIES, {
      custom: 2,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'custom', points: 10 }),
    );
  });

  it("maps a team's stored awards to its team-facing view", async () => {
    const repo = createFakeBonusAwardRepository(0, [
      { category: 'shot', points: 1 },
      { category: 'custom', points: 3, reason: 'Best team name' },
    ]);
    const gameSessionTeams = createFakeGameSessionTeamRepository();
    const service = new BonusService(
      repo as unknown as BonusAwardRepository,
      gameSessionTeams as unknown as GameSessionTeamRepository,
    );

    const awards = await service.listForTeam(101, 31);

    expect(repo.listForTeam).toHaveBeenCalledWith(101, 31);
    expect(awards).toEqual([
      { category: 'shot', points: 1, reason: undefined },
      { category: 'custom', points: 3, reason: 'Best team name' },
    ]);
  });

  it("maps a team's stored awards to its admin view, including id and createdAt", async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const repo = createFakeBonusAwardRepository(0, [
      { id: 9, category: 'shot', points: 1, createdAt },
    ]);
    const gameSessionTeams = createFakeGameSessionTeamRepository();
    const service = new BonusService(
      repo as unknown as BonusAwardRepository,
      gameSessionTeams as unknown as GameSessionTeamRepository,
    );

    const awards = await service.listForTeamAdmin(101, 31);

    expect(repo.listForTeam).toHaveBeenCalledWith(101, 31);
    expect(awards).toEqual([
      {
        id: 9,
        category: 'shot',
        points: 1,
        reason: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  describe('update', () => {
    function createServiceWithAward(award: Record<string, unknown> | null) {
      const repo = createFakeBonusAwardRepository(0, [], award);
      const gameSessionTeams = createFakeGameSessionTeamRepository();
      const service = new BonusService(
        repo as unknown as BonusAwardRepository,
        gameSessionTeams as unknown as GameSessionTeamRepository,
      );
      return { service, repo };
    }

    it('updates points for a predefined-category award', async () => {
      const award = {
        id: 9,
        category: 'shot',
        points: 1,
        reason: undefined,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      const { service, repo } = createServiceWithAward(award);

      const result = await service.update(101, 9, 3);

      expect(repo.findOne).toHaveBeenCalledWith({ id: 9, gameSession: 101 });
      expect(award.points).toBe(3);
      expect(repo.flush).toHaveBeenCalled();
      expect(result).toEqual({
        id: 9,
        category: 'shot',
        points: 3,
        reason: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('trims and stores an updated reason for a custom-category award', async () => {
      const award = {
        id: 10,
        category: 'custom',
        points: 3,
        reason: 'Old reason',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      const { service } = createServiceWithAward(award);

      const result = await service.update(101, 10, 5, '  New reason  ');

      expect(award.reason).toBe('New reason');
      expect(result.reason).toBe('New reason');
    });

    it('rejects an update with zero or non-finite points', async () => {
      const award = {
        id: 9,
        category: 'shot',
        points: 1,
        reason: undefined,
        createdAt: new Date(),
      };
      const { service, repo } = createServiceWithAward(award);

      await expect(service.update(101, 9, 0)).rejects.toThrow(
        InvalidBonusAwardError,
      );
      expect(repo.flush).not.toHaveBeenCalled();
    });

    it('rejects an update to a custom-category award with a blank reason', async () => {
      const award = {
        id: 10,
        category: 'custom',
        points: 3,
        reason: 'Old reason',
        createdAt: new Date(),
      };
      const { service, repo } = createServiceWithAward(award);

      await expect(service.update(101, 10, 5, '   ')).rejects.toThrow(
        InvalidBonusAwardError,
      );
      expect(repo.flush).not.toHaveBeenCalled();
    });

    it('rejects updating an award that does not exist in this session', async () => {
      const { service, repo } = createServiceWithAward(null);

      await expect(service.update(101, 999, 3)).rejects.toThrow(
        BonusAwardNotFoundError,
      );
      expect(repo.flush).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing award scoped to the session', async () => {
      const award = {
        id: 9,
        category: 'shot',
        points: 1,
        createdAt: new Date(),
      };
      const repo = createFakeBonusAwardRepository(0, [], award);
      const gameSessionTeams = createFakeGameSessionTeamRepository();
      const service = new BonusService(
        repo as unknown as BonusAwardRepository,
        gameSessionTeams as unknown as GameSessionTeamRepository,
      );

      await service.remove(101, 9);

      expect(repo.findOne).toHaveBeenCalledWith({ id: 9, gameSession: 101 });
      expect(repo.removeAndFlush).toHaveBeenCalledWith(award);
    });

    it('rejects deleting an award that does not exist in this session', async () => {
      const repo = createFakeBonusAwardRepository(0, [], null);
      const gameSessionTeams = createFakeGameSessionTeamRepository();
      const service = new BonusService(
        repo as unknown as BonusAwardRepository,
        gameSessionTeams as unknown as GameSessionTeamRepository,
      );

      await expect(service.remove(101, 999)).rejects.toThrow(
        BonusAwardNotFoundError,
      );
      expect(repo.removeAndFlush).not.toHaveBeenCalled();
    });
  });
});
