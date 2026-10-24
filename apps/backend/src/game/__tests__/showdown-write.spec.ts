import { Logger } from '@nestjs/common';
import { asSocket } from '@/game/__tests__/test-utils';
import {
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

  afterEach(() => {
    jest.restoreAllMocks();
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
    const held = game.holdAt('standings');
    const pressing = game.act('ADVANCE');
    await held.reached;

    const waiting = game.nextQueued();
    const guessing = guess(1, '42');
    await waiting;
    await game.letOthersRun();
    held.release();
    const [, reply] = await Promise.all([pressing, guessing]);

    expect(reply).toEqual({ success: false, error: NO_LONGER_ACCEPTING });
    const second = await game.act('ADVANCE');
    expect(second.activeShowdown?.participants[1].guess).toBe('50');
  });

  it('counts a guess held on its store when the reveal is pressed behind it', async () => {
    await createRound();
    await guess(0, '40');
    const held = game.holdAt('change');
    const guessing = guess(1, '42');
    await held.reached;

    const waiting = game.nextQueued();
    const pressing = game.act('ADVANCE');
    await waiting;
    await game.letOthersRun();
    held.release();
    await Promise.all([guessing, pressing]);

    await game.act('ADVANCE');
    const final = await game.act('ADVANCE');
    expect(final.activeShowdown?.winnerTeamId).toBe(game.teams[1].teamId);
  });

  it('refuses a round whose answer is not numeric with the showdown service message, and creates none', async () => {
    const admin = await game.connectAdmin();

    const reply = await game.gateway.handleCreateShowdownRound(
      asSocket(admin),
      { question: 'How many?', answer: 'lots', points: SHOWDOWN_POINTS },
    );

    expect(reply).toEqual({
      success: false,
      error: 'A showdown answer must be numeric',
    });
    expect((await game.snapshot()).activeShowdown).toBeNull();
  });

  it('does not pass an unexpected showdown service failure off as a refusal', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest
      .spyOn(game.showdownService, 'createRound')
      .mockRejectedValueOnce(new Error('database unreachable'));

    const reply = await createRound();

    expect(reply).not.toEqual({
      success: false,
      error: 'database unreachable',
    });
    expect(reply).toMatchObject({ success: false });
  });

  it('refuses a second round while one is in progress with the showdown service message', async () => {
    await createRound();

    const reply = await createRound();

    expect(reply).toEqual({
      success: false,
      error: 'A showdown round is already in progress for this session',
    });
  });

  it('creates no round when a bonus held on its save breaks the tie first', async () => {
    const admin = await game.connectAdmin();
    const held = game.holdAt('standings');
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: game.teams[0].teamId,
      category: 'shot',
      points: BREAKING_BONUS_POINTS,
    });
    await held.reached;

    const waiting = game.nextQueued();
    const creating = createRound();
    await waiting;
    await game.letOthersRun();
    held.release();
    const [, reply] = await Promise.all([awarding, creating]);

    expect(reply).toEqual({ success: false, error: NO_TIE });
    expect((await game.snapshot()).activeShowdown).toBeNull();
  });
});
