import {
  SOCKET_ROOMS,
  type GameAction,
  type OnAirScreen,
  type ScreenPreview,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import type {
  QuizQuestionSpec,
  QuizRoundSpec,
  RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

/** Every question's spec, by seeded question id. */
function questionSpecsById(
  game: RealStoreGateway,
  specs: QuizRoundSpec[],
): Map<number, QuizQuestionSpec> {
  const byId = new Map<number, QuizQuestionSpec>();
  specs.forEach((round, roundIndex) =>
    round.questions.forEach((question, questionIndex) =>
      byId.set(game.rounds[roundIndex].questionIds[questionIndex], question),
    ),
  );
  return byId;
}

/**
 * Builds the step that has every team answer each question the first time it
 * is open and answerable, so the board has standings to reveal: team N scores
 * on a question when `isCorrect(N, questionOrdinal)`, and answers wrongly
 * otherwise. Call the returned function before each press of a walk.
 */
export function createAnswerer(
  game: RealStoreGateway,
  specs: QuizRoundSpec[],
  isCorrect: (teamIndex: number, questionOrdinal: number) => boolean,
): () => Promise<void> {
  const specById = questionSpecsById(game, specs);
  const ordinalById = new Map(
    [...specById.keys()].map((id, ordinal) => [id, ordinal]),
  );
  const answered = new Set<number>();
  let admin: MockSocket | undefined;
  // A wrong typed answer waits for the moderator, so the walk grades it zero
  // — Advance out of the break is refused while any is ungraded.
  async function gradeWrongAnswersZero(questionId: number) {
    admin ??= await game.connectAdmin();
    const answers = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    for (const { answerId, gradedAt } of answers) {
      if (gradedAt !== null) continue;
      await game.gateway.handleGradeAnswer(asSocket(admin), {
        answerId,
        pointsAwarded: 0,
      });
    }
  }
  return async () => {
    const view = game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
    const question = view.currentQuestion;
    if (
      view.progress.status !== 'question_open' ||
      view.progress.isLeaderboardVisible ||
      !question ||
      answered.has(question.id)
    ) {
      return;
    }
    answered.add(question.id);
    const spec = specById.get(question.id)!;
    for (const [index, { socket, teamId }] of game.teams.entries()) {
      const right = isCorrect(index, ordinalById.get(question.id)!);
      const wrongNumber = String(Number(spec.answer) - 100 * (index + 1));
      const wrong = spec.type === 'closest_guess' ? wrongNumber : 'nope';
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: question.id,
        teamId,
        value: right ? spec.answer : wrong,
      });
    }
    if (spec.type === 'free_text') await gradeWrongAnswersZero(question.id);
  };
}

/** The heading each on-air screen kind is previewed under on /remote. */
export const HEADING_BY_SCREEN: Record<OnAirScreen['kind'], RegExp> = {
  lobby: /^Lobby$/,
  rules: /^Rules$/,
  round_overview: /^Round overview$/,
  round_title: /^Round \d+ title$/,
  question: /^R\d+ Q\d+$/,
  locking: /^Locking answers$/,
  break_intro: /^Break \d+$/,
  break_review: /^Break · Reviewing /,
  break_round_title: /^Break · Round \d+ title$/,
  reveal_intro: /^Revealing · Round \d+ title$/,
  reveal: /^Revealing R\d+ Q\d+$/,
  leaderboard: /^Leaderboard$/,
  ended: /^Quiz complete!$/,
  showdown: /^Showdown$/,
};

const WAITING_BODIES = ['Waiting for every guess', 'Waiting for grading'];
const MAX_WALK_STEPS = 120;

/** What one press did to the quiz: moved it, was accepted but changed nothing, or was refused. */
export type PressOutcome = 'moved' | 'unmoved' | 'refused';

/** The /remote preview and the /display screen at one instant. */
export interface Observation {
  currentHeading: string;
  next: ScreenPreview | null;
  kind: OnAirScreen['kind'];
  key: string;
  status: string;
  position: string;
}

export interface PressResult {
  outcome: PressOutcome;
  before: Observation;
  after: Observation;
  /** Names the way the preview and the press disagreed; null when they agreed. */
  disagreement: string | null;
}

/**
 * Press-and-compare for the /remote presenter preview: before a press it
 * takes the preview's "next" screen, presses, and checks that the screen now
 * on air is that one — heading, on-air screen kind and key — or that a press
 * which moved nothing was previewed as moving nothing (or as waiting).
 * `nameDisagreement` turns a mismatch into a named exception; every
 * disagreement a walk meets is returned so the spec can pin it.
 */
export function createPreviewWalk(
  game: RealStoreGateway,
  nameDisagreement: (result: Omit<PressResult, 'disagreement'>) => string,
) {
  function observe(): Observation {
    const { currentScreen, nextScreen } = game.gameState.getPresenterContext(
      game.joinCode,
    );
    const view = game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
    const snapshot = game.gameState.getSnapshot(game.joinCode);
    const { progress } = snapshot;
    return {
      currentHeading: currentScreen.heading,
      next: nextScreen,
      kind: view.onAirScreen.kind,
      key: view.screenKey,
      status: progress.status,
      position: JSON.stringify([
        progress.status,
        progress.roundIndex,
        progress.questionIndex,
        progress.revealIndex,
        snapshot.closestGuessRevealStep,
        snapshot.showdownRevealStep,
        progress.isLeaderboardVisible,
        snapshot.leaderboardRevealCount,
      ]),
    };
  }

  function isPreviewedAsWaiting(next: ScreenPreview | null): boolean {
    return next === null || WAITING_BODIES.includes(next.body ?? '');
  }

  function movedAgrees(before: Observation, after: Observation): boolean {
    const { next } = before;
    return (
      next !== null &&
      next.heading === after.currentHeading &&
      HEADING_BY_SCREEN[after.kind].test(next.heading) &&
      (next.heading === before.currentHeading || after.key !== before.key)
    );
  }

  /** Presses `action`, and says how the preview taken just before compared with what happened. */
  async function pressAndCompare(
    action: GameAction = 'ADVANCE',
  ): Promise<PressResult> {
    const before = observe();
    let isRefused = false;
    try {
      await game.act(action);
    } catch {
      isRefused = true;
    }
    const after = observe();
    const outcome: PressOutcome = isRefused
      ? 'refused'
      : after.position === before.position
        ? 'unmoved'
        : 'moved';
    const agrees =
      outcome === 'moved'
        ? movedAgrees(before, after)
        : isPreviewedAsWaiting(before.next);
    const result = { outcome, before, after };
    return {
      ...result,
      disagreement: agrees ? null : nameDisagreement(result),
    };
  }

  /**
   * Presses ADVANCE (START_QUIZ from the lobby) until a press is accepted and
   * moves nothing, running `beforePress` first each time. A refused press
   * ends the walk too, so a scenario that expects one handles it itself.
   * Returns every press and the disagreements met.
   */
  async function walk(
    beforePress: (observation: Observation) => Promise<void> = async () => {},
  ) {
    const presses: PressResult[] = [];
    for (let step = 0; step < MAX_WALK_STEPS; step += 1) {
      await beforePress(observe());
      const isLobby = observe().status === 'lobby';
      const press = await pressAndCompare(isLobby ? 'START_QUIZ' : 'ADVANCE');
      presses.push(press);
      if (press.outcome !== 'moved') return summarise(presses);
    }
    throw new Error('the walk never reached a press that moves nothing');
  }

  return { observe, pressAndCompare, walk };
}

/** The distinct disagreements across `presses`, and the presses themselves. */
export function summarise(presses: PressResult[]) {
  return {
    presses,
    disagreements: [
      ...new Set(
        presses.flatMap(({ disagreement }) =>
          disagreement ? [disagreement] : [],
        ),
      ),
    ].sort(),
  };
}
