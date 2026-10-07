import { asSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const NO_LONGER_ACCEPTING =
  'This showdown round is no longer accepting guesses';
const NO_TIE = 'No tie for first place to break';
const SHOWDOWN_POINTS = 5;
const BREAKING_BONUS_POINTS = 3;

describe('GameGateway — showdown guesses and rounds are checked inside the session write', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
    await tieOnFirstQuestion(game, game.teams);
    await game.act('END_QUIZ');
  });

  async function createRound() {
    const admin = await game.connectAdmin();
    return game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many people are in this room?',
      answer: '42',
      points: SHOWDOWN_POINTS,
    });
  }

  async function guess(teamIndex: number, value: string) {
    const { socket, teamId } = game.teams[teamIndex];
    const { activeShowdown } = await game.snapshot();
    return game.gateway.handleSubmitShowdownGuess(asSocket(socket), {
      showdownRoundId: activeShowdown!.id,
      teamId,
      value,
    });
  }

  it('refuses a guess sent while the first reveal step is held on its save, and keeps the earlier guess', async () => {
    await createRound();
    await guess(0, '40');
    await guess(1, '50');
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const pressing = game.act('ADVANCE');
    await held.started;

    const waiting = game.nextWriteWaiting();
    const guessing = guess(1, '42');
    await waiting;
    held.release();
    const [, reply] = await Promise.all([pressing, guessing]);

    expect(reply).toEqual({ success: false, error: NO_LONGER_ACCEPTING });
    const second = await game.act('ADVANCE');
    expect(second.activeShowdown?.participants[1].guess).toBe('50');
  });

  it('counts a guess held on its store when the reveal is pressed behind it', async () => {
    await createRound();
    await guess(0, '40');
    const held = holdNextCall(game.showdownService, 'submitGuess');
    const guessing = guess(1, '42');
    await held.started;

    const waiting = game.nextWriteWaiting();
    const pressing = game.act('ADVANCE');
    await waiting;
    held.release();
    await Promise.all([guessing, pressing]);

    await game.act('ADVANCE');
    const final = await game.act('ADVANCE');
    expect(final.activeShowdown?.winnerTeamId).toBe(game.teams[1].teamId);
  });

  it('creates no round when a bonus held on its save breaks the tie first', async () => {
    const admin = await game.connectAdmin();
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: game.teams[0].teamId,
      category: 'shot',
      points: BREAKING_BONUS_POINTS,
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const creating = createRound();
    await waiting;
    held.release();
    const [, reply] = await Promise.all([awarding, creating]);

    expect(reply).toEqual({ success: false, error: NO_TIE });
    expect((await game.snapshot()).activeShowdown).toBeNull();
  });
});
