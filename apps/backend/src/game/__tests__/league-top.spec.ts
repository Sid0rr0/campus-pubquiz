import { DEFAULT_SESSION_SETTINGS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { InvalidLeagueIdsError } from '@/league/league.service';

describe('Display view — the lobby league top', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  async function createLeague(
    name: string,
    dates = { startsOn: '2019-09-01', endsOn: '2999-12-31' },
  ) {
    const em = game.orm.em.fork();
    const league = em.create(League, { name, ...dates });
    await em.flush();
    return league;
  }

  /** Puts the seeded session in a new league, straight in the database. */
  async function tickLeague(name: string) {
    const em = game.orm.em.fork();
    const league = em.create(League, {
      name,
      startsOn: '2019-09-01',
      endsOn: '2999-12-31',
    });
    em.create(LeagueSession, {
      league,
      gameSession: em.getReference(GameSession, game.gameSessionId),
    });
    await em.flush();
    return league;
  }

  function refreshAll() {
    return game.inRequestContext(() => game.gameState.refreshLeagueTops());
  }

  it('is null on the big screen while the session is in no league', async () => {
    expect((await game.resync('display')).leagueTop).toBeNull();
  });

  it('carries the league a settings change just ticked', async () => {
    const league = await createLeague('Autumn');

    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {}, [league.id]),
    );

    expect((await game.resync('display')).leagueTop).toEqual({
      name: 'Autumn',
      rows: [],
    });
  });

  it('goes back to null when the last league is unticked', async () => {
    const league = await createLeague('Autumn');
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {}, [league.id]),
    );

    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {}, []),
    );

    expect((await game.resync('display')).leagueTop).toBeNull();
  });

  it('stores neither the settings nor the leagues when a ticked league is not current', async () => {
    const past = await createLeague('Last year', {
      startsOn: '1999-09-01',
      endsOn: '2000-01-01',
    });

    await expect(
      game.inRequestContext(() =>
        game.gameState.updateSessionSettings(
          game.joinCode,
          { lockGraceSeconds: 15 },
          [past.id],
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidLeagueIdsError);

    expect(game.gameState.getSnapshot(game.joinCode).settings).toEqual(
      DEFAULT_SESSION_SETTINGS,
    );
    expect(
      await game.orm.em.fork().count(LeagueSession, {
        gameSession: game.gameSessionId,
      }),
    ).toBe(0);
  });

  it('refreshes every live session after an admin changed a league behind the cache', async () => {
    await tickLeague('Autumn');
    expect((await game.resync('display')).leagueTop).toBeNull();

    const changed = await refreshAll();

    expect(changed).toEqual([game.joinCode]);
    expect((await game.resync('display')).leagueTop).toEqual({
      name: 'Autumn',
      rows: [],
    });
  });

  it('reports nothing changed when the refresh finds the same league top', async () => {
    await tickLeague('Autumn');
    await refreshAll();

    expect(await refreshAll()).toEqual([]);
  });

  it('is still there after the backend restarts', async () => {
    await tickLeague('Autumn');

    const restarted = await game.restart();

    expect((await restarted.resync('display')).leagueTop).toMatchObject({
      name: 'Autumn',
    });
  });

  it('is sent to the big screen only', async () => {
    await tickLeague('Autumn');
    await refreshAll();

    expect(await game.resync(SOCKET_ROOMS.ADMIN)).not.toHaveProperty(
      'leagueTop',
    );
    expect(await game.resync(SOCKET_ROOMS.PLAYERS)).not.toHaveProperty(
      'leagueTop',
    );
  });
});
