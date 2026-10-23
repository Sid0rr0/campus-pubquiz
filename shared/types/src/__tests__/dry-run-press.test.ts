import { describe, expect, it } from 'vitest';
import { previewMove } from '../dry-run-press';
import type { GameProgress } from '../game-state';
import type { ClosestGuessRevealData } from '../question-views';
import type { SessionState } from '../session-state';
import {
  closestGuessQuestion,
  leaderboardEntry,
  round,
  sessionWith,
} from './session-fixtures';

const NOW = 1_000_000;
const LOCK_GRACE_MS = 60_000;

const ROUNDS = [round(1, [10, 11])];

/** On the block's last question, so the next Advance leaves it. */
function at(
  progress: Partial<GameProgress>,
  overrides: Partial<SessionState> = {},
): SessionState {
  return sessionWith(
    ROUNDS,
    { roundIndex: 0, questionIndex: 1, furthestOpenIndex: 1, ...progress },
    overrides,
  );
}

const SUMMARY: ClosestGuessRevealData = {
  hasSubmissions: true,
  minGuess: '10',
  maxGuess: '90',
  closestGuesses: [{ teamName: 'Team A', value: '50' }],
};

describe('previewMove', () => {
  it('previews a state machine move as the session after the press', () => {
    const session = sessionWith(ROUNDS);

    const { step, session: after } = previewMove(session, 'START_QUIZ', NOW);

    expect(step.kind).toBe('transition');
    expect(after.progress.status).toBe('rules');
  });

  it('never changes the session it is given', () => {
    const session = sessionWith(ROUNDS);

    previewMove(session, 'START_QUIZ', NOW);

    expect(session.progress.status).toBe('lobby');
  });

  it('settles the preview at the time of the press', () => {
    const session = at({ status: 'question_open' });

    const { session: after } = previewMove(session, 'ADVANCE', NOW);

    expect(after.progress.status).toBe('locking');
    expect(after.questionLockAt).toBe(NOW + LOCK_GRACE_MS);
  });

  describe('under the leaderboard', () => {
    const teams = [leaderboardEntry(1, 'A', 20), leaderboardEntry(2, 'B', 10)];

    it('previews showing the next rank, leaving the quiz where it is', () => {
      const session = at(
        { status: 'break_intro', isLeaderboardVisible: true },
        { leaderboard: teams, leaderboardRevealCount: 0 },
      );

      const { step, session: after } = previewMove(session, 'ADVANCE', NOW);

      expect(step.kind).toBe('leaderboard_reveal');
      expect(after.leaderboardRevealCount).toBe(1);
      expect(after.progress.status).toBe('break_intro');
    });

    it('previews hiding the board as the leaderboard toggle once every rank is shown', () => {
      const session = at(
        { status: 'break_intro', isLeaderboardVisible: true },
        { leaderboard: teams, leaderboardRevealCount: 2 },
      );

      const { step, session: after } = previewMove(session, 'ADVANCE', NOW);

      expect(step.kind).toBe('leaderboard_hide');
      expect(after.progress.isLeaderboardVisible).toBe(false);
      expect(after.leaderboardRevealCount).toBe(0);
    });
  });

  it('previews hiding the join overlay without handing out more time', () => {
    const session = at(
      { status: 'locking', isJoinOverlayVisible: true },
      { questionLockAt: 5000 },
    );

    const { step, session: after } = previewMove(session, 'ADVANCE', NOW);

    expect(step.kind).toBe('join_overlay_hide');
    expect(after.progress.isJoinOverlayVisible).toBe(false);
    expect(after.questionLockAt).toBe(5000);
  });

  it('previews a reveal step as the session the step carries', () => {
    const session = sessionWith(
      [round(1, [10], { questions: [closestGuessQuestion(10)] })],
      {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 0,
        furthestOpenIndex: 0,
      },
      { revealStep: 0, closestGuessSummaries: { 10: SUMMARY } },
    );

    const { step, session: after } = previewMove(session, 'ADVANCE', NOW);

    expect(step.kind).toBe('reveal_step');
    expect(after.revealStep).toBe(1);
    expect(session.revealStep).toBe(0);
  });

  describe('presses that move nothing', () => {
    it('leaves the session as it is while answers still wait for grading', () => {
      const session = at(
        { status: 'break', revealIndex: 1 },
        { ungradedQuestionIds: [10] },
      );

      const preview = previewMove(session, 'ADVANCE', NOW);

      expect(preview.step.kind).toBe('grading_pending');
      expect(preview.session).toBe(session);
    });

    it('leaves the session as it is while a showdown waits for guesses', () => {
      const session = at(
        { status: 'ended' },
        {
          activeShowdownRound: {
            id: 1,
            question: 'How many?',
            answer: '5',
            participants: [
              { teamId: 1, teamName: 'A', seatIndex: 0, guess: '4' },
              { teamId: 2, teamName: 'B', seatIndex: 1, guess: null },
            ],
            winnerTeamId: null,
            isTie: false,
            resolved: false,
          },
        },
      );

      const preview = previewMove(session, 'ADVANCE', NOW);

      expect(preview.step.kind).toBe('showdown_waiting');
      expect(preview.session).toBe(session);
    });

    it('leaves the session as it is for a press the state machine refuses', () => {
      const session = sessionWith(ROUNDS);

      const preview = previewMove(session, 'PREVIOUS', NOW);

      expect(preview.step.kind).toBe('blocked');
      expect(preview.session).toBe(session);
    });
  });
});
