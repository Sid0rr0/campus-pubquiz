import { IllegalGameTransitionError } from '@campus-pubquiz/types';
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

describe('GameStateService — reveal paging', () => {
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

    const stepToRound2Q1 = await service.applyAction(joinCode, 'PREVIOUS');
    expect(stepToRound2Q1.progress).toMatchObject({
      status: 'break',
      revealIndex: 2,
    });

    const round2Title = await service.applyAction(joinCode, 'PREVIOUS'); // -> break_round_intro, round 2's own title
    expect(round2Title.progress).toMatchObject({
      status: 'break_round_intro',
      revealIndex: 2,
    });

    const stepToRound1Q2 = await service.applyAction(joinCode, 'PREVIOUS'); // -> break, round 1's last question
    expect(stepToRound1Q2.progress).toMatchObject({
      status: 'break',
      revealIndex: 1,
    });

    const stepToRound1Q1 = await service.applyAction(joinCode, 'PREVIOUS');
    expect(stepToRound1Q1.progress).toMatchObject({
      status: 'break',
      revealIndex: 0,
    });

    const round1Title = await service.applyAction(joinCode, 'PREVIOUS'); // -> break_round_intro, round 1's own title
    expect(round1Title.progress).toMatchObject({
      status: 'break_round_intro',
      revealIndex: 0,
    });

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
    const entered = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    expect(entered.progress).toMatchObject({
      status: 'break_intro',
      revealIndex: 3,
    });

    const revealed = await service.applyAction(joinCode, 'PREVIOUS'); // -> break, reveals the just-locked question
    expect(revealed.progress).toMatchObject({
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
    await service.applyAction(joinCode, 'PREVIOUS'); // -> break, reveals the just-locked question, revealIndex 3
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 2
    await service.applyAction(joinCode, 'PREVIOUS'); // -> break_round_intro, round 2's own title, revealIndex 2
    await service.applyAction(joinCode, 'PREVIOUS'); // -> break, round 1's last question, revealIndex 1
    await service.applyAction(joinCode, 'PREVIOUS'); // revealIndex 0
    await service.applyAction(joinCode, 'PREVIOUS'); // -> break_round_intro, round 1's own title

    await expect(service.applyAction(joinCode, 'PREVIOUS')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it('keeps the final block browsable and gradable once the quiz has ended', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal, revealIndex 0
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 1
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal, revealIndex 2
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 3 (last)
    const ended = await service.applyAction(joinCode, 'ADVANCE'); // -> ended (round-2 is last)

    expect(ended.progress.status).toBe('ended');
    // The admin must still be able to review/grade the last block's answers
    // after the quiz auto-ends — losing this list hides the grading panel.
    expect(ended.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23, 24]);
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
});
