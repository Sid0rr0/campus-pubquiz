import { IllegalGameTransitionError } from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
  type MockSeedService,
} from './test-utils';

describe('GameStateService — block questions and response indicators', () => {
  let service: GameStateService;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
  });

  it('exposes no block questions in the lobby', () => {
    expect(service.getSnapshot().blockQuestions).toEqual([]);
  });

  it('reveals block questions cumulatively as the admin advances', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    expect(service.getSnapshot().blockQuestions.map((q) => q.id)).toEqual([21]);

    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1) (round 1 has no break)
    await service.applyAction('ADVANCE'); // -> r2q1 (same block)
    expect(service.getSnapshot().blockQuestions.map((q) => q.id)).toEqual([
      21, 22, 23,
    ]);
  });

  it('keeps the whole locked block browsable during the grading break', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    const snapshot = await service.applyAction('ADVANCE'); // -> break

    expect(snapshot.progress.status).toBe('break');
    expect(snapshot.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23, 24]);
  });

  it('never leaks the correct answer through blockQuestions, even during break', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    const snapshot = await service.applyAction('ADVANCE'); // -> break

    snapshot.blockQuestions.forEach((question) => {
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('answerMediaUrl');
    });
  });

  it('never leaks the correct answer through currentQuestion while a question is open', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction('ADVANCE'); // -> r1q1

    expect(snapshot.currentQuestion).not.toHaveProperty('answer');
    expect(snapshot.currentQuestion).not.toHaveProperty('answerMediaUrl');
  });

  it('labels block questions with their round and in-round position', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    const snapshot = await service.applyAction('ADVANCE'); // -> r2q2

    expect(
      snapshot.blockQuestions.map((q) => [
        q.id,
        q.roundNumber,
        q.questionNumberInRound,
      ]),
    ).toEqual([
      [21, 1, 1],
      [22, 1, 2],
      [23, 2, 1],
      [24, 2, 2],
    ]);
  });

  it("exposes the current round's remaining question as upcoming while a question is open", async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    const r1q1 = await service.applyAction('ADVANCE'); // -> r1q1
    expect(r1q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2 },
    ]);

    const r1q2 = await service.applyAction('ADVANCE'); // -> r1q2
    expect(r1q2.upcomingQuestions).toEqual([]);

    await service.applyAction('ADVANCE'); // -> round_intro(1)
    const r2q1 = await service.applyAction('ADVANCE'); // -> r2q1
    expect(r2q1.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);

    const r2q2 = await service.applyAction('ADVANCE'); // -> r2q2
    expect(r2q2.upcomingQuestions).toEqual([]);
  });

  it('exposes every remaining question in the round as upcoming, not just the next one', async () => {
    const threeQuestionRoundGame: SeededGame = {
      quizId: 3,
      gameSessionId: 103,
      joinCode: 'ZZZZZZ',
      rounds: [
        {
          id: 31,
          title: 'Triple Round',
          breakAfter: true,
          questions: [
            {
              id: 41,
              type: 'free_text',
              prompt: 'Q1',
              points: 1,
              answer: 'A1',
            },
            {
              id: 42,
              type: 'free_text',
              prompt: 'Q2',
              points: 1,
              answer: 'A2',
            },
            {
              id: 43,
              type: 'free_text',
              prompt: 'Q3',
              points: 1,
              answer: 'A3',
            },
          ],
        },
      ],
    };
    const customSeedService = {
      seed: jest.fn().mockResolvedValue(threeQuestionRoundGame),
      loadGame: jest.fn(),
      createSession: jest.fn(),
    };
    const customService = new GameStateService(
      asSeedService(customSeedService as unknown as MockSeedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await customService.onModuleInit();

    await customService.applyAction('START_QUIZ');
    await customService.applyAction('ADVANCE'); // -> round_intro(0)
    const q1 = await customService.applyAction('ADVANCE'); // -> q1
    expect(q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2 },
      { roundNumber: 1, questionNumberInRound: 3 },
    ]);

    const q2 = await customService.applyAction('ADVANCE'); // -> q2
    expect(q2.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 3 },
    ]);

    const q3 = await customService.applyAction('ADVANCE'); // -> q3
    expect(q3.upcomingQuestions).toEqual([]);
  });

  it('exposes no upcoming questions outside question_open/locking', async () => {
    expect(service.getSnapshot().upcomingQuestions).toEqual([]);

    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    const locking = await service.applyAction('ADVANCE'); // -> locking
    expect(locking.upcomingQuestions).toEqual([]);

    const brk = await service.applyAction('ADVANCE'); // -> break
    expect(brk.upcomingQuestions).toEqual([]);

    const revealed = await service.applyAction('FINISH_GRADING'); // -> reveal
    expect(revealed.upcomingQuestions).toEqual([]);
  });

  it('exposes no reveal questions outside reveal', async () => {
    await service.applyAction('START_QUIZ');
    expect(service.getSnapshot().revealQuestions).toEqual([]);

    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    const breakSnapshot = await service.applyAction('ADVANCE'); // -> break
    expect(breakSnapshot.revealQuestions).toEqual([]);
  });

  it('shows the just-finished block with correct answers once revealed', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    await service.applyAction('ADVANCE'); // -> break
    const revealed = await service.applyAction('FINISH_GRADING'); // -> reveal

    expect(revealed.progress.status).toBe('reveal');
    expect(revealed.revealQuestions.map((q) => [q.id, q.answer])).toEqual([
      [21, 'Paris'],
      [22, 'Jupiter'],
      [23, 'Eiffel Tower'],
      [24, 'France'],
    ]);
    expect(
      revealed.revealQuestions.find((q) => q.id === 24)?.answerMediaUrl,
    ).toBe('https://example.com/france-flag.jpg');
    expect(
      revealed.revealQuestions.find((q) => q.id === 23)?.answerMediaUrl,
    ).toBeUndefined();
  });

  it('pages through the reveal block one question at a time via ADVANCE and PREVIOUS', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    await service.applyAction('ADVANCE'); // -> break
    const first = await service.applyAction('FINISH_GRADING'); // -> reveal
    expect(first.progress.revealIndex).toBe(0);
    expect(first.progress.status).toBe('reveal');

    const second = await service.applyAction('ADVANCE');
    expect(second.progress).toMatchObject({
      status: 'reveal',
      revealIndex: 1,
    });

    const third = await service.applyAction('ADVANCE');
    expect(third.progress).toMatchObject({
      status: 'reveal',
      revealIndex: 2,
    });

    const back = await service.applyAction('PREVIOUS');
    expect(back.progress).toMatchObject({ status: 'reveal', revealIndex: 1 });
  });

  it('rejects PREVIOUS at the very first reveal question', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    await service.applyAction('ADVANCE'); // -> break
    await service.applyAction('FINISH_GRADING'); // -> reveal, revealIndex 0

    await expect(service.applyAction('PREVIOUS')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it("starts break review at the block's last question, walking backward via PREVIOUS without reopening it for answers", async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    const entered = await service.applyAction('ADVANCE'); // -> break
    expect(entered.progress).toMatchObject({
      status: 'break',
      revealIndex: 3,
    });

    const back = await service.applyAction('PREVIOUS');
    expect(back.progress).toMatchObject({ status: 'break', revealIndex: 2 });
    // Still fully locked: the block stays answer-free and browsable, but no
    // question re-enters 'question_open'/'locking'.
    expect(back.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23, 24]);
    expect(service.isQuestionOpenForAnswering(23)).toBe(false);
  });

  it('rejects PREVIOUS at the first question of a break with no earlier block', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    await service.applyAction('ADVANCE'); // -> break, revealIndex 3
    await service.applyAction('PREVIOUS'); // revealIndex 2
    await service.applyAction('PREVIOUS'); // revealIndex 1
    await service.applyAction('PREVIOUS'); // revealIndex 0

    await expect(service.applyAction('PREVIOUS')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it('clears reveal questions once the admin advances past reveal', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    await service.applyAction('ADVANCE'); // -> break
    await service.applyAction('FINISH_GRADING'); // -> reveal, revealIndex 0
    await service.applyAction('ADVANCE'); // -> revealIndex 1
    await service.applyAction('ADVANCE'); // -> revealIndex 2
    await service.applyAction('ADVANCE'); // -> revealIndex 3 (last)
    const ended = await service.applyAction('ADVANCE'); // -> ended (round-2 is last)

    expect(ended.progress.status).toBe('ended');
    expect(ended.revealQuestions).toEqual([]);
  });

  it('treats every revealed block question as open for answering', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2

    expect(service.isQuestionOpenForAnswering(21)).toBe(true);
    expect(service.isQuestionOpenForAnswering(22)).toBe(true);
  });

  it('treats unrevealed and unknown questions as closed for answering', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1

    expect(service.isQuestionOpenForAnswering(23)).toBe(false);
    expect(service.isQuestionOpenForAnswering(999999)).toBe(false);
  });

  it('keeps the last question open for answering during the locking countdown', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    const locking = await service.applyAction('ADVANCE'); // -> locking

    expect(locking.progress.status).toBe('locking');
    expect(service.isQuestionOpenForAnswering(24)).toBe(true);
  });

  it('closes the whole block for answering once the break starts', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
    await service.applyAction('ADVANCE'); // -> break

    expect(service.isQuestionOpenForAnswering(21)).toBe(false);
    expect(service.isQuestionOpenForAnswering(24)).toBe(false);
  });

  it('closes answering while still in the lobby', () => {
    expect(service.isQuestionOpenForAnswering(21)).toBe(false);
  });

  it('closes answering while showing the rules screen', async () => {
    await service.applyAction('START_QUIZ');
    expect(service.isQuestionOpenForAnswering(21)).toBe(false);
  });

  it('starts with no answered team ids', () => {
    expect(service.getSnapshot().answeredTeamIds).toEqual([]);
  });

  it('reflects answered team ids for the current question only', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    service.setAnsweredTeamIds(21, [31]);

    expect(service.getSnapshot().answeredTeamIds).toEqual([31]);

    await service.applyAction('ADVANCE'); // -> r1q2, nobody answered it yet
    expect(service.getSnapshot().answeredTeamIds).toEqual([]);
  });

  it('clears answered team ids when a new quiz session is selected', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    // Same question id as the imported quiz's first question, so stale
    // indicators would leak into the new session if selectQuiz kept them.
    service.setAnsweredTeamIds(25, [31]);
    await service.applyAction('END_QUIZ');

    await service.selectQuiz(2);
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // current question: iq1

    expect(service.getSnapshot().answeredTeamIds).toEqual([]);
  });
});
