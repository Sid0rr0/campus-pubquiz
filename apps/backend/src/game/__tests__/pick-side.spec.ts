import {
  SIDE_REMOVAL_REFUSED_MESSAGE,
  SOCKET_EVENTS,
  type AckResult,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const SIDES = [
  { id: 'eng', name: 'Engineering' },
  { id: 'law', name: 'Law' },
];
const VERSUS = { versusEnabled: true, versusSides: SIDES };

function update(
  game: RealStoreGateway,
  partial: Parameters<
    RealStoreGateway['gameState']['updateSessionSettings']
  >[1],
) {
  return game.inRequestContext(() =>
    game.gameState.updateSessionSettings(game.joinCode, partial),
  );
}

function pick(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handlePickSide(asSocket(team.socket), payload);
}

/** The side ids the admin roster shows, by team name. */
async function rosterSides(
  game: RealStoreGateway,
): Promise<Record<string, string | null>> {
  const view = await game.snapshot();
  return Object.fromEntries(
    view.teams.map((team) => [team.teamName, team.sideId]),
  );
}

/** The side id the socket's JOIN_ACCEPTED carried, on a fresh rejoin with the team's token. */
async function rejoinSide(
  game: RealStoreGateway,
  team: JoinedTeam,
): Promise<string | null> {
  const socket = await game.connectPlayer();
  const ack = await game.gateway.handleJoinPlayers(asSocket(socket), {
    teamName: 'Quizzards',
    teamToken: team.teamToken,
    joinCode: game.joinCode,
    previousSocketId: team.socket.id,
  });
  expect(ack).toEqual({ success: true });
  const accepted = socket.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, { sideId: string | null }];
  return accepted[1].sideId;
}

function sideSyncsTo(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
): unknown[] {
  return game
    .roomEmits()
    .filter(
      (emit) =>
        emit.rooms.includes(team.socket.id) &&
        emit.event === SOCKET_EVENTS.TEAM_SIDE_SYNCED,
    )
    .map((emit) => emit.payload);
}

describe('GameGateway — a team picks its side', () => {
  const harness = setupRealStoreGatewayTest();

  it('picks and switches in the lobby, syncs the phone and shows the side on the roster', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards', 'Rivals'],
      settings: VERSUS,
    });
    const [team, rival] = game.teams;

    expect(await pick(game, team, { sideId: 'eng' })).toEqual({
      success: true,
    });
    expect(await pick(game, team, { sideId: 'law' })).toEqual({
      success: true,
    });

    expect(sideSyncsTo(game, team)).toEqual([
      { sideId: 'eng' },
      { sideId: 'law' },
    ]);
    expect(sideSyncsTo(game, rival)).toEqual([]);
    expect(await rosterSides(game)).toEqual({ Quizzards: 'law', Rivals: null });
  });

  it('refuses an unknown side, and a pick without Versus', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: VERSUS,
    });
    const [team] = game.teams;

    const unknown = await pick(game, team, { sideId: 'medicine' });
    expect(unknown.success).toBe(false);

    const plain = await harness.createGateway({
      teamNames: ['Plain'],
      joinCode: 'PLAIN1',
    });
    const noVersus = await pick(plain, plain.teams[0], { sideId: 'eng' });
    expect(noVersus.success).toBe(false);
  });

  it('refuses a socket with no team', async () => {
    const game = await harness.createGateway({ settings: VERSUS });
    const stranger = await game.connectPlayer();

    expect(
      (await pick(game, { socket: stranger }, { sideId: 'eng' })).success,
    ).toBe(false);
  });

  it('refuses a switch once the quiz has started, but lets a side-less team pick once', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: VERSUS,
    });
    const [team] = game.teams;
    await pick(game, team, { sideId: 'eng' });
    await game.openFirstQuestion(await game.connectAdmin());
    const late = await game.joinTeam('Latecomers');

    const switched = await pick(game, team, { sideId: 'law' });
    const first = await pick(game, late, { sideId: 'law' });
    const second = await pick(game, late, { sideId: 'eng' });

    expect(switched.success).toBe(false);
    expect(first).toEqual({ success: true });
    expect(second.success).toBe(false);
    expect(await rosterSides(game)).toEqual({
      Quizzards: 'eng',
      Latecomers: 'law',
    });
  });

  it('keeps the side across a reconnect, and drops it with a kick', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: VERSUS,
    });
    const [team] = game.teams;
    await pick(game, team, { sideId: 'eng' });

    expect(await rejoinSide(game, team)).toBe('eng');

    const admin = await game.connectAdmin();
    await game.gateway.handleKickTeam(asSocket(admin), { teamId: team.teamId });
    const back = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(back), {
      teamName: 'Quizzards',
      teamToken: team.teamToken,
      joinCode: game.joinCode,
    });
    expect(await rosterSides(game)).toEqual({ Quizzards: null });
  });

  it('restores the sides after a backend restart', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: VERSUS,
    });
    await pick(game, game.teams[0], { sideId: 'law' });

    const restarted = await game.restart();
    const [team] = restarted.teams;

    expect(await rejoinSide(restarted, team ?? game.teams[0])).toBe('law');
  });
});

describe('GameGateway — the quiz master moves a team', () => {
  const harness = setupRealStoreGatewayTest();

  it('moves a team in the lobby and mid-quiz, syncing the phone and the roster', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards', 'Rivals'],
      settings: VERSUS,
    });
    const [team, rival] = game.teams;
    const admin = await game.connectAdmin();
    const move = (teamId: number, sideId: string) =>
      game.gateway.handleSetTeamSide(asSocket(admin), { teamId, sideId });

    expect(await move(team.teamId, 'eng')).toEqual({ success: true });
    await pick(game, rival, { sideId: 'law' });
    await game.openFirstQuestion(admin);
    expect(await move(team.teamId, 'law')).toEqual({ success: true });

    expect(sideSyncsTo(game, team)).toEqual([
      { sideId: 'eng' },
      { sideId: 'law' },
    ]);
    expect(await rosterSides(game)).toEqual({
      Quizzards: 'law',
      Rivals: 'law',
    });
  });

  it('refuses an unknown side and a team not on the roster', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: VERSUS,
    });
    const admin = await game.connectAdmin();
    const send = (payload: unknown) =>
      game.gateway.handleSetTeamSide(asSocket(admin), payload);

    expect(
      (await send({ teamId: game.teams[0].teamId, sideId: 'x' })).success,
    ).toBe(false);
    expect((await send({ teamId: 9999, sideId: 'eng' })).success).toBe(false);
    expect(await rosterSides(game)).toEqual({ Quizzards: null });
  });
});

describe('GameGateway — Start quiz and the Versus settings with sides picked', () => {
  const harness = setupRealStoreGatewayTest();

  it('refuses Start quiz while a team has no side, then allows it', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards', 'Rivals'],
      settings: VERSUS,
    });
    const [team, rival] = game.teams;
    await pick(game, team, { sideId: 'eng' });

    await expect(game.act('START_QUIZ')).rejects.toThrow(/side/i);

    await pick(game, rival, { sideId: 'law' });
    const view = await game.act('START_QUIZ');
    expect(view.progress.status).not.toBe('lobby');
  });

  it('starts without sides when Versus is off', async () => {
    const game = await harness.createGateway({ teamNames: ['Quizzards'] });

    const view = await game.act('START_QUIZ');

    expect(view.progress.status).not.toBe('lobby');
  });

  it('turning Versus off clears every pick and tells the phones', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: VERSUS,
    });
    const [team] = game.teams;
    await pick(game, team, { sideId: 'eng' });
    game.clearEmits();

    const outcome = await update(game, { versusEnabled: false });

    expect(await rosterSides(game)).toEqual({ Quizzards: null });
    expect(outcome.sideSyncs).toEqual([
      { teamId: team.teamId, socketId: team.socket.id, sideId: null },
    ]);
    await update(game, VERSUS);
    expect(await rejoinSide(game, team)).toBeNull();
  });

  it('refuses removing a side a team is on, and allows removing an empty one', async () => {
    const game = await harness.createGateway({
      teamNames: ['Quizzards'],
      settings: {
        versusEnabled: true,
        versusSides: [...SIDES, { id: 'med', name: 'Medicine' }],
      },
    });
    await pick(game, game.teams[0], { sideId: 'eng' });

    await expect(
      update(game, {
        versusSides: [SIDES[1], { id: 'med', name: 'Medicine' }],
      }),
    ).rejects.toThrow(SIDE_REMOVAL_REFUSED_MESSAGE);
    await expect(update(game, { versusSides: SIDES })).resolves.toBeDefined();
  });
});
