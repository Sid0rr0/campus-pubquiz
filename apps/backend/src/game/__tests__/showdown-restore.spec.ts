import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const SHOWDOWN_POINTS = 5;

/**
 * The showdown round on air is cached in memory; a backend that restarts
 * mid-showdown must rebuild it from its stored round, or the guesses vanish
 * and the unresolved row refuses a new round, stranding the tiebreak.
 */
describe('GameGateway — a restored session keeps its showdown in progress', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
    await tieOnFirstQuestion(game, game.teams);
    await game.act('END_QUIZ');
    const admin = await game.connectAdmin();
    await game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many people are in this room?',
      answer: '42',
      points: SHOWDOWN_POINTS,
    });
    const { socket, teamId } = game.teams[0];
    const { activeShowdown } = await game.snapshot();
    await game.gateway.handleSubmitShowdownGuess(asSocket(socket), {
      showdownRoundId: activeShowdown!.id,
      teamId,
      value: '40',
    });
  });

  it('shows the round and who has guessed after a restart', async () => {
    const before = (await game.snapshot()).activeShowdown!;

    const restarted = await game.restart();

    const after = (await restarted.snapshot()).activeShowdown;
    expect(after?.id).toBe(before.id);
    expect(after?.question).toBe('How many people are in this room?');
    expect(after?.participants.map((p) => p.hasGuessed)).toEqual([true, false]);
  });

  it('lets the last team guess and the reveal resolve after a restart', async () => {
    const restarted = await game.restart();
    const { teamId, teamToken } = game.teams[1];
    const device = await restarted.connectPlayer();
    await restarted.gateway.handleJoinPlayers(asSocket(device), {
      teamName: 'Team B',
      teamToken,
      joinCode: restarted.joinCode,
    });
    const { activeShowdown } = await restarted.snapshot();

    const reply = await restarted.gateway.handleSubmitShowdownGuess(
      asSocket(device),
      { showdownRoundId: activeShowdown!.id, teamId, value: '42' },
    );
    await restarted.act('ADVANCE');
    await restarted.act('ADVANCE');
    const final = await restarted.act('ADVANCE');

    expect(reply).toMatchObject({ success: true });
    expect(final.activeShowdown?.winnerTeamId).toBe(teamId);
  });
});
