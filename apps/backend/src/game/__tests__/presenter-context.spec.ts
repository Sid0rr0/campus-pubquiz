import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

describe('GameStateService — getPresenterContext', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('previews the very first question before the quiz has started, with no notes yet', () => {
    const context = service.getPresenterContext(joinCode);
    expect(context.currentQuestionNotes).toBeNull();
    expect(context.nextQuestion).toEqual(
      expect.objectContaining({ id: 21, answer: 'Paris' }),
    );
  });

  it('returns notes for the open question and a preview of the next one', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1 (21)

    const context = service.getPresenterContext(joinCode);
    expect(context.currentQuestionNotes).toBe(
      'Remind teams: EU capitals only.',
    );
    expect(context.nextQuestion).toEqual(
      expect.objectContaining({ id: 22, answer: 'Jupiter' }),
    );
  });

  it('returns null notes for a question with an explicit null note', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2 (22)

    expect(
      service.getPresenterContext(joinCode).currentQuestionNotes,
    ).toBeNull();
  });

  it("crosses into the next round's first question once the current round is exhausted", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2, last question of round 1

    expect(service.getPresenterContext(joinCode).nextQuestion).toEqual(
      expect.objectContaining({ id: 23, answer: 'Eiffel Tower' }),
    );
  });

  it('returns null nextQuestion only once nothing is left in the whole quiz', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2, last question of the whole quiz

    expect(service.getPresenterContext(joinCode).nextQuestion).toBeNull();
  });

  it("previews the new round's first question on a fresh round_intro card, with no notes shown", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1), fresh round

    const context = service.getPresenterContext(joinCode);
    expect(context.currentQuestionNotes).toBeNull();
    expect(context.nextQuestion).toEqual(
      expect.objectContaining({ id: 23, answer: 'Eiffel Tower' }),
    );
  });

  it('returns null currentQuestionNotes once a question is no longer open (e.g. during break)', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const brk = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro

    expect(brk.progress.status).toBe('break_intro');
    expect(
      service.getPresenterContext(joinCode).currentQuestionNotes,
    ).toBeNull();
  });
});
