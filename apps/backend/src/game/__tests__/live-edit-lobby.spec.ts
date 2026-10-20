import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type ImportRoundPreview,
  type SocketRoomName,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const freeText = (prompt: string, answer: string, points = 2) => ({
  type: 'free_text' as const,
  prompt,
  answer,
  points,
});

const ROUNDS = [
  {
    title: 'Round A',
    breakAfter: true,
    questions: [
      freeText('Q1', 'Jupiter'),
      freeText('Q2', 'Mars'),
      freeText('Q3', 'Venus'),
    ],
  },
];

const RENAMED = 'Planets';

/** Corrects Q1's answer, adds Q1b after it, deletes Q2 and renames the round. */
const editEverything = (rounds: ImportRoundPreview[]): ImportRoundPreview[] =>
  rounds.map((round) => {
    const [q1, , q3] = round.questions;
    return {
      ...round,
      title: RENAMED,
      questions: [
        { ...q1, answer: 'Saturn' },
        { ...q1, questionId: undefined, prompt: 'Q1b', answer: 'Uranus' },
        q3,
      ],
    };
  });

describe('Live edit — saving a quiz while a session waits in the lobby', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: ROUNDS,
      teamNames: ['Saturn Fans'],
    });
    await game.connectAdmin();
    game.clearEmits();
  });

  const lastSnapshot = <Room extends SocketRoomName>(room: Room) =>
    game
      .payloadsTo<StateViewByRoom[Room]>(room, SOCKET_EVENTS.STATE_UPDATED)
      .at(-1);

  it('plays the saved quiz once Start quiz is pressed: titles, added and deleted questions, the corrected answer', async () => {
    const [team] = game.teams;
    const [q1] = game.rounds[0].questionIds;
    await game.saveQuizEdit(editEverything);

    expect(lastSnapshot(SOCKET_ROOMS.ADMIN)?.roundTitles).toEqual([RENAMED]);
    expect(lastSnapshot(SOCKET_ROOMS.DISPLAY)?.roundTitles).toEqual([RENAMED]);

    await game.act('START_QUIZ');
    const intro = await game.act('ADVANCE');
    expect(intro.roundTitle).toBe(RENAMED);

    const first = await game.act('ADVANCE');
    expect(first.currentQuestion?.prompt).toBe('Q1');
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: q1,
      teamId: team.teamId,
      value: 'Saturn',
    });
    const answers = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, q1),
    );
    expect(answers.map((answer) => answer.pointsAwarded)).toEqual([2]);

    const opened = [first.currentQuestion?.prompt];
    opened.push((await game.act('ADVANCE')).currentQuestion?.prompt);
    opened.push((await game.act('ADVANCE')).currentQuestion?.prompt);
    expect(opened).toEqual(['Q1', 'Q1b', 'Q3']);

    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> break intro
    await game.act('ADVANCE'); // -> reveal_intro
    const revealed = await game.act('ADVANCE'); // -> reveal
    expect(
      revealed.revealQuestions.map((q) => [q.revealKind, q.answer]),
    ).toEqual([
      ['answer', 'Saturn'],
      ['answer', 'Uranus'],
      ['answer', 'Venus'],
    ]);
  });
});

describe('Live edit — a changed round setting while a session waits in the lobby', () => {
  const harness = setupRealStoreGatewayTest();

  it('takes effect in the lobby session: the break moves to the other round and the round turns kahoot', async () => {
    const game = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [
            {
              type: 'multiple_choice' as const,
              prompt: 'Capital of France?',
              answer: 'Paris',
              points: 2,
              payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
            },
          ],
        },
        { ...ROUNDS[0], title: 'Round B', breakAfter: false },
        { ...ROUNDS[0], title: 'Round C', breakAfter: false },
      ],
    });
    await game.connectAdmin();
    // The last round always ends a block.
    expect((await game.snapshot()).quizStructure.breakRoundNumbers).toEqual([
      1, 3,
    ]);

    await game.saveQuizEdit((rounds) =>
      rounds.map((round, index) => ({
        ...round,
        breakAfter: index === 1,
        kahootMode: index === 0,
      })),
    );

    const view = await game.snapshot();
    expect(view.quizStructure.breakRoundNumbers).toEqual([2, 3]);
    await game.act('START_QUIZ');
    expect((await game.act('ADVANCE')).isCurrentRoundKahoot).toBe(true);
  });
});

const TWO_ROUNDS = [
  {
    title: 'Round A',
    breakAfter: true,
    questions: [freeText('Q1', 'Jupiter')],
  },
  {
    title: 'Round B',
    breakAfter: true,
    questions: [freeText('Q2', 'Mars')],
  },
];

const renameRoundB = (rounds: ImportRoundPreview[]): ImportRoundPreview[] =>
  rounds.map((round, index) =>
    index === 1 ? { ...round, title: RENAMED } : round,
  );

describe('Live edit — a save with sessions in different states', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function createSecondSession(): Promise<string> {
    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    await game.connectAdmin(created.joinCode);
    return created.joinCode;
  }

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUNDS });
    await game.connectAdmin();
  });

  it('checks the frontier against the running session only and reloads both it and the lobby session', async () => {
    await game.openFirstQuestion(await game.connectAdmin());
    const lobbyJoinCode = await createSecondSession();

    await game.saveQuizEdit(renameRoundB);

    for (const joinCode of [game.joinCode, lobbyJoinCode]) {
      const view = await game.snapshot(joinCode);
      expect(view.roundTitles).toEqual(['Round A', RENAMED]);
    }
  });

  it('never refuses a save because of a session in the lobby', async () => {
    await createSecondSession();

    await expect(
      game.saveQuizEdit((rounds) => [...rounds].reverse()), // a running session would refuse this
    ).resolves.toBeDefined();
  });

  it('leaves an ended session as it was played', async () => {
    const single = await harness.createGateway({
      joinCode: 'ENDED1',
      rounds: [TWO_ROUNDS[0]],
    });
    await single.connectAdmin();
    await single.act('START_QUIZ');
    for (let step = 0; step < 7; step += 1) await single.act('ADVANCE');
    expect((await single.snapshot()).progress.status).toBe('ended');

    await single.saveQuizEdit((rounds) =>
      rounds.map((round) => ({ ...round, title: RENAMED })),
    );

    expect((await single.snapshot()).roundTitles).toEqual(['Round A']);
  });
});
