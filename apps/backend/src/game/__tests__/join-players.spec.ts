import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — join players', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('joins a team and emits JOIN_ACCEPTED for a players-room client', async () => {
    const player = await game.connectPlayer();

    await game.gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
    });

    expect(player.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({
        teamName: 'The Quizzards',
        teamId: expect.any(Number) as number,
        teamToken: expect.any(String) as string,
        teamCode: expect.any(String) as string,
        answers: [],
        bonusAwards: [],
      }),
    );
  });

  it('hands a rejoining device the team’s existing answers and bonus awards', async () => {
    const admin = await game.connectAdmin();
    const first = await game.joinTeam('The Quizzards');
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(first.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: first.teamId,
      value: 'Paris',
    });
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: first.teamId,
      category: 'shot',
      points: 1,
    });

    await game.gateway.handleDisconnect(asSocket(first.socket)); // phone dropped
    const secondDevice = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(secondDevice), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
      teamCode: first.teamCode,
    });

    expect(secondDevice.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({
        teamId: first.teamId,
        answers: [
          expect.objectContaining({
            questionId: game.questionIds.multipleChoice,
            value: 'Paris',
            pointsAwarded: 2,
          }),
        ],
        bonusAwards: [expect.objectContaining({ category: 'shot', points: 1 })],
      }),
    );
  });

  it('rejects a second device while the team is still connected on the first', async () => {
    const first = await game.joinTeam('The Quizzards');
    const secondDevice = await game.connectPlayer();

    await expect(
      game.gateway.handleJoinPlayers(asSocket(secondDevice), {
        teamName: 'The Quizzards',
        joinCode: game.joinCode,
        teamCode: first.teamCode,
      }),
    ).rejects.toThrow('already connected on another device');
  });

  it('rejoins the same team when the player supplies its team code', async () => {
    const first = await game.joinTeam('The Quizzards');
    await game.gateway.handleDisconnect(asSocket(first.socket)); // phone dropped
    const secondDevice = await game.connectPlayer();

    await game.gateway.handleJoinPlayers(asSocket(secondDevice), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
      teamCode: first.teamCode,
    });

    expect(secondDevice.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({ teamId: first.teamId }),
    );
    expect((await game.snapshot()).teams).toHaveLength(1);
  });

  it('broadcasts the updated connected-team list to all rooms after a join', async () => {
    const team = await game.joinTeam('The Quizzards');

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      const snapshots = game.payloadsTo<StateSnapshotPayload>(
        room,
        SOCKET_EVENTS.STATE_UPDATED,
      );
      expect(snapshots[snapshots.length - 1].teams).toEqual([
        { teamId: team.teamId, teamName: 'The Quizzards', isConnected: true },
      ]);
    }
  });

  it('rejects JOIN_PLAYERS from a non-players client', async () => {
    const admin = await game.connectAdmin();

    await expect(
      game.gateway.handleJoinPlayers(asSocket(admin), {
        teamName: 'The Quizzards',
      }),
    ).rejects.toThrow(WsException);

    expect((await game.snapshot()).teams).toEqual([]);
  });

  it('surfaces a team-join error (e.g. name taken) as a WsException', async () => {
    await game.joinTeam('The Quizzards');
    const rival = await game.connectPlayer();

    await expect(
      game.gateway.handleJoinPlayers(asSocket(rival), {
        teamName: 'The Quizzards',
        joinCode: game.joinCode,
      }),
    ).rejects.toThrow(WsException);

    expect((await game.snapshot()).teams).toHaveLength(1);
  });
});
