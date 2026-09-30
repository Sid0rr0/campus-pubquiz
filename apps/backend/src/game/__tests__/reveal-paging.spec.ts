import type { GameAction } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const TO_LOCKING: GameAction[] = [
  'START_QUIZ',
  'ADVANCE', // -> round_intro(0)
  'ADVANCE', // -> r1q1
  'ADVANCE', // -> r1q2
  'ADVANCE', // -> round_intro(1)
  'ADVANCE', // -> r2q1
  'ADVANCE', // -> r2q2
  'ADVANCE', // -> locking
];
const TO_BREAK_INTRO: GameAction[] = [...TO_LOCKING, 'ADVANCE'];
const TO_REVEAL: GameAction[] = [
  ...TO_BREAK_INTRO,
  'ADVANCE', // -> reveal_intro (round 0)
  'ADVANCE', // -> reveal, revealIndex 0
];
const THROUGH_REVEAL: GameAction[] = [
  'ADVANCE', // -> revealIndex 1
  'ADVANCE', // -> reveal_intro (round 1)
  'ADVANCE', // -> reveal, revealIndex 2
  'ADVANCE', // -> revealIndex 3 (last)
  'ADVANCE', // -> ended (round-2 is last)
];

describe('GameGateway — reveal paging', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  /** Sends each action in order and returns the snapshot the last one produced. */
  async function actAll(actions: GameAction[]) {
    let snapshot = await game.snapshot();
    for (const action of actions) {
      snapshot = await game.act(action);
    }
    return snapshot;
  }

  function questionIds(): number[] {
    return game.rounds.flatMap((round) => round.questionIds);
  }

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
  });

  it('exposes no reveal questions outside reveal', async () => {
    const started = await game.act('START_QUIZ');
    expect(started.revealQuestions).toEqual([]);

    const breakSnapshot = await actAll(TO_BREAK_INTRO.slice(1));
    expect(breakSnapshot.revealQuestions).toEqual([]);
  });

  it('shows the just-finished block with correct answers once revealed', async () => {
    const [q1, q2, q3, q4] = questionIds();

    const revealed = await actAll(TO_REVEAL);

    expect(revealed.progress.status).toBe('reveal');
    expect(revealed.revealQuestions.map((q) => [q.id, q.answer])).toEqual([
      [q1, 'Paris'],
      [q2, 'Jupiter'],
      [q3, 'Eiffel Tower'],
      [q4, 'France'],
    ]);
    expect(
      revealed.revealQuestions.find((q) => q.id === q4)?.answerMediaUrl,
    ).toBe('https://example.com/france-flag.jpg');
    expect(
      revealed.revealQuestions.find((q) => q.id === q3)?.answerMediaUrl,
    ).toBeUndefined();
    // Each question carries its own round's title, not just the block's last
    // round — the block spans both "General Knowledge" and "Landmarks & Flags".
    expect(revealed.revealQuestions.map((q) => [q.id, q.roundTitle])).toEqual([
      [q1, 'General Knowledge'],
      [q2, 'General Knowledge'],
      [q3, 'Landmarks & Flags'],
      [q4, 'Landmarks & Flags'],
    ]);
  });

  it('pages through the reveal block one question at a time via ADVANCE and PREVIOUS, with a fresh round intro card at the round boundary', async () => {
    const first = await actAll(TO_REVEAL);
    expect(first.progress.revealIndex).toBe(0);
    expect(first.progress.status).toBe('reveal');

    const second = await game.act('ADVANCE');
    expect(second.progress).toMatchObject({
      status: 'reveal',
      revealIndex: 1,
    });

    const thirdIntro = await game.act('ADVANCE'); // crosses into round 1
    expect(thirdIntro.progress).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 2,
    });

    const third = await game.act('ADVANCE');
    expect(third.progress).toMatchObject({
      status: 'reveal',
      revealIndex: 2,
    });

    const back = await game.act('PREVIOUS');
    expect(back.progress).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 2,
    });
  });

  it('steps back from the very first reveal round intro card into that same break review, then rejects once walked back to its own start', async () => {
    await actAll(TO_REVEAL);

    const backToIntro = await game.act('PREVIOUS');
    expect(backToIntro.progress).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 0,
    });

    const backToBreak = await game.act('PREVIOUS');
    expect(backToBreak.progress).toMatchObject({
      status: 'break',
      revealIndex: 3,
    });

    const stepToRound2Q1 = await game.act('PREVIOUS');
    expect(stepToRound2Q1.progress).toMatchObject({
      status: 'break',
      revealIndex: 2,
    });

    const round2Title = await game.act('PREVIOUS'); // -> break_round_intro, round 2's own title
    expect(round2Title.progress).toMatchObject({
      status: 'break_round_intro',
      revealIndex: 2,
    });

    const stepToRound1Q2 = await game.act('PREVIOUS'); // -> break, round 1's last question
    expect(stepToRound1Q2.progress).toMatchObject({
      status: 'break',
      revealIndex: 1,
    });

    const stepToRound1Q1 = await game.act('PREVIOUS');
    expect(stepToRound1Q1.progress).toMatchObject({
      status: 'break',
      revealIndex: 0,
    });

    const round1Title = await game.act('PREVIOUS'); // -> break_round_intro, round 1's own title
    expect(round1Title.progress).toMatchObject({
      status: 'break_round_intro',
      revealIndex: 0,
    });

    await expect(game.act('PREVIOUS')).rejects.toThrow(
      'Cannot apply action "PREVIOUS" from state "break_round_intro"',
    );
  });

  it("starts break review at the block's last question, walking backward via PREVIOUS without reopening it for answers", async () => {
    const { socket: team, teamId } = await game.joinTeam('The Quizzards');
    const [q1, q2, q3, q4] = questionIds();

    const entered = await actAll(TO_BREAK_INTRO);
    expect(entered.progress).toMatchObject({
      status: 'break_intro',
      revealIndex: 3,
    });

    const revealed = await game.act('PREVIOUS'); // -> break, reveals the just-locked question
    expect(revealed.progress).toMatchObject({
      status: 'break',
      revealIndex: 3,
    });

    const back = await game.act('PREVIOUS');
    expect(back.progress).toMatchObject({ status: 'break', revealIndex: 2 });
    // Still fully locked: the block stays answer-free and browsable, but no
    // question re-enters 'question_open'/'locking'.
    expect(back.blockQuestions.map((q) => q.id)).toEqual([q1, q2, q3, q4]);
    await expect(
      game.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: q3,
        teamId,
        value: 'Eiffel Tower',
      }),
    ).resolves.toEqual({
      success: false,
      error: 'Answers are locked for this question',
    });
  });

  it('rejects PREVIOUS at the first question of a break with no earlier block', async () => {
    await actAll([
      ...TO_BREAK_INTRO, // revealIndex 3
      'PREVIOUS', // -> break, reveals the just-locked question, revealIndex 3
      'PREVIOUS', // revealIndex 2
      'PREVIOUS', // -> break_round_intro, round 2's own title, revealIndex 2
      'PREVIOUS', // -> break, round 1's last question, revealIndex 1
      'PREVIOUS', // revealIndex 0
      'PREVIOUS', // -> break_round_intro, round 1's own title
    ]);

    await expect(game.act('PREVIOUS')).rejects.toThrow(
      'Cannot apply action "PREVIOUS" from state "break_round_intro"',
    );
  });

  it('keeps the final block browsable and gradable once the quiz has ended', async () => {
    const ended = await actAll([...TO_REVEAL, ...THROUGH_REVEAL]);

    expect(ended.progress.status).toBe('ended');
    // The admin must still be able to review/grade the last block's answers
    // after the quiz auto-ends — losing this list hides the grading panel.
    expect(ended.blockQuestions.map((q) => q.id)).toEqual(questionIds());
  });

  it('clears reveal questions once the admin advances past reveal', async () => {
    const ended = await actAll([...TO_REVEAL, ...THROUGH_REVEAL]);

    expect(ended.progress.status).toBe('ended');
    expect(ended.revealQuestions).toEqual([]);
  });
});
