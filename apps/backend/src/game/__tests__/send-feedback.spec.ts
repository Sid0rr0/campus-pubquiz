import {
  SOCKET_EVENTS,
  type AckResult,
  type GameStatus,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 40;
const NOT_OPEN_REASON = "Feedback can't be sent right now";

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

function send(
  game: RealStoreGateway,
  team: JoinedTeam,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleSendFeedback(asSocket(team.socket), payload);
}

/** Rejoins the team on a fresh socket, as a phone reconnecting would, and returns the feedback JOIN_ACCEPTED carried. */
async function rejoin(
  game: RealStoreGateway,
  team: JoinedTeam,
  teamName: string,
): Promise<unknown> {
  const socket = await game.connectPlayer();
  await game.gateway.handleJoinPlayers(asSocket(socket), {
    teamName,
    teamToken: team.teamToken,
    joinCode: game.joinCode,
    previousSocketId: team.socket.id,
  });
  const accepted = socket.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, { feedback: unknown }];
  return accepted[1].feedback;
}

describe('GameGateway — the comment and topic suggestions on the final form', () => {
  const harness = setupRealStoreGatewayTest();

  async function atEnded(
    teamNames = ['The Quizzards'],
  ): Promise<{ game: RealStoreGateway; team: JoinedTeam }> {
    const game = await harness.createGateway({
      teamNames,
      rounds: TWO_ROUNDS,
    });
    await game.act('START_QUIZ');
    await advanceUntilStatus(game, 'ended');
    return { game, team: game.teams[0] };
  }

  it('acknowledges feedback at ended, and a reconnect carries the comment and topics', async () => {
    const { game, team } = await atEnded();

    const ack = await send(game, team, {
      comment: 'Loved the music round',
      topics: ['Geography', '90s films'],
    });

    expect(ack).toEqual({ success: true });
    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: 'Loved the music round',
      topics: ['Geography', '90s films'],
    });
  });

  it('carries an empty comment and no topics for a team that sent nothing', async () => {
    const { game, team } = await atEnded();

    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: '',
      topics: [],
    });
  });

  it('replaces the earlier comment and topics when sent again', async () => {
    const { game, team } = await atEnded();
    await send(game, team, { comment: 'first', topics: ['A', 'B', 'C'] });

    await send(game, team, { comment: 'second', topics: ['D'] });

    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: 'second',
      topics: ['D'],
    });
  });

  it('trims topics and drops empty and whitespace-only ones', async () => {
    const { game, team } = await atEnded();

    const ack = await send(game, team, {
      comment: '',
      topics: ['  Geography ', '', '   ', '\t', 'Space'],
    });

    expect(ack).toEqual({ success: true });
    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: '',
      topics: ['Geography', 'Space'],
    });
  });

  it('accepts exactly the limits: 10 topics of 60 characters and a 1000-character comment', async () => {
    const { game, team } = await atEnded();
    const comment = 'c'.repeat(1000);
    const topics = Array.from({ length: 10 }, (_, i) => String(i).repeat(60));

    const ack = await send(game, team, { comment, topics });

    expect(ack).toEqual({ success: true });
    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment,
      topics,
    });
  });

  it.each([
    ['11 topics', { comment: '', topics: Array(11).fill('x') }],
    ['a 61-character topic', { comment: '', topics: ['x'.repeat(61)] }],
    ['a 1001-character comment', { comment: 'x'.repeat(1001), topics: [] }],
    ['a non-string topic', { comment: '', topics: [4] }],
    ['a missing comment', { topics: [] }],
  ])('refuses %s and saves nothing', async (_name, payload) => {
    const { game, team } = await atEnded();

    const ack = await send(game, team, payload);

    expect(ack.success).toBe(false);
    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: '',
      topics: [],
    });
  });

  it('keeps the earlier feedback when a later send is refused', async () => {
    const { game, team } = await atEnded();
    await send(game, team, { comment: 'kept', topics: ['A'] });

    const ack = await send(game, team, {
      comment: 'x'.repeat(1001),
      topics: [],
    });

    expect(ack.success).toBe(false);
    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: 'kept',
      topics: ['A'],
    });
  });

  it.each(['question_open', 'break_intro'] as const)(
    'refuses feedback in %s, with a reason',
    async (status) => {
      const game = await harness.createGateway({
        teamNames: ['The Quizzards'],
        rounds: TWO_ROUNDS,
      });
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, status);

      const ack = await send(game, game.teams[0], {
        comment: 'too early',
        topics: [],
      });

      expect(ack).toEqual({ success: false, error: NOT_OPEN_REASON });
    },
  );

  it('refuses feedback while a showdown is still being played', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A', 'Team B', 'Team C'],
    });
    await tieOnFirstQuestion(game, game.teams.slice(0, 2));
    const admin = await game.connectAdmin();
    await game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many?',
      answer: '100',
      points: 5,
    });
    await game.act('END_QUIZ');

    const ack = await send(game, game.teams[0], {
      comment: 'during the showdown',
      topics: [],
    });

    expect(ack).toEqual({ success: false, error: NOT_OPEN_REASON });
  });

  it("never carries one team's text on another team's join", async () => {
    const { game, team } = await atEnded(['The Quizzards', 'The Rivals']);
    const rival = game.teams[1];
    await send(game, team, { comment: 'ours', topics: ['Ours'] });
    await send(game, rival, { comment: 'theirs', topics: ['Theirs'] });

    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: 'ours',
      topics: ['Ours'],
    });
    expect(await rejoin(game, rival, 'The Rivals')).toEqual({
      comment: 'theirs',
      topics: ['Theirs'],
    });
  });

  it('keeps the feedback when the quiz steps back out of ended', async () => {
    const { game, team } = await atEnded();
    await send(game, team, { comment: 'kept', topics: ['A'] });

    await game.act('TOGGLE_LEADERBOARD');
    await game.act('PREVIOUS');

    expect(await rejoin(game, team, 'The Quizzards')).toEqual({
      comment: 'kept',
      topics: ['A'],
    });
  });

  it('broadcasts nothing', async () => {
    const { game, team } = await atEnded();
    game.clearEmits();

    await send(game, team, { comment: 'quiet', topics: ['A'] });
    await game.settled();

    expect(game.roomEmits()).toEqual([]);
  });

  it('refuses feedback from an admin socket', async () => {
    const { game } = await atEnded();
    const admin = await game.connectAdmin();

    const ack = await game.gateway.handleSendFeedback(asSocket(admin), {
      comment: 'sneaky',
      topics: [],
    });

    expect(ack.success).toBe(false);
  });
});
