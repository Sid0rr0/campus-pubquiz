import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  asSocket,
  type MockServer,
  type MockTeamService,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — join players', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let teamService: MockTeamService;
  let answerService: MockAnswerService;

  beforeEach(async () => {
    ({ gateway, server, teamService, answerService } =
      await createTestGateway());
  });

  it('joins a team and emits JOIN_ACCEPTED for a players-room client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });

    expect(teamService.join).toHaveBeenCalledWith(101, 'The Quizzards', {
      teamToken: undefined,
      teamCode: undefined,
      joinCode: 'ABCDEF',
    });
    expect(player.emit).toHaveBeenCalledWith(SOCKET_EVENTS.JOIN_ACCEPTED, {
      teamId: 31,
      teamName: 'The Quizzards',
      teamToken: 'team-token-1',
      teamCode: 'team-code-1',
      answers: [{ questionId: 21, value: 'Banana' }],
    });
    expect(answerService.listForTeam).toHaveBeenCalledWith(101, 31);
  });

  it('passes the team code through to TeamService.join when the player supplies one', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
      teamCode: 'RECOVER1',
    });

    expect(teamService.join).toHaveBeenCalledWith(101, 'The Quizzards', {
      teamToken: undefined,
      teamCode: 'RECOVER1',
      joinCode: 'ABCDEF',
    });
  });

  it('broadcasts the updated connected-team list to all rooms after a join', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });

    expect(teamService.listForSession).toHaveBeenCalledWith(101);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        teams: [{ teamId: 31, teamName: 'The Quizzards', isConnected: true }],
      }),
    );
  });

  it('rejects JOIN_PLAYERS from a non-players client', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleJoinPlayers(asSocket(admin), { teamName: 'The Quizzards' }),
    ).rejects.toThrow(WsException);
  });

  it('surfaces a team-join error (e.g. name taken) as a WsException', async () => {
    teamService.join.mockRejectedValueOnce(
      new Error('Team name "The Quizzards" is already taken in this session'),
    );
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleJoinPlayers(asSocket(player), {
        teamName: 'The Quizzards',
      }),
    ).rejects.toThrow(WsException);
  });
});
