import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import type { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import type { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

function createFakeBonusAwardRepository() {
  const persistAndFlush = jest.fn().mockResolvedValue(undefined);
  const create = jest.fn((data: Record<string, unknown>) => data);
  return {
    create,
    getEntityManager: jest.fn(() => ({ persistAndFlush })),
    persistAndFlush,
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
  function createService(isOnRoster = true) {
    const repo = createFakeBonusAwardRepository();
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
});
