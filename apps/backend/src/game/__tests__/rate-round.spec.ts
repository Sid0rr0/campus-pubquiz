import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
  type GameStatus,
  type PlayersStatePayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 40;

// Two blocks: rounds 1+2 end in a break, round 3 is a block of its own.
const THREE_ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Music',
    questions: [{ type: 'free_text', prompt: 'Q1', answer: 'a', points: 1 }],
  },
  {
    title: 'Film',
    breakAfter: true,
    questions: [{ type: 'free_text', prompt: 'Q2', answer: 'b', points: 1 }],
  },
  {
    title: 'Science',
    breakAfter: true,
    questions: [{ type: 'free_text', prompt: 'Q3', answer: 'c', points: 1 }],
  },
];

async function advanceUntilStatus(
  game: RealStoreGateway,
  status: GameStatus,
): Promise<void> {
  let snapshot = await game.snapshot();
  for (let i = 0; i < MAX_ADVANCES; i += 1) {
    if (snapshot.progress.status === status) return;
    snapshot = await game.act('ADVANCE');
  }
  throw new Error(`Never reached status "${status}"`);
}

function playersView(game: RealStoreGateway): PlayersStatePayload {
  return game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
}

function rate(
  game: RealStoreGateway,
  team: JoinedTeam,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleRateRound(asSocket(team.socket), payload);
}

/** Rejoins the team on a fresh socket, as a phone reconnecting would, and returns what JOIN_ACCEPTED carried. */
async function rejoin(
  game: RealStoreGateway,
  team: JoinedTeam,
  teamName: string,
): Promise<{ roundRatings: unknown }> {
  const socket = await game.connectPlayer();
  await game.gateway.handleJoinPlayers(asSocket(socket), {
    teamName,
    teamToken: team.teamToken,
    joinCode: game.joinCode,
    previousSocketId: team.socket.id,
  });
  const accepted = socket.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, { roundRatings: unknown }];
  return accepted[1];
}

describe('GameGateway — rating the rounds in the break', () => {
  const harness = setupRealStoreGatewayTest();

  async function atBreakIntro(): Promise<{
    game: RealStoreGateway;
    team: JoinedTeam;
  }> {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: THREE_ROUNDS,
    });
    await game.act('START_QUIZ');
    await advanceUntilStatus(game, 'break_intro');
    return { game, team: game.teams[0] };
  }

  describe('the feedback field of the players view', () => {
    it('lists the rounds of the block that just locked in break_intro', async () => {
      const { game } = await atBreakIntro();

      expect(playersView(game).feedback).toEqual({
        kind: 'break_card',
        rounds: [
          { id: game.rounds[0].id, title: 'Music' },
          { id: game.rounds[1].id, title: 'Film' },
        ],
      });
    });

    // The break review is walked backwards from break_intro: one step back
    // is the last question, two is its round's own title card.
    it.each([
      ['break', 1],
      ['break_round_intro', 2],
    ] as const)('still lists them in %s', async (status, stepsBack) => {
      const { game } = await atBreakIntro();
      for (let step = 0; step < stepsBack; step += 1) {
        await game.act('PREVIOUS');
      }
      expect((await game.snapshot()).progress.status).toBe(status);

      expect(playersView(game).feedback).toEqual({
        kind: 'break_card',
        rounds: [
          { id: game.rounds[0].id, title: 'Music' },
          { id: game.rounds[1].id, title: 'Film' },
        ],
      });
    });

    it('lists nothing during answering and reveal', async () => {
      const game = await harness.createGateway({
        teamNames: ['The Quizzards'],
        rounds: THREE_ROUNDS,
      });
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'question_open');
      expect(playersView(game).feedback).toBeNull();

      await advanceUntilStatus(game, 'reveal');
      expect(playersView(game).feedback).toBeNull();
    });

    it('lists the next block, and only it, in the following break', async () => {
      const { game } = await atBreakIntro();
      await advanceUntilStatus(game, 'reveal');
      await advanceUntilStatus(game, 'round_intro');
      await advanceUntilStatus(game, 'break_intro');

      expect(playersView(game).feedback).toEqual({
        kind: 'break_card',
        rounds: [{ id: game.rounds[2].id, title: 'Science' }],
      });
    });
  });

  describe('rating a round', () => {
    it('acknowledges a rating for a listed round, and rating again keeps only the last value', async () => {
      const { game, team } = await atBreakIntro();
      const roundId = game.rounds[0].id;

      const first = await rate(game, team, { roundId, stars: 2 });
      const second = await rate(game, team, { roundId, stars: 5 });

      expect(first).toEqual({ success: true });
      expect(second).toEqual({ success: true });
      const accepted = await rejoin(game, team, 'The Quizzards');
      expect(accepted.roundRatings).toEqual([{ roundId, stars: 5 }]);
    });

    it('broadcasts nothing', async () => {
      const { game, team } = await atBreakIntro();
      game.clearEmits();

      await rate(game, team, { roundId: game.rounds[0].id, stars: 4 });
      await game.settled();

      expect(game.roomEmits()).toEqual([]);
    });

    it('refuses a round outside the current block, with a reason', async () => {
      const { game, team } = await atBreakIntro();

      const ack = await rate(game, team, {
        roundId: game.rounds[2].id,
        stars: 3,
      });

      expect(ack).toEqual({
        success: false,
        error: "This round can't be rated right now",
      });
    });

    it('refuses a rating during answering', async () => {
      const game = await harness.createGateway({
        teamNames: ['The Quizzards'],
        rounds: THREE_ROUNDS,
      });
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'question_open');

      const ack = await rate(game, game.teams[0], {
        roundId: game.rounds[0].id,
        stars: 3,
      });

      expect(ack).toEqual({
        success: false,
        error: "This round can't be rated right now",
      });
    });

    it.each([0, 6, 2.5, '4'])('refuses %p stars', async (stars) => {
      const { game, team } = await atBreakIntro();

      const ack = await rate(game, team, {
        roundId: game.rounds[0].id,
        stars,
      });

      expect(ack.success).toBe(false);
      const accepted = await rejoin(game, team, 'The Quizzards');
      expect(accepted.roundRatings).toEqual([]);
    });

    it('refuses a rating from an admin socket', async () => {
      const { game } = await atBreakIntro();
      const admin = await game.connectAdmin();

      const ack = await game.gateway.handleRateRound(asSocket(admin), {
        roundId: game.rounds[0].id,
        stars: 4,
      });

      expect(ack.success).toBe(false);
    });
  });

  describe('reconnecting', () => {
    it("carries the team's own ratings and never another team's", async () => {
      const { game, team } = await atBreakIntro();
      const rival = await game.joinTeam('The Rivals');
      await rate(game, team, { roundId: game.rounds[0].id, stars: 4 });
      await rate(game, rival, { roundId: game.rounds[1].id, stars: 1 });

      const ours = await rejoin(game, team, 'The Quizzards');
      const theirs = await rejoin(game, rival, 'The Rivals');

      expect(ours.roundRatings).toEqual([
        { roundId: game.rounds[0].id, stars: 4 },
      ]);
      expect(theirs.roundRatings).toEqual([
        { roundId: game.rounds[1].id, stars: 1 },
      ]);
    });
  });
});
