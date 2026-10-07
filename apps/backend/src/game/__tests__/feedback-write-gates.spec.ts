import {
  SOCKET_EVENTS,
  type AckResult,
  type GameStatus,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  tieOnFirstQuestion,
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 40;

const TWO_ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Music',
    questions: [{ type: 'free_text', prompt: 'Q1', answer: 'a', points: 1 }],
  },
  {
    title: 'Film',
    breakAfter: true,
    questions: [{ type: 'free_text', prompt: 'Q2', answer: 'b', points: 1 }],
  },
];

async function advanceUntil(
  game: RealStoreGateway,
  isDone: (status: GameStatus) => boolean,
): Promise<GameStatus> {
  let snapshot = await game.snapshot();
  for (let i = 0; i < MAX_ADVANCES; i += 1) {
    if (isDone(snapshot.progress.status)) return snapshot.progress.status;
    snapshot = await game.act('ADVANCE');
  }
  throw new Error('Never reached the wanted status');
}

function rate(
  game: RealStoreGateway,
  team: JoinedTeam,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleRateRound(asSocket(team.socket), payload);
}

function send(
  game: RealStoreGateway,
  team: JoinedTeam,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleSendFeedback(asSocket(team.socket), payload);
}

/** What JOIN_ACCEPTED carries for a team that rejoins on a fresh socket. */
async function rejoinPayload(
  game: RealStoreGateway,
  team: JoinedTeam,
  teamName: string,
): Promise<{ roundRatings: unknown; feedback: unknown }> {
  const socket = await game.connectPlayer();
  await game.gateway.handleJoinPlayers(asSocket(socket), {
    teamName,
    teamToken: team.teamToken,
    joinCode: game.joinCode,
    previousSocketId: team.socket.id,
  });
  const accepted = socket.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, { roundRatings: unknown; feedback: unknown }];
  return accepted[1];
}

describe('GameGateway — rating and feedback are checked inside the session write', () => {
  const harness = setupRealStoreGatewayTest();

  async function createGame(): Promise<{
    game: RealStoreGateway;
    team: JoinedTeam;
  }> {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: TWO_ROUNDS,
    });
    await game.act('START_QUIZ');
    return { game, team: game.teams[0] };
  }

  it('refuses a rating sent while the press out of the break is held, and stores nothing', async () => {
    const { game, team } = await createGame();
    await advanceUntil(game, (status) => status === 'break_intro');
    const roundId = game.rounds[0].id;

    const held = holdNextCall(game.progressRepository, 'save');
    const press = game.act('ADVANCE');
    await held.started;
    const waiting = game.nextWriteWaiting();
    const rating = rate(game, team, { roundId, stars: 4 });
    await waiting;
    held.release();
    const [, ack] = await Promise.all([press, rating]);

    expect(ack).toEqual({
      success: false,
      error: "This round can't be rated right now",
    });
    const accepted = await rejoinPayload(game, team, 'The Quizzards');
    expect(accepted.roundRatings).toEqual([]);
  });

  it('saves a rating sent first, held on its store while the press goes ahead', async () => {
    const { game, team } = await createGame();
    await advanceUntil(game, (status) => status === 'break_intro');
    const roundId = game.rounds[0].id;

    const held = holdNextCall(game.feedbackService, 'rateRound');
    const rating = rate(game, team, { roundId, stars: 4 });
    await held.started;
    const waiting = game.nextWriteWaiting();
    const press = game.act('ADVANCE');
    await waiting;
    held.release();
    const [ack] = await Promise.all([rating, press]);

    expect(ack).toEqual({ success: true });
    const accepted = await rejoinPayload(game, team, 'The Quizzards');
    expect(accepted.roundRatings).toEqual([{ roundId, stars: 4 }]);
  });

  it('refuses final feedback sent while the showdown that closes the final form is queued', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A', 'Team B', 'Team C'],
    });
    await tieOnFirstQuestion(game, game.teams.slice(0, 2));
    await game.act('END_QUIZ');
    const teamC = game.teams[2];
    const admin = await game.connectAdmin();

    // An earlier write in flight, so the showdown's write has to queue.
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const bonus = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: teamC.teamId,
      category: 'shot',
      points: 1,
    });
    await held.started;
    const showdownQueued = game.nextWriteWaiting();
    const showdown = game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many?',
      answer: '100',
      points: 5,
    });
    await showdownQueued;
    const feedbackQueued = game.nextWriteWaiting();
    const feedback = send(game, teamC, { comment: 'Great', topics: [] });
    await feedbackQueued;
    held.release();
    const [, , ack] = await Promise.all([bonus, showdown, feedback]);

    expect(ack).toEqual({
      success: false,
      error: "Feedback can't be sent right now",
    });
    const accepted = await rejoinPayload(game, teamC, 'Team C');
    expect(accepted.feedback).toEqual({ comment: '', topics: [] });
  });
});
