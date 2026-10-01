import { SOCKET_EVENTS, type AdminStatePayload } from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

// A single round with a break after it is the final block, so the break is
// where the showdown option is decided.
const FINAL_BLOCK_QUIZ: QuizRoundSpec[] = [
  {
    title: 'Final Round',
    breakAfter: true,
    questions: [
      {
        type: 'free_text',
        prompt: 'Largest planet?',
        answer: 'Jupiter',
        points: 2,
      },
    ],
  },
];

/**
 * The ungraded set lives in memory, so a backend that restarts mid-break must
 * rebuild it, or /control would show no markers and offer the showdown while
 * grading is unfinished.
 */
describe('GameGateway — a restored session knows its ungraded questions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let team: JoinedTeam;
  let freeText: number;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: FINAL_BLOCK_QUIZ,
    });
    [team] = game.teams;
    [freeText] = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
  });

  async function submitNonMatch(): Promise<void> {
    const ack = await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: freeText,
      teamId: team.teamId,
      value: 'Saturn',
    });
    expect(ack).toEqual(expect.objectContaining({ success: true }));
  }

  async function advanceIntoBreak(): Promise<void> {
    await game.act('ADVANCE'); // locking
    await game.act('ADVANCE'); // break_intro
  }

  /** The view a /control that reconnects right after the restart is handed. */
  async function adminViewAfter(
    restarted: RealStoreGateway,
  ): Promise<AdminStatePayload> {
    const admin: MockSocket = await restarted.connectAdmin();
    const sync = admin.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.STATE_SYNC,
    ) as [string, AdminStatePayload] | undefined;
    if (!sync) throw new Error('The admin received no snapshot');
    return sync[1];
  }

  it('lists the ungraded question straight after a restart mid-break', async () => {
    await submitNonMatch();
    await advanceIntoBreak();

    const view = await adminViewAfter(await game.restart());

    expect(view.progress.status).toBe('break_intro');
    expect(view.ungradedQuestionIds).toEqual([freeText]);
  });

  it('withholds the showdown on the last block while the restored ungraded answer is waiting', async () => {
    await submitNonMatch();
    await advanceIntoBreak();

    const view = await adminViewAfter(await game.restart());

    expect(view.isShowdownEligible).toBe(false);
  });

  it('offers the showdown after a restart mid-break when nothing is ungraded', async () => {
    await advanceIntoBreak();

    const view = await adminViewAfter(await game.restart());

    expect(view.ungradedQuestionIds).toEqual([]);
    expect(view.isShowdownEligible).toBe(true);
  });

  it('leaves the set empty after a restart outside the grading statuses', async () => {
    await submitNonMatch();

    const view = await adminViewAfter(await game.restart());

    expect(view.progress.status).toBe('question_open');
    expect(view.ungradedQuestionIds).toEqual([]);
  });
});
