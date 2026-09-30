import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const SHOWDOWN_POINTS = 5;
const TIED_TEAM_POINTS = 2;

describe('GameGateway — showdown reveal-step gating', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
    await tieOnFirstQuestion(game, game.teams);
  });

  async function createRound(): Promise<void> {
    const admin = await game.connectAdmin();
    await game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many people are in this room?',
      answer: '42',
      points: SHOWDOWN_POINTS,
    });
  }

  async function guess(teamIndex: number, value: string): Promise<void> {
    const { socket, teamId } = game.teams[teamIndex];
    const { activeShowdown } = await game.snapshot();
    await game.gateway.handleSubmitShowdownGuess(asSocket(socket), {
      showdownRoundId: activeShowdown!.id,
      teamId,
      value,
    });
  }

  /**
   * Reaches 'ended' via the same END_QUIZ escape hatch the admin's "End Quiz"
   * button uses (legal from any non-ended status) — the showdown-reveal
   * intercept only engages once status is genuinely 'ended'.
   */
  async function endQuiz(): Promise<void> {
    const final = await game.act('END_QUIZ');
    expect(final.progress.status).toBe('ended');
  }

  function bonusByTeam(
    snapshot: Awaited<ReturnType<RealStoreGateway['snapshot']>>,
  ): Record<string, number> {
    return Object.fromEntries(
      snapshot.leaderboard.map((entry) => [entry.teamName, entry.bonusPoints]),
    );
  }

  it("does not intercept ADVANCE before the quiz reaches ended, even with an active round — the block's own reveal keeps driving", async () => {
    for (const action of [
      'ADVANCE', // q2
      'ADVANCE', // q3
      'ADVANCE', // q4
      'ADVANCE', // q5
      'ADVANCE', // -> locking
      'ADVANCE', // -> break_intro
    ] as const) {
      await game.act(action);
    }
    // Admin composes the tiebreaker question during grading, before the
    // block's own answers have been revealed to the audience.
    await createRound();

    const stepped = await game.act('ADVANCE');

    expect(stepped.progress.status).toBe('reveal_intro');
    expect(stepped.showdownRevealStep).toBe(0);
    expect(stepped.activeShowdown?.winnerTeamId).toBeUndefined();
    expect(bonusByTeam(stepped)).toEqual({ 'Team A': 0, 'Team B': 0 });
  });

  it('throws when ADVANCE is pressed before every participant has guessed', async () => {
    await endQuiz();
    await createRound();
    await guess(0, '40');
    // Team B (seatIndex 1) still hasn't guessed.

    await expect(game.act('ADVANCE')).rejects.toThrow(
      'not every team has submitted a guess',
    );

    const after = await game.snapshot();
    expect(after.showdownRevealStep).toBe(0);
    expect(bonusByTeam(after)).toEqual({ 'Team A': 0, 'Team B': 0 });
  });

  it('walks ADVANCE through every step once every participant has guessed, resolving on the final step and refreshing the leaderboard', async () => {
    await endQuiz();
    await createRound();
    await guess(0, '40');
    await guess(1, '50');
    const [teamA, teamB] = game.teams;

    const step1 = await game.act('ADVANCE');
    expect(step1.showdownRevealStep).toBe(1);
    expect(step1.activeShowdown?.participants[0].guess).toBe('40');
    expect(step1.activeShowdown?.participants[1].guess).toBeUndefined();
    // Never falls through to getNextGameState — status is untouched.
    expect(step1.progress.status).toBe('ended');

    const step2 = await game.act('ADVANCE');
    expect(step2.showdownRevealStep).toBe(2);
    expect(step2.activeShowdown?.participants[1].guess).toBe('50');
    expect(step2.activeShowdown?.winnerTeamId).toBeUndefined();
    expect(bonusByTeam(step2)).toEqual({ 'Team A': 0, 'Team B': 0 });

    // Crossing into the final step (N+1 = 3) resolves the round: 40 is
    // closer to 42 than 50 is, so Team A wins the showdown bonus.
    const finalStep = await game.act('ADVANCE');
    expect(finalStep.showdownRevealStep).toBe(3);
    expect(finalStep.activeShowdown?.answer).toBe('42');
    expect(finalStep.activeShowdown?.winnerTeamId).toBe(teamA.teamId);
    expect(finalStep.leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          teamId: teamA.teamId,
          totalPoints: TIED_TEAM_POINTS + SHOWDOWN_POINTS,
          bonusPoints: SHOWDOWN_POINTS,
        }),
        expect.objectContaining({
          teamId: teamB.teamId,
          totalPoints: TIED_TEAM_POINTS,
          bonusPoints: 0,
        }),
      ]),
    );

    // A repeated ADVANCE at the final step is a harmless no-op: the round
    // isn't resolved (and the bonus isn't awarded) a second time.
    const repeated = await game.act('ADVANCE');
    expect(repeated.showdownRevealStep).toBe(3);
    expect(bonusByTeam(repeated)).toEqual({
      'Team A': SHOWDOWN_POINTS,
      'Team B': 0,
    });
  });

  it('walks PREVIOUS backward without resolving', async () => {
    await endQuiz();
    await createRound();
    await guess(0, '40');
    await guess(1, '50');
    await game.act('ADVANCE'); // step 1
    await game.act('ADVANCE'); // step 2

    const back = await game.act('PREVIOUS');
    expect(back.showdownRevealStep).toBe(1);
    expect(bonusByTeam(back)).toEqual({ 'Team A': 0, 'Team B': 0 });

    // PREVIOUS at step 0 is a harmless no-op.
    await game.act('PREVIOUS');
    const atZero = await game.act('PREVIOUS');
    expect(atZero.showdownRevealStep).toBe(0);
  });
});
