import {
  SOCKET_EVENTS,
  type AckResult,
  type GameStatus,
  type JoinAcceptedPayload,
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
const NOTHING_ANSWERED = { pacing: null, feltDifficulty: null };

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

function rateSession(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleRateSession(asSocket(team.socket), payload);
}

function send(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
  payload: unknown,
): Promise<AckResult> {
  return game.gateway.handleSendFeedback(asSocket(team.socket), payload);
}

/** Rejoins the team on a fresh socket, as a phone reconnecting would, and returns what JOIN_ACCEPTED carried. */
async function rejoin(
  game: RealStoreGateway,
  team: JoinedTeam,
  teamName: string,
): Promise<Pick<JoinAcceptedPayload, 'sessionRatings' | 'feedback'>> {
  const socket = await game.connectPlayer();
  await game.gateway.handleJoinPlayers(asSocket(socket), {
    teamName,
    teamToken: team.teamToken,
    joinCode: game.joinCode,
    previousSocketId: team.socket.id,
  });
  const accepted = socket.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, JoinAcceptedPayload];
  return accepted[1];
}

describe('GameGateway — pacing and felt difficulty on the final form', () => {
  const harness = setupRealStoreGatewayTest();

  async function atEnded(
    teamNames = ['The Quizzards'],
    collectFeedback = true,
  ): Promise<{ game: RealStoreGateway; team: JoinedTeam }> {
    const game = await harness.createGateway({
      teamNames,
      rounds: TWO_ROUNDS,
      settings: { collectFeedback },
    });
    await game.act('START_QUIZ');
    await advanceUntilStatus(game, 'ended');
    return { game, team: game.teams[0] };
  }

  it('carries no answer on either scale for a team that gave none', async () => {
    const { game, team } = await atEnded();

    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual(
      NOTHING_ANSWERED,
    );
  });

  it('acknowledges each scale at ended, and a reconnect carries both answers', async () => {
    const { game, team } = await atEnded();

    const pacingAck = await rateSession(game, team, {
      scale: 'pacing',
      value: 'too_slow',
    });
    const difficultyAck = await rateSession(game, team, {
      scale: 'feltDifficulty',
      value: 'too_hard',
    });

    expect(pacingAck).toEqual({ success: true });
    expect(difficultyAck).toEqual({ success: true });
    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual({
      pacing: 'too_slow',
      feltDifficulty: 'too_hard',
    });
  });

  it('replaces the earlier answer on that scale only', async () => {
    const { game, team } = await atEnded();
    await rateSession(game, team, { scale: 'pacing', value: 'too_slow' });
    await rateSession(game, team, {
      scale: 'feltDifficulty',
      value: 'too_easy',
    });

    await rateSession(game, team, { scale: 'pacing', value: 'just_right' });

    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual({
      pacing: 'just_right',
      feltDifficulty: 'too_easy',
    });
  });

  it.each([
    ['an unknown scale', { scale: 'mood', value: 'just_right' }],
    ['a value from the other scale', { scale: 'pacing', value: 'too_hard' }],
    ['a cleared answer', { scale: 'pacing', value: null }],
  ])('refuses %s and saves nothing', async (_name, payload) => {
    const { game, team } = await atEnded();

    const ack = await rateSession(game, team, payload);

    expect(ack.success).toBe(false);
    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual(
      NOTHING_ANSWERED,
    );
  });

  it('refuses a socket with no team link, with a reason', async () => {
    const { game } = await atEnded();
    const stranger = await game.connectPlayer();

    const ack = await rateSession(
      game,
      { socket: stranger },
      { scale: 'pacing', value: 'too_fast' },
    );

    expect(ack).toEqual({
      success: false,
      error: 'Join a team before sending feedback',
    });
  });

  it('refuses an answer when feedback is off for the session, and saves nothing', async () => {
    const { game, team } = await atEnded(['The Quizzards'], false);

    const ack = await rateSession(game, team, {
      scale: 'pacing',
      value: 'too_fast',
    });

    expect(ack).toEqual({
      success: false,
      error: 'Feedback is off for this session',
    });
    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual(
      NOTHING_ANSWERED,
    );
  });

  it.each(['question_open', 'break_intro'] as const)(
    'refuses an answer in %s, with a reason',
    async (status) => {
      const game = await harness.createGateway({
        teamNames: ['The Quizzards'],
        rounds: TWO_ROUNDS,
      });
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, status);

      const ack = await rateSession(game, game.teams[0], {
        scale: 'pacing',
        value: 'too_fast',
      });

      expect(ack).toEqual({ success: false, error: NOT_OPEN_REASON });
    },
  );

  it('refuses an answer while a showdown is still being played', async () => {
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

    const ack = await rateSession(game, game.teams[0], {
      scale: 'feltDifficulty',
      value: 'too_hard',
    });

    expect(ack).toEqual({ success: false, error: NOT_OPEN_REASON });
  });

  it('keeps the answers when the team sends its comment afterwards', async () => {
    const { game, team } = await atEnded();
    await rateSession(game, team, { scale: 'pacing', value: 'too_fast' });
    await rateSession(game, team, {
      scale: 'feltDifficulty',
      value: 'just_right',
    });

    await send(game, team, { comment: 'Great night', topics: ['Space'] });
    await send(game, team, { comment: 'Great night!', topics: [] });

    const accepted = await rejoin(game, team, 'The Quizzards');
    expect(accepted.sessionRatings).toEqual({
      pacing: 'too_fast',
      feltDifficulty: 'just_right',
    });
    expect(accepted.feedback).toEqual({ comment: 'Great night!', topics: [] });
  });

  it('keeps the comment and topics when the team answers afterwards', async () => {
    const { game, team } = await atEnded();
    await send(game, team, { comment: 'Great night', topics: ['Space'] });

    await rateSession(game, team, { scale: 'pacing', value: 'too_slow' });
    await rateSession(game, team, { scale: 'pacing', value: 'just_right' });

    const accepted = await rejoin(game, team, 'The Quizzards');
    expect(accepted.feedback).toEqual({
      comment: 'Great night',
      topics: ['Space'],
    });
    expect(accepted.sessionRatings).toEqual({
      pacing: 'just_right',
      feltDifficulty: null,
    });
  });

  it("never carries one team's answers on another team's join", async () => {
    const { game, team } = await atEnded(['The Quizzards', 'The Rivals']);
    const rival = game.teams[1];
    await rateSession(game, team, { scale: 'pacing', value: 'too_slow' });
    await rateSession(game, rival, {
      scale: 'feltDifficulty',
      value: 'too_easy',
    });

    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual({
      pacing: 'too_slow',
      feltDifficulty: null,
    });
    expect((await rejoin(game, rival, 'The Rivals')).sessionRatings).toEqual({
      pacing: null,
      feltDifficulty: 'too_easy',
    });
  });

  it('keeps the answers when the quiz steps back out of ended', async () => {
    const { game, team } = await atEnded();
    await rateSession(game, team, { scale: 'pacing', value: 'too_fast' });

    await game.act('TOGGLE_LEADERBOARD');
    await game.act('PREVIOUS');

    expect((await rejoin(game, team, 'The Quizzards')).sessionRatings).toEqual({
      pacing: 'too_fast',
      feltDifficulty: null,
    });
  });

  it('broadcasts nothing', async () => {
    const { game, team } = await atEnded();
    game.clearEmits();

    await rateSession(game, team, { scale: 'pacing', value: 'too_fast' });
    await game.settled();

    expect(game.roomEmits()).toEqual([]);
  });

  it('refuses an answer from an admin socket', async () => {
    const { game } = await atEnded();
    const admin = await game.connectAdmin();

    const ack = await game.gateway.handleRateSession(asSocket(admin), {
      scale: 'pacing',
      value: 'too_fast',
    });

    expect(ack.success).toBe(false);
  });
});
