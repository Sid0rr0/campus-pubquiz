import { type GameAction } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 3;
const KAHOOT_ANSWER_DELAY_MS = 1_500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GameGateway — state transitions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  /** Sends each action in order and returns the snapshot the last one produced. */
  async function actAll(actions: GameAction[], from = game) {
    let snapshot = await from.snapshot();
    for (const action of actions) {
      snapshot = await from.act(action);
    }
    return snapshot;
  }

  function questionId(roundIndex: number, questionIndex: number): number {
    return game.rounds[roundIndex].questionIds[questionIndex];
  }

  const START_TO_FIRST_QUESTION: GameAction[] = [
    'START_QUIZ',
    'ADVANCE', // -> round_intro(0)
    'ADVANCE', // -> r1q1
  ];

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
  });

  it('starts in the lobby with no current question', async () => {
    const snapshot = await game.snapshot();
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('sends the quiz into the rules screen on START_QUIZ, without opening a question yet', async () => {
    const snapshot = await game.act('START_QUIZ');
    expect(snapshot.progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
      previousStatus: null,
    });
    expect(snapshot.currentQuestion).toBeNull();
  });

  it("shows round 1's intro card when advancing past the rules screen, without opening a question yet", async () => {
    const snapshot = await actAll(['START_QUIZ', 'ADVANCE']);
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
      previousStatus: null,
    });
    expect(snapshot.roundTitle).toBe('General Knowledge');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('always populates roundTitles with every round in the quiz, in order', async () => {
    const snapshot = await game.snapshot();
    expect(snapshot.roundTitles).toEqual([
      'General Knowledge',
      'Landmarks & Flags',
    ]);
  });

  it('opens the first question of the first round when advancing past its intro card', async () => {
    const snapshot = await actAll(START_TO_FIRST_QUESTION);
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      previousStatus: null,
    });
    expect(snapshot.currentQuestion?.id).toBe(questionId(0, 0));
  });

  it('advances to the next question within round 1', async () => {
    const snapshot = await actAll([...START_TO_FIRST_QUESTION, 'ADVANCE']);
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 1, // r1q2 (block position 1) just opened
      previousStatus: null,
    });
    expect(snapshot.currentQuestion?.id).toBe(questionId(0, 1));
  });

  it("shows round 2's intro card after round 1 finishes (no break configured)", async () => {
    const snapshot = await actAll([
      ...START_TO_FIRST_QUESTION,
      'ADVANCE', // -> r1q2
      'ADVANCE', // round 1 done, no break -> round 2 intro
    ]);
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 1, // r1q2 (block position 1) was already opened
      previousStatus: null,
    });
    expect(snapshot.roundTitle).toBe('Landmarks & Flags');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('moves into round 2 after advancing past its intro card', async () => {
    const snapshot = await actAll([
      ...START_TO_FIRST_QUESTION,
      'ADVANCE', // -> r1q2
      'ADVANCE', // -> round_intro(1)
      'ADVANCE', // round 2 q0
    ]);
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 2, // r2q1 (block position 2) just opened
      previousStatus: null,
    });
    expect(snapshot.currentQuestion?.id).toBe(questionId(1, 0));
  });

  it('moves back to the previous question with PREVIOUS', async () => {
    const snapshot = await actAll([
      ...START_TO_FIRST_QUESTION,
      'ADVANCE', // -> r1q2
      'PREVIOUS',
    ]);
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 1, // stepping back with PREVIOUS doesn't shrink it — r1q2 stayed open
      previousStatus: null,
    });
    expect(snapshot.currentQuestion?.id).toBe(questionId(0, 0));
  });

  it("moves back to round 1's intro card from its first question instead of rejecting", async () => {
    const snapshot = await actAll([...START_TO_FIRST_QUESTION, 'PREVIOUS']);
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      previousStatus: null,
    });
    expect(snapshot.currentQuestion).toBeNull();
  });

  it("steps back from round 0's intro card to the rules screen", async () => {
    const snapshot = await actAll(['START_QUIZ', 'ADVANCE', 'PREVIOUS']);
    expect(snapshot.progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
      previousStatus: null,
    });
  });

  it('rejects moving back out of the rules screen', async () => {
    await game.act('START_QUIZ');
    await expect(game.act('PREVIOUS')).rejects.toThrow(
      'Cannot apply action "PREVIOUS" from state "rules"',
    );
  });

  describe('to the end of round 2', () => {
    const TO_LOCKING: GameAction[] = [
      ...START_TO_FIRST_QUESTION,
      'ADVANCE', // -> r1q2
      'ADVANCE', // -> round_intro(1)
      'ADVANCE', // -> r2q1
      'ADVANCE', // -> r2q2
      'ADVANCE', // round 2 done, breakAfter -> locking
    ];
    const TO_REVEAL: GameAction[] = [
      ...TO_LOCKING,
      'ADVANCE', // -> break_intro
      'ADVANCE', // -> reveal_intro (round 0)
      'ADVANCE', // -> reveal (revealIndex 0)
    ];
    const THROUGH_REVEAL: GameAction[] = [
      'ADVANCE', // -> revealIndex 1 (round 0, still)
      'ADVANCE', // -> reveal_intro (round 1)
      'ADVANCE', // -> revealIndex 2
      'ADVANCE', // -> revealIndex 3 (last)
      'ADVANCE', // -> ended
    ];

    it('enters the locking countdown once round 2 (breakAfter: true) finishes, keeping the question visible', async () => {
      const locking = await actAll(TO_LOCKING);
      expect(locking.progress.status).toBe('locking');
      expect(locking.currentQuestion?.id).toBe(questionId(1, 1));

      const breakSnapshot = await game.act('ADVANCE'); // locking -> break_intro
      expect(breakSnapshot.progress.status).toBe('break_intro');
      expect(breakSnapshot.currentQuestion).toBeNull();
    });

    it('goes from break to reveal to ended for the final round group', async () => {
      await actAll([...TO_LOCKING, 'ADVANCE']); // -> break_intro

      const revealIntro = await game.act('ADVANCE'); // -> reveal_intro (round 0)
      expect(revealIntro.progress.status).toBe('reveal_intro');
      expect(revealIntro.progress.revealIndex).toBe(0);

      const reveal = await game.act('ADVANCE');
      expect(reveal.progress.status).toBe('reveal');
      expect(reveal.progress.revealIndex).toBe(0);

      // The block has 4 questions across 2 rounds (r1q1, r1q2, r2q1, r2q2):
      // ADVANCE steps through each one, showing a fresh reveal_intro card
      // whenever it crosses into the next round, before finally leaving reveal.
      await game.act('ADVANCE'); // -> revealIndex 1 (round 0, still)
      const round2Intro = await game.act('ADVANCE'); // -> reveal_intro (round 1)
      expect(round2Intro.progress.status).toBe('reveal_intro');
      expect(round2Intro.progress.revealIndex).toBe(2);
      await game.act('ADVANCE'); // -> revealIndex 2
      await game.act('ADVANCE'); // -> revealIndex 3 (last)
      const ended = await game.act('ADVANCE'); // -> ended
      expect(ended.progress.status).toBe('ended');
    });

    it('round-trips through Previous and Advance around a natural end', async () => {
      const ended = await actAll([...TO_REVEAL, ...THROUGH_REVEAL]);
      expect(ended.progress.status).toBe('ended');
      expect(ended.progress.previousStatus).toBe('reveal');

      await game.act('TOGGLE_LEADERBOARD'); // PREVIOUS is covered while the board is up
      const revealAgain = await game.act('PREVIOUS');
      expect(revealAgain.progress).toEqual({
        status: 'reveal',
        roundIndex: 1,
        questionIndex: 1,
        isLeaderboardVisible: false,
        revealIndex: 3,
        furthestOpenIndex: 3,
        previousStatus: null,
      });

      const endedAgain = await game.act('ADVANCE'); // -> ended again
      expect(endedAgain.progress.status).toBe('ended');
      expect(endedAgain.progress.previousStatus).toBe('reveal');
    });
  });

  it('rejects out-of-order actions with the illegal-transition message', async () => {
    // ADVANCE is illegal from the lobby - the quiz has not started yet
    await expect(game.act('ADVANCE')).rejects.toThrow(
      'Cannot apply action "ADVANCE" from state "lobby"',
    );
  });

  it('restores the exact live question when Previous undoes an early manual End Quiz', async () => {
    const ended = await actAll([...START_TO_FIRST_QUESTION, 'END_QUIZ']);
    expect(ended.progress.status).toBe('ended');
    expect(ended.progress.previousStatus).toBe('question_open');

    const restored = await game.act('PREVIOUS');
    expect(restored.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      previousStatus: null,
    });
    expect(restored.currentQuestion?.id).toBe(questionId(0, 0));
  });

  describe('kahootMode round', () => {
    const KAHOOT_ROUNDS: QuizRoundSpec[] = [
      {
        title: 'Speed Round',
        kahootMode: true,
        questions: [
          {
            type: 'multiple_choice',
            prompt: 'Capital of France?',
            answer: 'Paris',
            points: 10,
            payload: { options: ['Paris', 'London'] },
          },
          {
            type: 'multiple_choice',
            prompt: 'Capital of Italy?',
            answer: 'Rome',
            points: 10,
            payload: { options: ['Rome', 'Milan'] },
          },
        ],
      },
    ];
    const KAHOOT_TO_FIRST_QUESTION: GameAction[] = [
      'START_QUIZ',
      'ADVANCE', // -> round_intro
      'ADVANCE', // -> question_open q0
    ];
    let kahoot: RealStoreGateway;

    beforeEach(async () => {
      kahoot = await harness.createGateway({
        joinCode: 'KAHOOT',
        rounds: KAHOOT_ROUNDS,
        teamNames: ['Speedy'],
        settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
      });
    });

    it('locks, speed-scores, and reveals each question one at a time, skipping break/reveal_intro entirely', async () => {
      const [{ socket: team, teamId }] = kahoot.teams;
      const [firstId, secondId] = kahoot.rounds[0].questionIds;
      await actAll(KAHOOT_TO_FIRST_QUESTION, kahoot);

      // Answering halfway through the question timer is worth less than the
      // full 10 points once the speed scaling is applied at lock time.
      await delay(KAHOOT_ANSWER_DELAY_MS);
      await kahoot.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: firstId,
        teamId,
        value: 'Paris',
      });

      const locking = await kahoot.act('ADVANCE');
      expect(locking.progress.status).toBe('locking');
      expect(locking.currentQuestion?.id).toBe(firstId);

      const reveal = await kahoot.act('ADVANCE');
      expect(reveal.progress.status).toBe('reveal');
      expect(reveal.progress.revealIndex).toBe(0);
      const scored = reveal.leaderboard.find(
        (entry) => entry.teamId === teamId,
      );
      expect(scored?.totalPoints).toBeGreaterThan(0);
      expect(scored?.totalPoints).toBeLessThan(10);

      const nextOpen = await kahoot.act('ADVANCE');
      expect(nextOpen.progress.status).toBe('question_open');
      expect(nextOpen.progress.questionIndex).toBe(1);
      expect(nextOpen.currentQuestion?.id).toBe(secondId);

      await kahoot.act('ADVANCE'); // hides the between-questions board
      await kahoot.act('ADVANCE'); // -> locking q1
      const secondReveal = await kahoot.act('ADVANCE');
      expect(secondReveal.progress.status).toBe('reveal');

      const ended = await kahoot.act('ADVANCE');
      expect(ended.progress.status).toBe('ended');
    });

    it('never checks for ungraded answers, since the locking->reveal collapse never passes through break/break_intro', async () => {
      // A human-graded audio answer stays ungraded; if the kahoot
      // locking->reveal collapse ever routed through the break/break_intro
      // ungraded-answers gate, ADVANCE would reject.
      const withUngraded = await harness.createGateway({
        joinCode: 'KAHUNG',
        teamNames: ['Humans'],
        rounds: [
          {
            title: 'Speed Round',
            kahootMode: true,
            questions: [
              { type: 'audio', prompt: 'Which band?', answer: 'Queen' },
            ],
          },
        ],
      });
      const [{ socket: team, teamId }] = withUngraded.teams;
      await actAll(KAHOOT_TO_FIRST_QUESTION, withUngraded);
      await withUngraded.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: withUngraded.rounds[0].questionIds[0],
        teamId,
        value: 'Queen',
      });
      await withUngraded.act('ADVANCE'); // -> locking

      await expect(withUngraded.act('ADVANCE')).resolves.toMatchObject({
        progress: { status: 'reveal' },
      });
    });

    it('steps backward through kahoot questions with PREVIOUS', async () => {
      await actAll(
        [
          ...KAHOOT_TO_FIRST_QUESTION,
          'ADVANCE', // -> locking q0
          'ADVANCE', // -> reveal q0
          'ADVANCE', // -> question_open q1, hidden behind the board
          'ADVANCE', // hides the board
        ],
        kahoot,
      );

      const backToReveal = await kahoot.act('PREVIOUS');
      expect(backToReveal.progress.status).toBe('reveal');
      expect(backToReveal.progress.questionIndex).toBe(0);

      const backToLocking = await kahoot.act('PREVIOUS');
      expect(backToLocking.progress.status).toBe('locking');
      expect(backToLocking.progress.questionIndex).toBe(0);
    });

    it('does not re-score a question if PREVIOUS reopens locking and ADVANCE re-reveals it', async () => {
      const [{ socket: team, teamId }] = kahoot.teams;
      await actAll(KAHOOT_TO_FIRST_QUESTION, kahoot);
      await delay(KAHOOT_ANSWER_DELAY_MS);
      await kahoot.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: kahoot.rounds[0].questionIds[0],
        teamId,
        value: 'Paris',
      });
      await kahoot.act('ADVANCE'); // -> locking q0
      const reveal = await kahoot.act('ADVANCE'); // -> reveal q0 (scores once)
      const scoredOnce = reveal.leaderboard.find(
        (entry) => entry.teamId === teamId,
      )?.totalPoints;
      await kahoot.act('PREVIOUS'); // -> back to locking q0

      const revealAgain = await kahoot.act('ADVANCE'); // -> reveal q0 again
      expect(revealAgain.progress.status).toBe('reveal');
      expect(
        revealAgain.leaderboard.find((entry) => entry.teamId === teamId)
          ?.totalPoints,
      ).toBe(scoredOnce);
    });
  });
});
