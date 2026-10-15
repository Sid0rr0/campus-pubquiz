import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

function setCount(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleSetPlayerCount(asSocket(team.socket), payload);
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

/** Rejoins the team on a fresh socket, as a phone reconnecting would, and returns the player count JOIN_ACCEPTED carried. */
async function rejoinCount(
  game: RealStoreGateway,
  join: { teamName: string; teamToken?: string; teamCode?: string },
  previousSocketId?: string,
): Promise<number | null> {
  const socket = await game.connectPlayer();
  await game.gateway.handleJoinPlayers(asSocket(socket), {
    ...join,
    joinCode: game.joinCode,
    previousSocketId,
  });
  return joinedCount(socket);
}

/** The player count the socket's JOIN_ACCEPTED carried. */
function joinedCount(socket: JoinedTeam['socket']): number | null {
  const accepted = socket.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, { playerCount: number | null }];
  return accepted[1].playerCount;
}

describe('GameGateway — a team reports its player count', () => {
  const harness = setupRealStoreGatewayTest();

  it("acknowledges the count and syncs it to the team's phone, never to another team", async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards', 'The Rivals'],
    });
    const [team, rival] = game.teams;

    const ack = await setCount(game, team, { playerCount: 4 });

    expect(ack).toEqual({ success: true });
    expect(syncsTo(game, team)).toEqual([{ playerCount: 4 }]);
    expect(syncsTo(game, rival)).toEqual([]);
  });

  it('syncs the new count to the phone that took the seat over', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const second = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(second), {
      teamName: 'The Quizzards',
      teamToken: team.teamToken,
      joinCode: game.joinCode,
      previousSocketId: team.socket.id,
    });

    await setCount(game, { socket: second }, { playerCount: 5 });

    expect(syncsTo(game, { socket: second })).toEqual([{ playerCount: 5 }]);
  });

  it('carries a null count on join until the team sets one, then the last value it set', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const join = { teamName: 'The Quizzards', teamToken: team.teamToken };
    const before = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(before), {
      ...join,
      joinCode: game.joinCode,
      previousSocketId: team.socket.id,
    });
    expect(joinedCount(before)).toBeNull();
    await setCount(game, { socket: before }, { playerCount: 3 });

    await setCount(game, { socket: before }, { playerCount: 6 });

    expect(await rejoinCount(game, join, before.id)).toBe(6);
  });

  it('still carries the count after a kick and a rejoin with the team code', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await setCount(game, team, { playerCount: 7 });
    const admin = await game.connectAdmin();
    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: team.teamId,
    });

    const playerCount = await rejoinCount(game, {
      teamName: 'The Quizzards',
      teamCode: team.teamCode,
    });

    expect(playerCount).toBe(7);
  });

  it.each([
    ['zero', 0],
    ['21', 21],
    ['a fraction', 2.5],
    ['a string', '3'],
  ])('refuses %s and keeps the earlier count', async (_name, playerCount) => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await setCount(game, team, { playerCount: 4 });

    const ack = await setCount(game, team, { playerCount });

    expect(ack.success).toBe(false);
    expect(
      await rejoinCount(
        game,
        { teamName: 'The Quizzards', teamToken: team.teamToken },
        team.socket.id,
      ),
    ).toBe(4);
  });

  it('accepts the limits 1 and 20', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;

    expect(await setCount(game, team, { playerCount: 1 })).toEqual({
      success: true,
    });
    expect(await setCount(game, team, { playerCount: 20 })).toEqual({
      success: true,
    });
  });

  it('refuses a socket with no team link, with a reason', async () => {
    const game = await harness.createGateway();
    const stranger = await game.connectPlayer();

    const ack = await setCount(game, { socket: stranger }, { playerCount: 4 });

    expect(ack).toEqual({
      success: false,
      error: 'Join a team before reporting your player count',
    });
  });

  it('works mid-quiz, and leaves the big screen and the phones’ room view alone', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await game.openFirstQuestion(await game.connectAdmin());
    const displayBefore = await game.resync(SOCKET_ROOMS.DISPLAY);
    const playersBefore = await game.resync(SOCKET_ROOMS.PLAYERS);
    game.clearEmits();

    const ack = await setCount(game, team, { playerCount: 4 });
    await game.settled();

    expect(ack).toEqual({ success: true });
    expect(
      game
        .roomEmits()
        .map((emit) => [emit.event, emit.rooms.includes(team.socket.id)]),
    ).toEqual([
      [SOCKET_EVENTS.STATE_UPDATED, false],
      [SOCKET_EVENTS.TEAM_PLAYER_COUNT_SYNCED, true],
    ]);
    expect(
      game.payloadsTo(SOCKET_ROOMS.DISPLAY, SOCKET_EVENTS.STATE_UPDATED),
    ).toEqual([]);
    expect(
      game.payloadsTo(SOCKET_ROOMS.PLAYERS, SOCKET_EVENTS.STATE_UPDATED),
    ).toEqual([]);
    expect(await game.resync(SOCKET_ROOMS.DISPLAY)).toEqual(displayBefore);
    expect(await game.resync(SOCKET_ROOMS.PLAYERS)).toEqual(playersBefore);
  });
});
