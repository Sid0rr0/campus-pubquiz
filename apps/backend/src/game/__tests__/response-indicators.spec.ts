import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
} from '@/game/__tests__/test-utils';

describe('GameStateService — response indicators', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('treats every revealed block question as open for answering', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2

    expect(service.isQuestionOpenForAnswering(joinCode, 21)).toBe(true);
    expect(service.isQuestionOpenForAnswering(joinCode, 22)).toBe(true);
  });

  it('treats unrevealed and unknown questions as closed for answering', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1

    expect(service.isQuestionOpenForAnswering(joinCode, 23)).toBe(false);
    expect(service.isQuestionOpenForAnswering(joinCode, 999999)).toBe(false);
  });

  it('keeps the last question open for answering during the locking countdown', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    const locking = await service.applyAction(joinCode, 'ADVANCE'); // -> locking

    expect(locking.progress.status).toBe('locking');
    expect(service.isQuestionOpenForAnswering(joinCode, 24)).toBe(true);
  });

  it('closes the whole block for answering once the break starts', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break

    expect(service.isQuestionOpenForAnswering(joinCode, 21)).toBe(false);
    expect(service.isQuestionOpenForAnswering(joinCode, 24)).toBe(false);
  });

  it('closes answering while still in the lobby', () => {
    expect(service.isQuestionOpenForAnswering(joinCode, 21)).toBe(false);
  });

  it('closes answering while showing the rules screen', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    expect(service.isQuestionOpenForAnswering(joinCode, 21)).toBe(false);
  });

  it('starts with no answered team ids', () => {
    expect(service.getSnapshot(joinCode).answeredTeamIds).toEqual([]);
  });

  it('reflects answered team ids for the current question only', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    service.setAnsweredTeamIds(joinCode, 21, [31]);

    expect(service.getSnapshot(joinCode).answeredTeamIds).toEqual([31]);

    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2, nobody answered it yet
    expect(service.getSnapshot(joinCode).answeredTeamIds).toEqual([]);
  });

  it('does not carry stale answered team ids over into a newly created session', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    // Same question id as the imported quiz's first question, so stale
    // indicators would leak into the new session if it inherited them.
    service.setAnsweredTeamIds(joinCode, 25, [31]);
    await service.applyAction(joinCode, 'END_QUIZ');

    const created = await service.createSession(2);
    await service.applyAction(created.joinCode, 'START_QUIZ');
    await service.applyAction(created.joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(created.joinCode, 'ADVANCE'); // current question: iq1

    expect(service.getSnapshot(created.joinCode).answeredTeamIds).toEqual([]);
  });
});
