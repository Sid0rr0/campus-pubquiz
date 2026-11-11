import { SOCKET_ROOMS, type DisplayStatePayload } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  CAPITAL_QUESTION,
  advanceToBlockBoard,
  advanceUntil,
  setupRealStoreGatewayTest,
  submitAnswers,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const SIDES = [
  { id: 'eng', name: 'Engineering' },
  { id: 'law', name: 'Law' },
];

describe('GameGateway — the Versus side standings on the display view', () => {
  const harness = setupRealStoreGatewayTest();

  function displayScreen(game: RealStoreGateway) {
    const view: DisplayStatePayload = game.gameState.getView(
      game.joinCode,
      SOCKET_ROOMS.DISPLAY,
    );
    return view.screen;
  }

  async function createGame(
    teamNames: string[],
    settings: object = { versusEnabled: true, versusSides: SIDES },
  ): Promise<RealStoreGateway> {
    return harness.createGateway({
      teamNames,
      rounds: [
        { title: 'R1', breakAfter: true, questions: [CAPITAL_QUESTION] },
        { title: 'R2', breakAfter: true, questions: [CAPITAL_QUESTION] },
      ],
      settings,
    });
  }

  async function pickSides(game: RealStoreGateway, sideIds: string[]) {
    for (const [index, sideId] of sideIds.entries()) {
      await game.gateway.handlePickSide(asSocket(game.teams[index].socket), {
        sideId,
      });
    }
  }

  /** Teams answer (first right, others wrong or blank) and the quiz plays to the board. */
  async function playToBoard(game: RealStoreGateway, answers: string[]) {
    await game.act('START_QUIZ');
    await advanceUntil(game, 'question_open');
    await submitAnswers(game, answers);
    await advanceToBlockBoard(game);
  }

  it('shows the lobby the team count per side, in side order', async () => {
    const game = await createGame(['A', 'B', 'C']);
    await pickSides(game, ['law', 'law', 'eng']);

    expect(displayScreen(game)).toEqual({
      kind: 'lobby',
      sideCounts: [
        { id: 'eng', name: 'Engineering', colorIndex: 0, teamCount: 1 },
        { id: 'law', name: 'Law', colorIndex: 1, teamCount: 2 },
      ],
    });
  });

  it('puts the current and prior split and each row side on the board', async () => {
    const game = await createGame(['A', 'B']);
    await pickSides(game, ['eng', 'law']);
    await playToBoard(game, ['Paris', 'London']);

    const screen = displayScreen(game);
    if (screen.kind !== 'leaderboard') throw new Error(screen.kind);
    expect(screen.sideIds).toEqual({
      [game.teams[0].teamId]: 'eng',
      [game.teams[1].teamId]: 'law',
    });
    expect(screen.sideStandings?.sides.map((side) => side.average)).toEqual([
      10, 0,
    ]);
    expect(
      screen.priorSideStandings?.sides.map((side) => side.average),
    ).toEqual([0, 0]);
  });

  it('sends nothing about sides with Versus off', async () => {
    const game = await createGame(['A', 'B'], {});
    expect(displayScreen(game)).toEqual({ kind: 'lobby' });
    await playToBoard(game, ['Paris', 'London']);

    const screen = displayScreen(game);
    if (screen.kind !== 'leaderboard') throw new Error(screen.kind);
    expect(screen).not.toHaveProperty('sideStandings');
    expect(screen).not.toHaveProperty('priorSideStandings');
    expect(screen).not.toHaveProperty('sideIds');
  });

  it('carries the side standings on the ended screen', async () => {
    const game = await createGame(['A', 'B']);
    await pickSides(game, ['eng', 'law']);
    await playToBoard(game, ['Paris', 'London']);
    await game.act('END_QUIZ');

    const screen = displayScreen(game);
    if (screen.kind !== 'ended') throw new Error(screen.kind);
    expect(screen.sideStandings?.sides.map((side) => side.isLeading)).toEqual([
      true,
      false,
    ]);
  });

  it('sends no side standings on the ended screen with Versus off', async () => {
    const game = await createGame(['A', 'B'], {});
    await playToBoard(game, ['Paris', 'London']);
    await game.act('END_QUIZ');

    expect(displayScreen(game)).toEqual(
      expect.objectContaining({ kind: 'ended' }),
    );
    expect(displayScreen(game)).not.toHaveProperty('sideStandings');
  });

  it('leaves a roster team that never took part out of its side once the session has ended', async () => {
    const game = await createGame(['A', 'B', 'Idle']);
    await pickSides(game, ['eng', 'law', 'law']);
    await playToBoard(game, ['Paris', 'London']);

    const teamCounts = () => {
      const view = game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
      return view.phoneLeaderboard.sideStandings?.sides.map(
        (side) => side.teamCount,
      );
    };
    expect(teamCounts()).toEqual([1, 2]);

    await advanceUntil(game, 'ended');

    expect(teamCounts()).toEqual([1, 1]);
    const admin = game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
    expect(admin.sideStandings?.sides.map((side) => side.teamCount)).toEqual([
      1, 1,
    ]);
  });
});
