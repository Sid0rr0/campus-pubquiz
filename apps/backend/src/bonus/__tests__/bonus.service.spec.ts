import {
  BonusAwardNotFoundError,
  BonusService,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import type { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import type { CoinAwardRepository } from '@/db/repositories/coin-award.repository';
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
  const persist = jest.fn();
  const create = jest.fn((data: Record<string, unknown>) => data);
  return {
    create,
    getEntityManager: jest.fn(() => ({
      persist,
      persistAndFlush,
      flush,
      removeAndFlush,
    })),
    persist,
    persistAndFlush,
    flush,
    removeAndFlush,
    countAwards: jest.fn().mockResolvedValue(awardedCount),
    listForTeam: jest.fn().mockResolvedValue(teamAwards),
    findOne: jest.fn().mockResolvedValue(foundAward),
  };
}

/** A coin award repository holding no coin awards; the real-Postgres specs cover the ledger. */
function createFakeCoinAwardRepository() {
  return {
    create: jest.fn((data: Record<string, unknown>) => data),
    totalsForSession: jest.fn().mockResolvedValue({}),
  };
}

describe('BonusService', () => {
  function createService(
    awardedCount = 0,
    teamAwards: Parameters<typeof createFakeBonusAwardRepository>[1] = [],
    foundAward: Record<string, unknown> | null = null,
  ) {
    const repo = createFakeBonusAwardRepository(
      awardedCount,
      teamAwards,
      foundAward,
    );
    const coinAwards = createFakeCoinAwardRepository();
    const gameSessionTeams = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new BonusService(
      repo as unknown as BonusAwardRepository,
      coinAwards as unknown as CoinAwardRepository,
      gameSessionTeams as unknown as GameSessionTeamRepository,
    );
    return { service, repo, coinAwards, gameSessionTeams };
  }

  it('reads whether a team is on the session’s stored roster', async () => {
    const { service, gameSessionTeams } = createService();

    await expect(service.isOnRoster(101, 31)).resolves.toBe(false);
    gameSessionTeams.findOne.mockResolvedValue({ gameSession: 101, team: 31 });
    await expect(service.isOnRoster(101, 31)).resolves.toBe(true);
    expect(gameSessionTeams.findOne).toHaveBeenCalledWith({
      gameSession: 101,
      team: 31,
    });
  });

  describe('award', () => {
    it('stores a bonus award as given', async () => {
      const { service, repo, coinAwards } = createService();

      const result = await service.award(101, 31, {
        bonus: { category: 'shot', points: 1, blockFirstQuestionId: 7 },
        linkedCoins: 0,
        manualCoins: 0,
      });

      expect(result).toEqual({ teamId: 31, coinsGiven: 0, coinTotal: 0 });
      expect(repo.create).toHaveBeenCalledWith({
        gameSession: 101,
        team: 31,
        category: 'shot',
        points: 1,
        blockFirstQuestionId: 7,
      });
      expect(repo.persist).toHaveBeenCalledTimes(1);
      expect(coinAwards.create).not.toHaveBeenCalled();
      expect(repo.flush).toHaveBeenCalledTimes(1);
    });

    it('stores the linked coins and the manual coins with the bonus in one flush', async () => {
      const { service, repo, coinAwards } = createService();

      const result = await service.award(101, 31, {
        bonus: { category: 'shot', points: 1 },
        linkedCoins: 2,
        manualCoins: 3,
        manualCoinsReason: 'Quiz',
      });

      expect(result.coinsGiven).toBe(5);
      const linked = coinAwards.create.mock.calls[0][0];
      expect(linked).toMatchObject({ coins: 2 });
      const [firstPersisted] = repo.persist.mock.calls[0] as unknown[];
      expect(linked.bonusAward).toBe(firstPersisted);
      expect(coinAwards.create).toHaveBeenCalledWith({
        gameSession: 101,
        team: 31,
        coins: 3,
        reason: 'Quiz',
      });
      expect(repo.persist).toHaveBeenCalledTimes(3);
      expect(repo.flush).toHaveBeenCalledTimes(1);
    });

    it('stores coins alone when there is no bonus award', async () => {
      const { service, repo } = createService();

      const result = await service.award(101, 31, {
        linkedCoins: 2,
        manualCoins: -1,
      });

      expect(result.coinsGiven).toBe(-1);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('stores a covering coin award with its reason and no bonus award', async () => {
      const { service, repo, coinAwards } = createService();

      await service.coverSpentCoins(101, 31, 4, 'Spent');

      expect(coinAwards.create).toHaveBeenCalledWith({
        gameSession: 101,
        team: 31,
        coins: 4,
        reason: 'Spent',
      });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  it('counts a team’s awards in one category', async () => {
    const { service, repo } = createService(3);

    await expect(service.awardCount(101, 31, 'shot')).resolves.toBe(3);
    expect(repo.countAwards).toHaveBeenCalledWith(101, 31, 'shot');
  });

  it('names its errors', () => {
    expect(new InvalidBonusAwardError('x').name).toBe('InvalidBonusAwardError');
    expect(new BonusAwardNotFoundError('x').name).toBe(
      'BonusAwardNotFoundError',
    );
  });

  it("maps a team's stored awards to its team-facing view", async () => {
    const { service, repo } = createService(0, [
      { category: 'shot', points: 1 },
      { category: 'custom', points: 3, reason: 'Best team name' },
    ]);

    const awards = await service.listForTeam(101, 31);

    expect(repo.listForTeam).toHaveBeenCalledWith(101, 31);
    expect(awards).toEqual([
      { category: 'shot', points: 1, reason: undefined },
      { category: 'custom', points: 3, reason: 'Best team name' },
    ]);
  });

  it("maps a team's stored awards to its admin view, including id and createdAt", async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const { service, repo } = createService(0, [
      { id: 9, category: 'shot', points: 1, createdAt },
    ]);

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
    it('stores the decided points and reason and returns the admin view', async () => {
      const award = {
        id: 10,
        team: { id: 31 },
        category: 'custom',
        points: 3,
        reason: 'Old reason',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      const { service, repo } = createService(0, [], award);

      const result = await service.update(101, 10, 5, 'New reason');

      expect(repo.findOne).toHaveBeenCalledWith({ id: 10, gameSession: 101 });
      expect(award.points).toBe(5);
      expect(award.reason).toBe('New reason');
      expect(repo.flush).toHaveBeenCalled();
      expect(result).toEqual({
        teamId: 31,
        award: {
          id: 10,
          category: 'custom',
          points: 5,
          reason: 'New reason',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });

    it('rejects updating an award that does not exist in this session', async () => {
      const { service, repo } = createService();

      await expect(service.update(101, 999, 3, undefined)).rejects.toThrow(
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
        team: { id: 31 },
      };
      const { service, repo } = createService(0, [], award);

      await expect(service.remove(101, 9)).resolves.toEqual({
        teamId: 31,
        coinTotal: 0,
      });

      expect(repo.findOne).toHaveBeenCalledWith({ id: 9, gameSession: 101 });
      expect(repo.removeAndFlush).toHaveBeenCalledWith(award);
    });

    it('rejects deleting an award that does not exist in this session', async () => {
      const { service, repo } = createService();

      await expect(service.remove(101, 999)).rejects.toThrow(
        BonusAwardNotFoundError,
      );
      expect(repo.removeAndFlush).not.toHaveBeenCalled();
    });
  });
});
