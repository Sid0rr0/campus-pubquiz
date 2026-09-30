import {
  SOCKET_EVENTS,
  type GameStatus,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 20;

/** Drives ADVANCE until the session reaches the given status, or throws after a generous cap. */
async function advanceUntilStatus(
  game: RealStoreGateway,
  status: GameStatus,
): Promise<StateSnapshotPayload> {
  let snapshot = await game.snapshot();
  for (let i = 0; i < MAX_ADVANCES; i += 1) {
    if (snapshot.progress.status === status) return snapshot;
    snapshot = await game.act('ADVANCE');
  }
  throw new Error(`Never reached status "${status}"`);
}

describe('GameGateway — team answers sync on reveal entry', () => {
  const harness = setupRealStoreGatewayTest();

  function teamSyncs(game: RealStoreGateway, socketId: string) {
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(socketId) &&
          emit.event === SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      );
  }

  /** Starts the quiz and has the first team submit a wrong answer to the first question. */
  async function startWithAnswer(game: RealStoreGateway): Promise<void> {
    const [{ socket, teamId }] = game.teams;
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> first question
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Banana',
    });
  }

  it("pushes the team's own answers privately once the block reaches reveal_intro", async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [{ socket }] = game.teams;
    await startWithAnswer(game);

    await advanceUntilStatus(game, 'reveal_intro');

    const [sync] = teamSyncs(game, socket.id);
    expect(sync.payload).toEqual({
      answers: [
        expect.objectContaining({
          questionId: game.questionIds.multipleChoice,
          value: 'Banana',
          pointsAwarded: 0,
        }),
      ],
    });
  });

  it('includes the graded closest_guess points and verdict, so phones needn’t look themselves up in the reveal list', async () => {
    const game = await harness.createGateway({
      teamNames: ['Near', 'Far'],
      rounds: [
        {
          title: 'Estimation',
          breakAfter: true,
          questions: [
            {
              type: 'closest_guess',
              prompt: 'How many jelly beans?',
              answer: '500',
              points: 3,
            },
          ],
        },
      ],
    });
    const [near, far] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
    await game.gateway.handleSubmitAnswer(asSocket(near.socket), {
      questionId,
      teamId: near.teamId,
      value: '480',
    });
    await game.gateway.handleSubmitAnswer(asSocket(far.socket), {
      questionId,
      teamId: far.teamId,
      value: '650',
    });

    await advanceUntilStatus(game, 'reveal_intro');

    expect(teamSyncs(game, near.socket.id)[0].payload).toEqual({
      answers: [
        expect.objectContaining({
          questionId,
          pointsAwarded: 3,
          verdict: 'correct',
        }),
      ],
    });
    expect(teamSyncs(game, far.socket.id)[0].payload).toEqual({
      answers: [
        expect.objectContaining({
          questionId,
          pointsAwarded: 0,
          verdict: 'incorrect',
        }),
      ],
    });
  });

  it('does not push to a team that is not currently connected', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [{ socket }] = game.teams;
    await startWithAnswer(game);
    await game.gateway.handleDisconnect(asSocket(socket));

    await advanceUntilStatus(game, 'reveal_intro');

    expect(game.roomEmits().map((emit) => emit.event)).not.toContain(
      SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
    );
  });

  it('does not push again on a later ADVANCE while already revealing', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [{ socket }] = game.teams;
    await startWithAnswer(game);
    await advanceUntilStatus(game, 'reveal_intro');
    game.clearEmits();

    const revealing = await game.act('ADVANCE'); // -> reveal

    expect(revealing.progress.status).toBe('reveal');
    expect(teamSyncs(game, socket.id)).toEqual([]);
  });

  // kahootMode collapses 'locking' straight into 'reveal', skipping
  // 'reveal_intro' entirely (see getNextGameState) — without a matching
  // branch in syncTeamAnswersOnRevealEntry, a kahootMode team's reveal
  // screen would keep showing the pre-speed-scoring grade cached from
  // ANSWER_RECEIVED at submit time instead of the rescaled points.
  it("pushes the team's own answers privately when a kahootMode question collapses locking straight into reveal", async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      kahootMode: true,
    });
    const [{ socket }] = game.teams;
    await startWithAnswer(game);

    await advanceUntilStatus(game, 'reveal');

    const [sync] = teamSyncs(game, socket.id);
    expect(sync.payload).toEqual({
      answers: [
        expect.objectContaining({
          questionId: game.questionIds.multipleChoice,
          value: 'Banana',
        }),
      ],
    });
  });
});
