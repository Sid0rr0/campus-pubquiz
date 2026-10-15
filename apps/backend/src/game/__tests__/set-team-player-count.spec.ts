import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

function adminSetCount(
  game: RealStoreGateway,
  admin: MockSocket,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleSetTeamPlayerCount(asSocket(admin), payload);
}

function teamSetCount(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
  playerCount: number,
): Promise<AckResult> {
  return game.gateway.handleSetPlayerCount(asSocket(team.socket), {
    playerCount,
  });
}

/** The player count syncs the server addressed to this team's socket, in emit order. */
function syncsTo(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
): unknown[] {
  return game
    .roomEmits()
    .filter(
      (emit) =>
        emit.rooms.includes(team.socket.id) &&
        emit.event === SOCKET_EVENTS.TEAM_PLAYER_COUNT_SYNCED,
    )
    .map((emit) => emit.payload);
}

/** The roster entry the admin view shows for a team. */
async function rosterEntry(game: RealStoreGateway, teamId: number) {
  const { teams } = await game.snapshot();
  return teams.find((team) => team.teamId === teamId);
}

describe('GameGateway — the admin view shows each team’s player count', () => {
  const harness = setupRealStoreGatewayTest();

  it('shows null until the team sets a count, then the count it set', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: null,
      isOverPlayerCap: false,
    });

    await teamSetCount(game, team, 4);

    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: 4,
      isOverPlayerCap: false,
    });
  });

  it('pushes the new roster entry to the admin room only when a team sets its count', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await game.connectAdmin();
    game.clearEmits();

    await teamSetCount(game, team, 4);
    await game.settled();

    expect(
      game.payloadsTo(SOCKET_ROOMS.DISPLAY, SOCKET_EVENTS.STATE_UPDATED),
    ).toEqual([]);
    expect(
      game.payloadsTo(SOCKET_ROOMS.PLAYERS, SOCKET_EVENTS.STATE_UPDATED),
    ).toEqual([]);
    const [adminView] = game.payloadsTo<{
      teams: { teamId: number; playerCount: number | null }[];
    }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.STATE_UPDATED);
    expect(adminView.teams).toEqual([
      expect.objectContaining({ teamId: team.teamId, playerCount: 4 }),
    ]);
  });

  it('keeps the big screen and phones free of player counts', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await teamSetCount(game, team, 4);

    const display = await game.resync(SOCKET_ROOMS.DISPLAY);
    const players = await game.resync(SOCKET_ROOMS.PLAYERS);

    expect(display.teams[0]).not.toHaveProperty('playerCount');
    expect(players.teams[0]).not.toHaveProperty('playerCount');
  });

  it.each([
    ['at the cap', 3, false],
    ['below the cap', 2, false],
    ['above the cap', 4, true],
  ])('flags %s correctly', async (_name, playerCount, isOverPlayerCap) => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      settings: { maxPlayersPerTeam: 3 },
    });
    const [team] = game.teams;

    await teamSetCount(game, team, playerCount);

    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      isOverPlayerCap,
    });
  });

  it('moves the flag when the max players setting changes in the lobby', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      settings: { maxPlayersPerTeam: 6 },
    });
    const [team] = game.teams;
    await teamSetCount(game, team, 5);
    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      isOverPlayerCap: false,
    });

    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        maxPlayersPerTeam: 4,
      }),
    );

    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      isOverPlayerCap: true,
    });
  });

  it('still shows the count of a team that rejoins after a backend restart', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await teamSetCount(game, team, 5);

    const restarted = await game.restart();
    const socket = await restarted.connectPlayer();
    await restarted.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'The Quizzards',
      teamToken: team.teamToken,
      joinCode: restarted.joinCode,
    });

    expect(await rosterEntry(restarted, team.teamId)).toMatchObject({
      playerCount: 5,
    });
  });
});

describe('GameGateway — SET_TEAM_PLAYER_COUNT', () => {
  const harness = setupRealStoreGatewayTest();

  it('acknowledges, tells only that team’s phone and shows the count in the admin view', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards', 'The Rivals'],
    });
    const [team, rival] = game.teams;
    const admin = await game.connectAdmin();
    game.clearEmits();

    const ack = await adminSetCount(game, admin, {
      teamId: team.teamId,
      playerCount: 5,
    });
    await game.settled();

    expect(ack).toEqual({ success: true });
    expect(syncsTo(game, team)).toEqual([{ playerCount: 5 }]);
    expect(syncsTo(game, rival)).toEqual([]);
    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: 5,
    });
    const [adminView] = game.payloadsTo<{
      teams: { teamId: number; playerCount: number | null }[];
    }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.STATE_UPDATED);
    expect(adminView.teams[0]).toMatchObject({ playerCount: 5 });
  });

  it('overwrites the team’s own count, and the team’s later count overwrites the admin’s', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const admin = await game.connectAdmin();
    await teamSetCount(game, team, 3);

    await adminSetCount(game, admin, { teamId: team.teamId, playerCount: 7 });
    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: 7,
    });
    await teamSetCount(game, team, 2);

    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: 2,
    });
  });

  it('works for a team with no connected phone and the count is there on rejoin', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const admin = await game.connectAdmin();
    await game.gateway.handleDisconnect(asSocket(team.socket));
    game.clearEmits();

    const ack = await adminSetCount(game, admin, {
      teamId: team.teamId,
      playerCount: 6,
    });

    expect(ack).toEqual({ success: true });
    expect(syncsTo(game, team)).toEqual([]);
    const socket = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'The Quizzards',
      teamToken: team.teamToken,
      joinCode: game.joinCode,
    });
    const accepted = socket.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
    ) as [string, { playerCount: number | null }];
    expect(accepted[1].playerCount).toBe(6);
  });

  it('refuses a socket outside the admin room, changing nothing', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    game.clearEmits();

    const ack = await adminSetCount(game, team.socket, {
      teamId: team.teamId,
      playerCount: 5,
    });

    expect(ack).toEqual({
      success: false,
      error: 'Only admin clients may set a team’s player count',
    });
    expect(game.roomEmits()).toEqual([]);
    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: null,
    });
  });

  it.each([
    ['zero', 0],
    ['21', 21],
    ['a fraction', 2.5],
    ['a string', '3'],
  ])('refuses %s and keeps the earlier count', async (_name, playerCount) => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const admin = await game.connectAdmin();
    await adminSetCount(game, admin, { teamId: team.teamId, playerCount: 4 });

    const ack = await adminSetCount(game, admin, {
      teamId: team.teamId,
      playerCount,
    });

    expect(ack.success).toBe(false);
    expect(await rosterEntry(game, team.teamId)).toMatchObject({
      playerCount: 4,
    });
  });

  it('accepts the limits 1 and 20', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const admin = await game.connectAdmin();

    expect(
      await adminSetCount(game, admin, {
        teamId: team.teamId,
        playerCount: 1,
      }),
    ).toEqual({ success: true });
    expect(
      await adminSetCount(game, admin, {
        teamId: team.teamId,
        playerCount: 20,
      }),
    ).toEqual({ success: true });
  });

  it('refuses a team that was never on the roster, with a reason', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    game.clearEmits();

    const ack = await adminSetCount(game, admin, {
      teamId: 999999,
      playerCount: 4,
    });

    expect(ack).toEqual({
      success: false,
      error: 'Team 999999 is not in this session',
    });
    expect(game.roomEmits()).toEqual([]);
  });
});
