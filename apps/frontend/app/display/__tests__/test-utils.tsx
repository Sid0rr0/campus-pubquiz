import {
  describeOnAirScreen,
  type DisplayStatePayload,
  type GameProgress,
  type QuestionView,
} from '@campus-pubquiz/types';

export function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

export const question: QuestionView = {
  id: 1,
  type: 'multiple_choice',
  prompt: 'Capital of France?',
  options: ['Paris', 'London'],
  points: 2,
};

/**
 * Builds the view /display is sent from a partial fixture: the fixture is the
 * core snapshot, and the on-air fields the server adds are derived from it
 * with the same shared rule the backend projection uses.
 */
export function displayView<T extends { progress: GameProgress }>(
  snapshot: T,
): T & Pick<DisplayStatePayload, DisplayViewFields> {
  const { screen, screenKey, header } = describeOnAirScreen(snapshot);
  const { progress } = snapshot;
  return {
    ...snapshot,
    onAirScreen: screen,
    screenKey,
    header,
    isBetweenKahootQuestions:
      Boolean(
        (snapshot as { isCurrentRoundKahoot?: boolean }).isCurrentRoundKahoot,
      ) &&
      progress.status === 'question_open' &&
      progress.isLeaderboardVisible,
  };
}

type DisplayViewFields =
  | 'onAirScreen'
  | 'screenKey'
  | 'header'
  | 'isBetweenKahootQuestions';
