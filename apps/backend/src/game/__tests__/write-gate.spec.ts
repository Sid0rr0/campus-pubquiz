import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import { TestWriteGate } from '@/game/__tests__/test-write-gate';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Write gate — the real-store harness test gate', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
  });

  function award(
    points: number,
    socket = admin,
    teamId = game.teams[0].teamId,
  ) {
    return game.gateway.handleAwardBonus(asSocket(socket), {
      teamId,
      category: 'shot',
      points,
    });
  }

  it('holds a press at change before its session is stored, and release finishes it', async () => {
    const before = await game.snapshot();
    const held = game.holdAt('change');

    const press = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });
    await held.reached;

    expect((await game.snapshot()).progress.status).toBe(
      before.progress.status,
    );

    held.release();
    await press;
    expect((await game.snapshot()).progress.status).not.toBe(
      before.progress.status,
    );
  });

  it('holds a bonus award at standings after its change, before its leaderboard changes', async () => {
    await game.openFirstQuestion(admin);
    const bonusOf = async () =>
      (await game.snapshot()).leaderboard.find(
        (entry) => entry.teamId === game.teams[0].teamId,
      )?.bonusPoints ?? 0;
    const held = game.holdAt('standings');

    const awarding = award(2);
    await held.reached;

    expect(await bonusOf()).toBe(0);

    held.release();
    await awarding;
    expect(await bonusOf()).toBe(2);
  });

  it('lets another session’s write run freely when the hold names a join code', async () => {
    const { joinCode: otherCode } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const otherAdmin = await game.connectAdmin(otherCode);
    const held = game.holdAt('change', { joinCode: game.joinCode });

    const blocked = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });
    await held.reached;

    await expect(
      game.gateway.handleAdminAction(asSocket(otherAdmin), {
        action: 'START_QUIZ',
      }),
    ).resolves.toEqual(expect.objectContaining({ success: true }));

    held.release();
    await blocked;
  });

  it('resolves nextQueued for a write queued behind a held one', async () => {
    await game.openFirstQuestion(admin);
    const held = game.holdAt('change');
    const first = award(1);
    await held.reached;

    const waiting = game.nextQueued();
    const second = award(2);
    await waiting;

    held.release();
    await Promise.all([first, second]);
  });

  it('holds a Live edit save at hold before its quiz is saved', async () => {
    const pointsOf = async () => {
      const draft = await game.quizService.findDraftById(game.quizId);
      return draft?.rounds[0].questions[0].points;
    };
    const original = await game.inRequestContext(pointsOf);
    const held = game.holdAt('hold');

    const saving = game.saveAnswerKeyFix(game.questionIds.multipleChoice, {
      points: 7,
    });
    await held.reached;

    expect(await game.inRequestContext(pointsOf)).toBe(original);

    held.release();
    await saving;
    expect(await game.inRequestContext(pointsOf)).toBe(7);
  });

  describe('a hold no write reaches', () => {
    // The harness runs `finish` on its gate at teardown and fails the test with
    // this message; it is checked on a standalone gate so this spec stays green.
    it('is reported with a clear message instead of hanging', () => {
      const gate = new TestWriteGate();
      gate.holdAt('standings', { joinCode: 'ABC123' });

      expect(gate.finish()).toMatch(
        /never reached: standings \(join code ABC123\)/,
      );
    });
  });
});
