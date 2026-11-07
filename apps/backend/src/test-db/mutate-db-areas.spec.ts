import { areaOf, groupByArea } from '@/test-db/mutate-db-areas';

describe('mutate-db-areas', () => {
  it('names an area by its top-level folder, splitting game/ by subfolder', () => {
    expect(areaOf('src/auth/auth.service.ts')).toBe('auth');
    expect(areaOf('src/game/state/write-gate.ts')).toBe('game-state');
    expect(areaOf('src/game/game.gateway.ts')).toBe('game');
  });

  it('groups files by area in order', () => {
    expect([
      ...groupByArea(['src/auth/a.ts', 'src/game/state/b.ts', 'src/auth/c.ts']),
    ]).toEqual([
      ['auth', ['src/auth/a.ts', 'src/auth/c.ts']],
      ['game-state', ['src/game/state/b.ts']],
    ]);
  });
});
