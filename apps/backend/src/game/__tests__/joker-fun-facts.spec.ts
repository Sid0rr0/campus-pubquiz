import type { DisplayStatePayload } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const THREE_ROUNDS: QuizRoundSpec[] = [1, 2, 3].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: `Question of round ${number}?`,
      answer: 'right',
      points: 1000,
      payload: { options: ['right', 'wrong'] },
    },
  ],
}));

const MAX_ADVANCES = 16;

describe('Display view — joker fun facts on the break screen', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function displayView(): Promise<DisplayStatePayload> {
    return game.resync('display');
  }

  async function funFacts() {
    const view = await displayView();
    return view.screen.kind === 'break_intro' ? view.screen.funFacts : [];
  }

  async function advanceUntil(
    isReached: (view: DisplayStatePayload) => boolean,
  ) {
    for (let step = 0; step < MAX_ADVANCES; step += 1) {
      await game.act('ADVANCE');
      if (isReached(await displayView())) return;
    }
    throw new Error('The screen was never reached');
  }

  async function answerRound(roundIndex: number, values: string[]) {
    for (const [index, value] of values.entries()) {
      const { socket, teamId } = game.teams[index];
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: game.rounds[roundIndex].questionIds[0],
        teamId,
        value,
      });
    }
  }

  /** Both teams on round 1 (Alpha picks, Bravo only when `bravoPicks`), playing to the first break. */
  async function playToFirstBreak(
    settings: { jokersEnabled: boolean },
    bravoPicks = true,
  ) {
    game = await harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha', 'Bravo'],
      settings: { showRoundOverview: settings.jokersEnabled, ...settings },
    });
    await game.act('START_QUIZ');
    if (settings.jokersEnabled) {
      await game.act('ADVANCE'); // -> round_overview
      await game.act('ADVANCE'); // -> joker_pick
      const [alpha, bravo] = game.teams;
      await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[0].id,
      });
      if (bravoPicks) {
        await game.gateway.handlePickJoker(asSocket(bravo.socket), {
          roundId: game.rounds[0].id,
        });
      }
    }
    await advanceUntil((view) => view.progress.status === 'question_open');
    await answerRound(0, ['right', 'wrong']);
    await advanceUntil((view) => view.screen.kind === 'break_intro');
  }

  async function playToSecondBreak() {
    await advanceUntil(
      (view) =>
        view.progress.status === 'question_open' &&
        view.progress.roundIndex === 1,
    );
    await answerRound(1, ['right', 'right']);
    await advanceUntil((view) => view.screen.kind === 'break_intro');
  }

  it('names the favourite and a snubbed round from the first break, but no team yet', async () => {
    await playToFirstBreak({ jokersEnabled: true });

    const facts = await funFacts();

    expect(facts.map((fact) => fact.kind)).toEqual([
      'joker_favourite_round',
      'joker_snubbed_round',
    ]);
    expect(facts[0]).toEqual({
      kind: 'joker_favourite_round',
      roundNumber: 1,
      roundTitle: 'Round 1',
      teamCount: 2,
    });
    expect(facts[1]).toMatchObject({ roundNumber: 2 });
  });

  it('counts the team that ran out of time as a drawn joker', async () => {
    await playToFirstBreak({ jokersEnabled: true }, false);

    const facts = await funFacts();

    expect(facts).toContainEqual({ kind: 'joker_drawn_count', teamCount: 1 });
  });

  it('names the best joker once its round is revealed', async () => {
    await playToFirstBreak({ jokersEnabled: true });
    await playToSecondBreak();

    const facts = await funFacts();

    expect(facts).toContainEqual({
      kind: 'best_joker',
      teamName: 'Alpha',
      roundNumber: 1,
      roundTitle: 'Round 1',
      extraPoints: 1000,
    });
    // Only round 1 is revealed at the second break: no backfire to call yet.
    expect(facts.map((fact) => fact.kind)).not.toContain('joker_backfired');
  });

  it('has no joker fact when Jokers is off', async () => {
    await playToFirstBreak({ jokersEnabled: false });
    await playToSecondBreak();

    const kinds = (await funFacts()).map((fact) => fact.kind);

    expect(kinds.filter((kind) => kind.startsWith('joker'))).toEqual([]);
    expect(kinds).not.toContain('best_joker');
  });
});
