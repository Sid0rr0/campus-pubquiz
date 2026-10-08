import {
  freshSessionState,
  getBlockInPlayIds,
  getBlockQuestions,
  getBlockSeededQuestions,
  getRevealQuestions,
  getNextGameState,
  LOBBY_PROGRESS,
  type GameAction,
  type GameContext,
  type GameProgress,
  type SeededGame,
} from '@campus-pubquiz/types';
import { BLOCK_IN_PLAY_ROUNDS } from '@/game/__tests__/block-in-play-quiz';

const seededGame: SeededGame = {
  quizId: 1,
  gameSessionId: 1,
  joinCode: 'ABCD',
  rounds: BLOCK_IN_PLAY_ROUNDS,
  settings: {
    showRoundOverview: true,
  } as SeededGame['settings'],
};

const context: GameContext = {
  rounds: BLOCK_IN_PLAY_ROUNDS.map((round) => ({
    questionCount: round.questions.length,
    breakAfter: round.breakAfter,
    kahootMode: round.kahootMode ?? false,
  })),
  showRoundOverview: true,
};

function press(
  progress: GameProgress,
  action: GameAction,
): GameProgress | null {
  try {
    return getNextGameState(progress, action, context);
  } catch {
    return null;
  }
}

/** Every progress reached by Advancing k times and then pressing Previous back as far as it goes, plus End Quiz pressed at each of them. */
function walkedProgresses(): GameProgress[] {
  const forward: GameProgress[] = [press(LOBBY_PROGRESS, 'START_QUIZ')!];
  for (;;) {
    const next = press(forward[forward.length - 1], 'ADVANCE');
    if (next === null || next.status === 'ended') break;
    forward.push(next);
  }

  const visited = forward.flatMap((start) => {
    const back: GameProgress[] = [start];
    for (;;) {
      const previous = press(back[back.length - 1], 'PREVIOUS');
      if (previous === null || previous.status === 'lobby') break;
      back.push(previous);
    }
    return back;
  });
  const all = [
    LOBBY_PROGRESS,
    ...visited,
    ...visited.flatMap((at) => press(at, 'END_QUIZ') ?? []),
  ];
  // The walks overlap heavily; keep each distinct progress once.
  return [...new Map(all.map((p) => [JSON.stringify(p), p])).values()];
}

describe('the reveal views follow the Block module', () => {
  const progresses = walkedProgresses();

  it('walks every status of the quiz, including through Previous', () => {
    const statuses = new Set(progresses.map((p) => p.status));
    expect([...statuses].sort()).toEqual(
      [
        'break',
        'break_intro',
        'break_round_intro',
        'ended',
        'lobby',
        'locking',
        'question_open',
        'reveal',
        'reveal_intro',
        'round_intro',
        'round_overview',
        'rules',
      ].sort(),
    );
  });

  it.each(progresses.map((p, index) => [index, p] as const))(
    'lists the same questions in the same order as the Block module at step %i',
    (_index, progress) => {
      const session = freshSessionState(seededGame, progress);
      const expected = getBlockInPlayIds(BLOCK_IN_PLAY_ROUNDS, progress);

      expect(getBlockSeededQuestions(session).map((q) => q.id)).toEqual(
        expected,
      );
      expect(getBlockQuestions(session).map((q) => q.id)).toEqual(expected);
      const revealed = getRevealQuestions(session).map((q) => q.id);
      expect(revealed.length === 0 || revealed.join() === expected.join()).toBe(
        true,
      );
    },
  );

  it.each(progresses.map((p, index) => [index, p] as const))(
    'reads the block of an explicit progress without a session copy at step %i',
    (_index, progress) => {
      const lobbySession = freshSessionState(seededGame, LOBBY_PROGRESS);

      expect(
        getBlockSeededQuestions(lobbySession, progress).map((q) => q.id),
      ).toEqual(getBlockInPlayIds(BLOCK_IN_PLAY_ROUNDS, progress));
    },
  );
});
