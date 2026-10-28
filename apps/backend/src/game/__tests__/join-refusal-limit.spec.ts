import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_REFUSED_JOINS = 5;

describe('GameGateway — refused joins per socket', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let team: JoinedTeam;
  let phone: MockSocket;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    [team] = game.teams;
    phone = await game.connectPlayer();
  });

  function guessTeamCode(code: string) {
    return game.gateway.handleJoinPlayers(asSocket(phone), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
      teamCode: code,
    });
  }

  function rejoinWithoutTakeover() {
    return game.gateway.handleJoinPlayers(asSocket(phone), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
      teamToken: team.teamToken,
    });
  }

  it('disconnects a socket that keeps getting its team code wrong', async () => {
    for (let guess = 1; guess < MAX_REFUSED_JOINS; guess++) {
      await expect(guessTeamCode(`WRONG-${guess}`)).resolves.toMatchObject({
        success: false,
      });
    }
    expect(phone.disconnect).not.toHaveBeenCalled();

    await guessTeamCode('WRONG-LAST');

    expect(phone.disconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps a phone that is only waiting for its old socket to free the seat', async () => {
    for (let attempt = 0; attempt < MAX_REFUSED_JOINS * 2; attempt++) {
      await expect(rejoinWithoutTakeover()).resolves.toMatchObject({
        success: false,
        error: expect.stringContaining('ask the quiz master') as string,
      });
    }

    expect(phone.disconnect).not.toHaveBeenCalled();
  });
});
