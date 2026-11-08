import { describe, expect, it } from 'vitest';
import { getCurrentQuestion, getBlockQuestions } from '../block-questions';
import type { GameProgress } from '../game-state-types';
import { planMove } from '../move-plan';
import type { SeededQuestion } from '../question-views';
import { projectScreen } from '../screen-projection';
import { settleSession } from '../session-settle';
import type { SessionState } from '../session-state';
import { revealOnAir, stepRevealOnAir } from '../stepped-reveal';
import { freeTextQuestion, round, sessionWith } from './session-fixtures';

const CLUES = ['Vague', 'Sharper', 'Sharp', 'Giveaway'];

function clueQuestion(id: number): SeededQuestion {
  return {
    ...freeTextQuestion(id),
    type: 'clues',
    options: CLUES,
    points: 2,
    answer: 'Einstein',
  } as SeededQuestion;
}

// One block: q1 is a Clue question (4 clues), q2 is free text.
const rounds = [
  {
    ...round(1, [1, 2]),
    questions: [clueQuestion(1), freeTextQuestion(2)],
  },
];

const open = (
  questionIndex: number,
  step: number,
  highestClueShown: Record<number, number> = {},
): SessionState =>
  sessionWith(
    rounds,
    {
      status: 'question_open',
      questionIndex,
      furthestOpenIndex: questionIndex,
    },
    { revealStep: step, highestClueShown },
  );

const asStep = (move: ReturnType<typeof stepRevealOnAir>) =>
  move as Extract<ReturnType<typeof stepRevealOnAir>, { kind: 'step' }>;

describe('stepping through the clues of the question on air', () => {
  it('is a clues reveal with one step per clue that falls through at both ends', () => {
    expect(revealOnAir(open(0, 1))).toMatchObject({
      reveal: 'clues',
      step: 1,
      descriptor: {
        stepCount: 4,
        atStart: 'fall_through',
        atEnd: 'fall_through',
        canStart: true,
      },
    });
  });

  it('is not on air for a question without clues', () => {
    expect(revealOnAir(open(1, 0))).toBeNull();
  });

  it('shows the next clue on Advance and raises the highest clue shown', () => {
    const move = asStep(stepRevealOnAir(open(0, 0, { 1: 1 }), 'ADVANCE'));
    expect(move.session.revealStep).toBe(1);
    expect(move.session.highestClueShown).toEqual({ 1: 2 });
  });

  it('falls through on Advance at the last clue and on Previous at the first', () => {
    expect(stepRevealOnAir(open(0, 3, { 1: 4 }), 'ADVANCE')).toMatchObject({
      kind: 'fall_through',
    });
    expect(stepRevealOnAir(open(0, 0, { 1: 1 }), 'PREVIOUS')).toMatchObject({
      kind: 'fall_through',
    });
  });

  it('hides the latest clue on Previous without lowering the highest clue shown', () => {
    const move = asStep(stepRevealOnAir(open(0, 2, { 1: 3 }), 'PREVIOUS'));
    expect(move.session.revealStep).toBe(1);
    expect(move.session.highestClueShown).toEqual({ 1: 3 });
  });

  it('a first Advance never waits', () => {
    expect(planMove(open(0, 0, { 1: 1 }), 'ADVANCE')).toMatchObject({
      kind: 'reveal_step',
      reveal: 'clues',
    });
  });
});

describe('landing on a Clue question', () => {
  const settleOnto = (
    from: SessionState,
    progress: Partial<GameProgress>,
    action: 'ADVANCE' | 'PREVIOUS',
  ) =>
    settleSession({
      session: from,
      progress: { ...from.progress, ...progress } as GameProgress,
      step: { kind: 'transition', action },
      now: 0,
    });

  it('opens on clue 1 the first time, and records it as shown', () => {
    const settled = settleOnto(
      sessionWith(rounds, { status: 'round_intro' }),
      { status: 'question_open', questionIndex: 0, furthestOpenIndex: 0 },
      'ADVANCE',
    );
    expect(settled.revealStep).toBe(0);
    expect(settled.highestClueShown).toEqual({ 1: 1 });
  });

  it('lands on the highest clue shown coming back, forward or by Previous', () => {
    const from = open(1, 0, { 1: 3 });
    const back = settleOnto(
      from,
      { questionIndex: 0, furthestOpenIndex: 1 },
      'PREVIOUS',
    );
    expect(back.revealStep).toBe(2);
    expect(back.highestClueShown).toEqual({ 1: 3 });
    const forward = settleOnto(
      { ...from, progress: { ...from.progress, questionIndex: 0 } },
      { questionIndex: 0, status: 'locking' },
      'ADVANCE',
    );
    expect(forward.revealStep).toBe(0);
  });

  it('keeps the clue on air through the lock countdown of the same question', () => {
    const settled = settleOnto(
      open(0, 2, { 1: 3 }),
      { status: 'locking' },
      'ADVANCE',
    );
    expect(settled.revealStep).toBe(2);
  });
});

describe('the views of a Clue question', () => {
  it('carry only the clues up to the step on air, and the value of the highest clue shown', () => {
    const session = open(0, 1, { 1: 3 });
    expect(getCurrentQuestion(session)).toMatchObject({
      clues: ['Vague', 'Sharper'],
      clueCount: 4,
      clueValue: 1,
    });
    expect(getCurrentQuestion(session)).not.toHaveProperty('options');
    expect(JSON.stringify(projectScreen(session, 'players'))).not.toContain(
      'Giveaway',
    );
    expect(JSON.stringify(projectScreen(session, 'display'))).not.toContain(
      'Giveaway',
    );
  });

  it('carry the clues up to the highest shown for a question no longer on air', () => {
    const session = open(1, 0, { 1: 3 });
    expect(getBlockQuestions(session)[0]).toMatchObject({
      clues: ['Vague', 'Sharper', 'Sharp'],
      clueCount: 4,
    });
  });

  it('carry every clue at the reveal, including ones never shown', () => {
    const session = sessionWith(
      rounds,
      { status: 'reveal', revealIndex: 0, furthestOpenIndex: 1 },
      { highestClueShown: { 1: 1 } },
    );
    const view = projectScreen(session, 'players');
    expect(view.revealQuestions[0]).toMatchObject({ options: CLUES });
  });

  it('carry no clue of a question that never opened', () => {
    expect(getBlockQuestions(open(1, 0))[0]).not.toHaveProperty('clues');
  });
});
