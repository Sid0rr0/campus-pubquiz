import { describe, expect, it } from 'vitest';
import { getFeedbackField } from '../feedback-rounds';
import type { GameProgress } from '../game-state';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import type { ActiveShowdownRoundState, SessionState } from '../session-state';
import { round, sessionWith } from './session-fixtures';

// Rounds 1 and 2 share a block (round 1 has no break); round 3 is its own.
const ROUNDS = [
  round(1, [1], { title: 'Alpha', breakAfter: false }),
  round(2, [2], { title: 'Beta' }),
  round(3, [3], { title: 'Gamma' }),
];

function at(
  progress: Partial<GameProgress>,
  overrides: Partial<SessionState> = {},
): SessionState {
  return sessionWith(ROUNDS, progress, overrides);
}

const showdown = (resolved: boolean): ActiveShowdownRoundState => ({
  id: 1,
  question: 'How many?',
  answer: '5',
  participants: [],
  winnerTeamId: null,
  isTie: false,
  resolved,
});

describe('getFeedbackField', () => {
  it.each(['break_intro', 'break', 'break_round_intro'] as const)(
    'offers the break card in %s',
    (status) => {
      expect(
        getFeedbackField(at({ status, roundIndex: 1, questionIndex: 0 }))?.kind,
      ).toBe('break_card');
    },
  );

  it('offers every round of the block that just locked, in quiz order', () => {
    expect(
      getFeedbackField(
        at({ status: 'break_intro', roundIndex: 1, questionIndex: 0 }),
      ),
    ).toEqual({
      kind: 'break_card',
      rounds: [
        { id: 1, title: 'Alpha' },
        { id: 2, title: 'Beta' },
      ],
    });
  });

  it('offers only the later block’s own round once past an earlier block', () => {
    expect(
      getFeedbackField(
        at({ status: 'break', roundIndex: 2, questionIndex: 0 }),
      ),
    ).toEqual({
      kind: 'break_card',
      rounds: [{ id: 3, title: 'Gamma' }],
    });
  });

  it('offers the final form with every round once the quiz has ended', () => {
    expect(
      getFeedbackField(
        at({ status: 'ended', roundIndex: 2, questionIndex: 0 }),
      ),
    ).toEqual({
      kind: 'final_form',
      rounds: [
        { id: 1, title: 'Alpha' },
        { id: 2, title: 'Beta' },
        { id: 3, title: 'Gamma' },
      ],
    });
  });

  it('holds the final form back while a showdown is still being played', () => {
    expect(
      getFeedbackField(
        at({ status: 'ended' }, { activeShowdownRound: showdown(false) }),
      ),
    ).toBeNull();
  });

  it('offers the final form once the showdown is decided', () => {
    expect(
      getFeedbackField(
        at({ status: 'ended' }, { activeShowdownRound: showdown(true) }),
      )?.kind,
    ).toBe('final_form');
  });

  it.each([
    'lobby',
    'rules',
    'round_overview',
    'joker_pick',
    'round_intro',
    'question_open',
    'locking',
    'reveal_intro',
    'reveal',
  ] as const)('offers nothing in %s', (status) => {
    expect(getFeedbackField(at({ status }))).toBeNull();
  });

  it('offers nothing when the session does not collect feedback', () => {
    const session = sessionWith(
      ROUNDS,
      { status: 'break_intro', roundIndex: 1, questionIndex: 0 },
      {},
    );
    const quiet: SessionState = {
      ...session,
      seededGame: {
        ...session.seededGame,
        settings: { ...DEFAULT_SESSION_SETTINGS, collectFeedback: false },
      },
    };

    expect(getFeedbackField(quiet)).toBeNull();
    expect(
      getFeedbackField({
        ...quiet,
        progress: { ...quiet.progress, status: 'ended' },
      }),
    ).toBeNull();
  });
});
