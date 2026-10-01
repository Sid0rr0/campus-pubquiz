import { RequestContext } from '@mikro-orm/postgresql';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

// One block holding both human-graded types, an auto-graded free_text and
// multiple_choice, and the batch-graded closest_guess — every kind of
// question the ungraded set has a rule for.
const ONE_BLOCK_QUIZ: QuizRoundSpec[] = [
  {
    title: 'Everything Round',
    breakAfter: true,
    questions: [
      {
        type: 'audio',
        prompt: 'Which band is this?',
        answer: 'Queen',
        points: 2,
        payload: { mediaUrl: 'https://example.com/queen.mp3' },
      },
      {
        type: 'youtube',
        prompt: 'Which film is this clip from?',
        answer: 'Jaws',
        points: 2,
        payload: { mediaUrl: 'https://youtu.be/U1fu_sA7XhE' },
      },
      {
        type: 'free_text',
        prompt: 'Largest planet?',
        answer: 'Jupiter',
        points: 2,
      },
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 2,
        payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
      },
      {
        type: 'closest_guess',
        prompt: 'How many bones in an adult human body?',
        answer: '206',
        points: 3,
      },
    ],
  },
];

const byId = (a: number, b: number) => a - b;

/**
 * Safety net for the ungraded set: after every event that can change
 * grading, the ungraded question ids /control was last sent must equal what
 * a fresh database read reports for the block. closest_guess is graded in a
 * batch and never counts, so it is left out of the read and must never
 * appear in the view.
 */
describe('GameGateway — the admin view agrees with the database on ungraded questions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let teamA: JoinedTeam;
  let teamB: JoinedTeam;
  let audio: number;
  let youtube: number;
  let freeText: number;
  let multipleChoice: number;
  let closestGuess: number;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards', 'Bystanders'],
      rounds: ONE_BLOCK_QUIZ,
    });
    admin = await game.connectAdmin();
    [teamA, teamB] = game.teams;
    [audio, youtube, freeText, multipleChoice, closestGuess] =
      game.rounds[0].questionIds;
  });

  function readUngradedFromDatabase(questionIds: number[]): Promise<number[]> {
    return game.inRequestContext(() =>
      game.answerService.listUngradedQuestionIds(
        game.gameSessionId,
        questionIds,
      ),
    );
  }

  function latestAdminView(): StateSnapshotPayload {
    const snapshots = game.payloadsTo<StateSnapshotPayload>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.STATE_UPDATED,
    );
    const latest = snapshots[snapshots.length - 1];
    if (!latest) throw new Error('The event pushed no admin snapshot');
    return latest;
  }

  /** Runs one event, then asserts the admin view it pushed matches the database and holds exactly `expected`. */
  async function step(
    name: string,
    event: () => Promise<unknown>,
    expected: number[],
  ): Promise<void> {
    game.clearEmits();
    await event();
    const view = [...latestAdminView().ungradedQuestionIds].sort(byId);
    const database = (
      await readUngradedFromDatabase(
        game.rounds[0].questionIds.filter((id) => id !== closestGuess),
      )
    ).sort(byId);

    expect({ step: name, view }).toEqual({ step: name, view: database });
    expect({ step: name, view }).toEqual({
      step: name,
      view: [...expected].sort(byId),
    });
    expect({
      step: name,
      hasClosestGuess: view.includes(closestGuess),
    }).toEqual({ step: name, hasClosestGuess: false });
  }

  async function submit(
    team: JoinedTeam,
    questionId: number,
    value: string,
  ): Promise<void> {
    const ack = await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value,
    });
    expect(ack).toEqual(expect.objectContaining({ success: true }));
  }

  async function grade(team: JoinedTeam, questionId: number): Promise<void> {
    const answers = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    const answer = answers.find(({ teamId }) => teamId === team.teamId);
    if (!answer) throw new Error(`No answer from team ${team.teamId}`);
    const ack = await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });
    expect(ack).toEqual(expect.objectContaining({ success: true }));
  }

  // QuizController.update corrects the stored key, then calls
  // notifyQuizEdited inside its HTTP request context.
  async function fixAnswerKey(questionId: number, answer: string) {
    await game.inRequestContext(async () => {
      const em = RequestContext.getEntityManager()!;
      const question = await em.findOneOrFail(Question, { id: questionId });
      question.answer = answer;
      await em.flush();
    });
    await game.inRequestContext(() =>
      game.gateway.notifyQuizEdited(game.joinCode, [questionId]),
    );
  }

  async function kick(team: JoinedTeam): Promise<void> {
    const ack = await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: team.teamId,
    });
    expect(ack).toEqual(expect.objectContaining({ success: true }));
  }

  it('keeps the ungraded set in step with the database through a whole block', async () => {
    await game.openFirstQuestion(admin); // -> audio

    // Human-graded audio: each answer waits for the quiz master.
    await step('audio submitted', () => submit(teamA, audio, 'Queen'), [audio]);
    await step('second audio submitted', () => submit(teamB, audio, 'Abba'), [
      audio,
    ]);
    await step('one audio answer graded', () => grade(teamA, audio), [audio]);
    await step('last audio answer graded', () => grade(teamB, audio), []);
    await step(
      'graded audio answer revised',
      () => submit(teamA, audio, 'Freddie Mercury'),
      [audio],
    );

    await step('youtube opened', () => game.act('ADVANCE'), [audio]);
    await step('youtube submitted', () => submit(teamA, youtube, 'Jaws'), [
      audio,
      youtube,
    ]);

    // free_text grades itself on every submission, revisions included.
    await step('free_text opened', () => game.act('ADVANCE'), [audio, youtube]);
    await step('free_text submitted', () => submit(teamA, freeText, 'Saturn'), [
      audio,
      youtube,
    ]);
    await step('free_text revised', () => submit(teamA, freeText, 'Jupiter'), [
      audio,
      youtube,
    ]);

    await step('multiple_choice opened', () => game.act('ADVANCE'), [
      audio,
      youtube,
    ]);
    await step(
      'multiple_choice submitted',
      () => submit(teamA, multipleChoice, 'London'),
      [audio, youtube],
    );

    // closest_guess answers sit ungraded in the database until the batch,
    // yet never count.
    await step('closest_guess opened', () => game.act('ADVANCE'), [
      audio,
      youtube,
    ]);
    await step(
      'closest_guess submitted',
      () => submit(teamA, closestGuess, '200'),
      [audio, youtube],
    );
    await step(
      'second closest_guess submitted',
      () => submit(teamB, closestGuess, '210'),
      [audio, youtube],
    );
    expect(await readUngradedFromDatabase([closestGuess])).toEqual([
      closestGuess,
    ]);

    await step('question locked', () => game.act('ADVANCE'), [audio, youtube]);
    await step('break entered', () => game.act('ADVANCE'), [audio, youtube]);
    expect(latestAdminView().progress.status).toBe('break_intro');
    // Entering the break batch-graded the closest_guess block.
    expect(await readUngradedFromDatabase([closestGuess])).toEqual([]);

    await step('youtube graded in the break', () => grade(teamA, youtube), [
      audio,
    ]);
    await step(
      'auto-graded answer key fixed live',
      () => fixAnswerKey(multipleChoice, 'London'),
      [audio],
    );
    await step(
      'human-graded answer key fixed live',
      () => fixAnswerKey(audio, 'Queen II'),
      [audio],
    );
    await step(
      'closest_guess answer key fixed live',
      () => fixAnswerKey(closestGuess, '210'),
      [audio],
    );
    await step('team with an ungraded answer kicked', () => kick(teamA), [
      audio,
    ]);
    await step(
      "kicked team's revised answer graded",
      () => grade(teamA, audio),
      [],
    );
  });
});
