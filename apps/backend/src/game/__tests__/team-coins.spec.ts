import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Team coins', () => {
  const harness = setupRealStoreGatewayTest();

  function adminCoins(game: RealStoreGateway): number[] {
    return game.gameState
      .getView(game.joinCode, SOCKET_ROOMS.ADMIN)
      .teams.map((team) => team.coins);
  }

  async function joinReplyCoins(
    game: RealStoreGateway,
    teamToken: string,
    previousSocketId?: string,
  ): Promise<number> {
    const device = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(device), {
      teamName: 'The Quizzards',
      teamToken,
      previousSocketId,
      joinCode: game.joinCode,
    });
    expect(device.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({ coins: expect.any(Number) as number }),
    );
    const payloads = (device.emit.mock.calls as [string, { coins: number }][])
      .filter(([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED)
      .map(([, payload]) => payload);
    return payloads[0].coins;
  }

  it('gives a team the starting coins in its join reply and the admin view, again after a rejoin and a restart', async () => {
    const game = await harness.createGateway({
      settings: { powerUpsEnabled: true, startingCoins: 3 },
    });
    const team = await game.joinTeam('The Quizzards');

    expect(adminCoins(game)).toEqual([3]);
    expect(await joinReplyCoins(game, team.teamToken, team.socket.id)).toBe(3);

    const restarted = await game.restart();
    expect(await joinReplyCoins(restarted, team.teamToken)).toBe(3);
  });

  it('gives no coins in a session played without power-ups', async () => {
    const game = await harness.createGateway({
      settings: { powerUpsEnabled: false, startingCoins: 3 },
    });
    const team = await game.joinTeam('The Quizzards');

    expect(adminCoins(game)).toEqual([0]);
    expect(await joinReplyCoins(game, team.teamToken, team.socket.id)).toBe(0);
  });
});
