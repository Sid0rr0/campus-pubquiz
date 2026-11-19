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
