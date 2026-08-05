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
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
    joinCode = service.getDefaultJoinCode();
  });

  it('exposes no block questions in the lobby', () => {
    expect(service.getSnapshot(joinCode).blockQuestions).toEqual([]);
  });

  it('reveals block questions cumulatively as the admin advances', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    expect(
      service.getSnapshot(joinCode).blockQuestions.map((q) => q.id),
    ).toEqual([21]);

    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1) (round 1 has no break)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (same block)
    expect(
      service.getSnapshot(joinCode).blockQuestions.map((q) => q.id),
    ).toEqual([21, 22, 23]);
  });

  it('keeps an already-opened question answerable after the admin steps the display back with PREVIOUS', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (23) — furthest reached: r1q1, r1q2, r2q1
    expect(
      service.getSnapshot(joinCode).blockQuestions.map((q) => q.id),
    ).toEqual([21, 22, 23]);

    await service.applyAction(joinCode, 'PREVIOUS'); // -> round_intro(1)
    const back = await service.applyAction(joinCode, 'PREVIOUS'); // -> r1q2 (22) again, display steps backward

    expect(back.progress.status).toBe('question_open');
    expect(back.currentQuestion?.id).toBe(22);
    // r2q1 was already shown on display before stepping back — it must stay
    // revealed/answerable for players even though it's no longer on screen.
    expect(back.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23]);
    expect(service.isQuestionOpenForAnswering(joinCode, 23)).toBe(true);
    // Only r2q2 has genuinely never been shown yet.
    expect(back.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);
  });

  it("shows no block questions yet on a fresh round's intro card, with the whole round upcoming", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    const freshIntro = await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1), nothing opened in round 1 yet

    expect(freshIntro.progress.status).toBe('round_intro');
    expect(freshIntro.blockQuestions.map((q) => q.id)).toEqual([21, 22]);
    expect(freshIntro.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 1 },
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);
  });

  it("keeps a round's questions answerable directly on its intro card when Previous steps back into it", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (23), furthest reached: r1q1, r1q2, r2q1

    const backOnIntroCard = await service.applyAction(joinCode, 'PREVIOUS'); // -> round_intro(1), r2q1 already open

    expect(backOnIntroCard.progress.status).toBe('round_intro');
    expect(backOnIntroCard.currentQuestion).toBeNull();
    // r2q1 stays revealed/answerable underneath the intro card, same as
    // Previous stepping back onto an already-open question directly.
    expect(backOnIntroCard.blockQuestions.map((q) => q.id)).toEqual([
      21, 22, 23,
    ]);
    expect(service.isQuestionOpenForAnswering(joinCode, 23)).toBe(true);
    expect(backOnIntroCard.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);
  });

  it('keeps the whole locked block browsable during the grading break', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> break

    expect(snapshot.progress.status).toBe('break');
    expect(snapshot.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23, 24]);
  });

  it('never leaks the correct answer through blockQuestions, even during break', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> break

    snapshot.blockQuestions.forEach((question) => {
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('answerMediaUrl');
    });
  });

  it('never leaks the correct answer through currentQuestion while a question is open', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1

    expect(snapshot.currentQuestion).not.toHaveProperty('answer');
    expect(snapshot.currentQuestion).not.toHaveProperty('answerMediaUrl');
  });

  it('labels block questions with their round and in-round position', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2

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
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const r1q1 = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    expect(r1q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2 },
    ]);

    const r1q2 = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    expect(r1q2.upcomingQuestions).toEqual([]);

    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    const r2q1 = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    expect(r2q1.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);

    const r2q2 = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
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
    const customJoinCode = customService.getDefaultJoinCode();

    await customService.applyAction(customJoinCode, 'START_QUIZ');
    await customService.applyAction(customJoinCode, 'ADVANCE'); // -> round_intro(0)
    const q1 = await customService.applyAction(customJoinCode, 'ADVANCE'); // -> q1
    expect(q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2 },
      { roundNumber: 1, questionNumberInRound: 3 },
    ]);

    const q2 = await customService.applyAction(customJoinCode, 'ADVANCE'); // -> q2
    expect(q2.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 3 },
    ]);

    const q3 = await customService.applyAction(customJoinCode, 'ADVANCE'); // -> q3
    expect(q3.upcomingQuestions).toEqual([]);
  });

  it('exposes no upcoming questions outside question_open/locking', async () => {
    expect(service.getSnapshot(joinCode).upcomingQuestions).toEqual([]);

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    const locking = await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    expect(locking.upcomingQuestions).toEqual([]);

    const brk = await service.applyAction(joinCode, 'ADVANCE'); // -> break
    expect(brk.upcomingQuestions).toEqual([]);

    const revealed = await service.applyAction(joinCode, 'ADVANCE'); // -> reveal
    expect(revealed.upcomingQuestions).toEqual([]);
  });

  it('exposes no reveal questions outside reveal', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    expect(service.getSnapshot(joinCode).revealQuestions).toEqual([]);

    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const breakSnapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> break
    expect(breakSnapshot.revealQuestions).toEqual([]);
  });

  it('shows the just-finished block with correct answers once revealed', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> break
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 0)
    const revealed = await service.applyAction(joinCode, 'ADVANCE'); // -> reveal

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
    // Each question carries its own round's title, not just the block's last
    // round — the block spans both "General Knowledge" and "Landmarks & Flags".
    expect(revealed.revealQuestions.map((q) => [q.id, q.roundTitle])).toEqual([
      [21, 'General Knowledge'],
      [22, 'General Knowledge'],
      [23, 'Landmarks & Flags'],
      [24, 'Landmarks & Flags'],
    ]);
  });

  it('pages through the reveal block one question at a time via ADVANCE and PREVIOUS, with a fresh round intro card at the round boundary', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> break
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 0)
    const first = await service.applyAction(joinCode, 'ADVANCE'); // -> reveal
    expect(first.progress.revealIndex).toBe(0);
    expect(first.progress.status).toBe('reveal');

    const second = await service.applyAction(joinCode, 'ADVANCE');
    expect(second.progress).toMatchObject({
      status: 'reveal',
      revealIndex: 1,
    });

    const thirdIntro = await service.applyAction(joinCode, 'ADVANCE'); // crosses into round 1
    expect(thirdIntro.progress).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 2,
    });

    const third = await service.applyAction(joinCode, 'ADVANCE');
    expect(third.progress).toMatchObject({
      status: 'reveal',
      revealIndex: 2,
    });

    const back = await service.applyAction(joinCode, 'PREVIOUS');
    expect(back.progress).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 2,
    });
  });

  it('steps back from the very first reveal round intro card into that same break review, then rejects once walked back to its own start', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> break
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro, revealIndex 0
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal, revealIndex 0

    const backToIntro = await service.applyAction(joinCode, 'PREVIOUS');
    expect(backToIntro.progress).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 0,
    });

    const backToBreak = await service.applyAction(joinCode, 'PREVIOUS');
    expect(backToBreak.progress).toMatchObject({
      status: 'break',
      revealIndex: 3,
    });

    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 2
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 1
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 0

    await expect(service.applyAction(joinCode, 'PREVIOUS')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it("starts break review at the block's last question, walking backward via PREVIOUS without reopening it for answers", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    const entered = await service.applyAction(joinCode, 'ADVANCE'); // -> break
    expect(entered.progress).toMatchObject({
      status: 'break',
      revealIndex: 3,
    });

    const back = await service.applyAction(joinCode, 'PREVIOUS');
    expect(back.progress).toMatchObject({ status: 'break', revealIndex: 2 });
    // Still fully locked: the block stays answer-free and browsable, but no
    // question re-enters 'question_open'/'locking'.
    expect(back.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23, 24]);
    expect(service.isQuestionOpenForAnswering(joinCode, 23)).toBe(false);
  });

  it('rejects PREVIOUS at the first question of a break with no earlier block', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro, revealIndex 3
    await service.applyAction(joinCode, 'ADVANCE'); // -> break, revealIndex 3
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 2
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 1
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 0

    await expect(service.applyAction(joinCode, 'PREVIOUS')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it('clears reveal questions once the admin advances past reveal', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> break
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal, revealIndex 0
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 1
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal, revealIndex 2
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 3 (last)
    const ended = await service.applyAction(joinCode, 'ADVANCE'); // -> ended (round-2 is last)

    expect(ended.progress.status).toBe('ended');
    expect(ended.revealQuestions).toEqual([]);
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
