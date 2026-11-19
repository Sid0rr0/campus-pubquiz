import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';
import {
  expectLiveEqualsResync,
  teamViewsTo,
} from '@/game/__tests__/team-view-test-utils';

describe('GameGateway — the team view', () => {
  const harness = setupRealStoreGatewayTest();

  it('after a player count change, the last team view the phone got equals what a rejoin gets', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards', 'The Rivals'],
    });
    const [team] = game.teams;

    await game.gateway.handleSetPlayerCount(asSocket(team.socket), {
      playerCount: 4,
    });

    expect(teamViewsTo(game, team).at(-1)?.playerCount).toBe(4);
    await expectLiveEqualsResync(game, team);
  });

  it('never sends a team view to another team', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards', 'The Rivals'],
    });
    const [team, rival] = game.teams;

    await game.gateway.handleSetPlayerCount(asSocket(team.socket), {
      playerCount: 4,
    });

    expect(teamViewsTo(game, team)).toHaveLength(1);
    expect(teamViewsTo(game, rival)).toEqual([]);
    expect(
      game
        .roomEmits()
        .filter((emit) => emit.event === SOCKET_EVENTS.TEAM_VIEW)
        .every((emit) => emit.rooms.length === 1),
    ).toBe(true);
  });

  it("names the joker's round in the doubled rounds of a rejoining phone's team view", async () => {
    const game = await harness.createGateway({
      rounds: [1, 2, 3].map((number) => ({
        title: `Round ${number}`,
        breakAfter: true,
        questions: [
          {
            type: 'multiple_choice' as const,
            prompt: `Question of round ${number}?`,
            answer: 'right',
            points: 1,
            payload: { options: ['right', 'wrong'] },
          },
        ],
      })),
      teamNames: ['Alpha'],
      settings: { showRoundOverview: true, jokersEnabled: true },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    await game.act('ADVANCE'); // -> joker_pick
    const [alpha] = game.teams;
    await game.gateway.handlePickJoker(asSocket(alpha.socket), {
      roundId: game.rounds[1].id,
    });
    const phone = await game.connectPlayer();

    await game.gateway.handleJoinPlayers(asSocket(phone), {
      teamName: 'Alpha',
      teamToken: alpha.teamToken,
      joinCode: game.joinCode,
      previousSocketId: alpha.socket.id,
    });

    const accepted = phone.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
    ) as [string, { teamView: { doubledRounds: unknown[] } }];
    expect(accepted[1].teamView.doubledRounds).toEqual([
      expect.objectContaining({ roundId: game.rounds[1].id, roundNumber: 2 }),
    ]);
  });

  it('names the extra points a scored answer in the joker round earns, equal live and on resync', async () => {
    const game = await harness.createGateway({
      rounds: [1, 2].map((number) => ({
        title: `Round ${number}`,
        breakAfter: true,
        questions: [
          {
            type: 'multiple_choice' as const,
            prompt: `Question of round ${number}?`,
            answer: 'right',
            points: 3,
            payload: { options: ['right', 'wrong'] },
          },
        ],
      })),
      teamNames: ['Alpha'],
      settings: { showRoundOverview: true, jokersEnabled: true },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    await game.act('ADVANCE'); // -> joker_pick
    const [alpha] = game.teams;
    await game.gateway.handlePickJoker(asSocket(alpha.socket), {
      roundId: game.rounds[0].id,
    });
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open
    await game.gateway.handleSubmitAnswer(asSocket(alpha.socket), {
      questionId: game.rounds[0].questionIds[0],
      teamId: alpha.teamId,
      value: 'right',
    });
    for (let i = 0; i < 4; i += 1) await game.act('ADVANCE'); // reveal entry sends the grades

    expect(teamViewsTo(game, alpha).at(-1)?.jokerExtras).toEqual({
      [game.rounds[0].questionIds[0]]: 3,
    });
    await expectLiveEqualsResync(game, alpha);
  });

  it('after leaving the lobby, the last team view carries the starting coins, equal to a rejoin', async () => {
    const game = await harness.createGateway({
      teamNames: ['Alpha'],
      settings: { powerUpsEnabled: true, startingCoins: 3 },
    });
    const [alpha] = game.teams;
    await game.act('START_QUIZ');

    expect(teamViewsTo(game, alpha).at(-1)?.coins).toBe(3);
    await expectLiveEqualsResync(game, alpha);
  });

  it('after a power-up purchase, the last team view carries the purchase and the coins left, equal to a rejoin', async () => {
    const game = await harness.createGateway({
      teamNames: ['Alpha', 'Bravo'],
      settings: { powerUpsEnabled: true, startingCoins: 3 },
    });
    await game.openFirstQuestion(await game.connectAdmin());
    const [alpha, bravo] = game.teams;
    game.clearEmits();

    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'fifty_fifty',
      questionId: game.questionIds.multipleChoice,
    });

    const view = teamViewsTo(game, alpha).at(-1);
    expect(view?.coins).toBe(1); // 3 starting coins, a 50/50 costs 2
    expect(view?.purchases).toHaveLength(1);
    expect(teamViewsTo(game, bravo)).toEqual([]);
    await expectLiveEqualsResync(game, alpha);
  });

  it('after an extra joker purchase, the last team view lists the bought round as doubled, equal to a rejoin', async () => {
    const game = await harness.createGateway({
      rounds: [1, 2].map((number) => ({
        title: `Round ${number}`,
        breakAfter: true,
        questions: [
          {
            type: 'multiple_choice' as const,
            prompt: `Question of round ${number}?`,
            answer: 'right',
            points: 1,
            payload: { options: ['right', 'wrong'] },
          },
        ],
      })),
      teamNames: ['Alpha'],
      settings: { powerUpsEnabled: true, startingCoins: 10 },
    });
    await game.act('START_QUIZ');
    const [alpha] = game.teams;
    game.clearEmits();

    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[0].id,
    });

    const view = teamViewsTo(game, alpha).at(-1);
    expect(view?.purchases).toHaveLength(1);
    expect(view?.doubledRounds).toEqual([
      expect.objectContaining({ roundId: game.rounds[0].id }),
    ]);
    await expectLiveEqualsResync(game, alpha);
  });

  it('names a blind-bought extra joker round with an empty title', async () => {
    const game = await harness.createGateway({
      rounds: [1, 2].map((number) => ({
        title: `Round ${number}`,
        breakAfter: true,
        questions: [
          {
            type: 'multiple_choice' as const,
            prompt: `Question of round ${number}?`,
            answer: 'right',
            points: 1,
            payload: { options: ['right', 'wrong'] },
          },
        ],
      })),
      teamNames: ['Alpha'],
      settings: { powerUpsEnabled: true, startingCoins: 10 },
    });
    await game.act('START_QUIZ');
    const [alpha] = game.teams;

    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[0].id,
    });

    expect(teamViewsTo(game, alpha).at(-1)?.doubledRounds).toEqual([
      expect.objectContaining({ roundId: game.rounds[0].id, title: '' }),
    ]);
  });

  it('carries the team view in the join reply next to its identity', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    const accepted = team.socket.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
    ) as [string, unknown];

    expect(accepted[1]).toMatchObject({
      teamView: { answers: [], playerCount: null, doubledRounds: [] },
    });
  });
});
