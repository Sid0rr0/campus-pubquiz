import { describeFunFacts, type FunFact } from './fun-facts';
import { getBreakNumber, isShowingLastBreak } from './game-state-structure';
import {
  pickableRounds,
  toJokerPickRounds,
  type JokerPickRound,
} from './joker';
import { describeLeaderboardBoard } from './leaderboard-board';
import type { OnAirScreen } from './on-air-screen';
import type {
  BlockQuestionView,
  PlayersRevealQuestionView,
  QuestionView,
} from './question-views';
import type { LeaderboardBoard, StateSnapshotPayload } from './room-views';
import { getDisplayRevealNotes, getDisplayRoundNote } from './round-note';
import type { SessionState } from './session-state';
import type { ActiveShowdownView } from './showdown';

/**
 * The screen /display draws, with the content it draws. It has the On-air
 * screen's kinds plus `blank`, which the server sends (and logs) when it can't
 * resolve a screen's content, so the big screen is never silently empty. The
 * page switches on `kind` and looks nothing up.
 */
export type DisplayScreen =
  | { kind: 'lobby' }
  | { kind: 'rules' }
  | { kind: 'round_overview' }
  /** Every round of the quiz, the pick's deadline and the ids of the teams that have picked; never which round any team picked. */
  | {
      kind: 'joker_pick';
      endsAt: number | null;
      rounds: JokerPickRound[];
      /** Roster teams that chose a joker themselves, in roster order. */
      pickedTeamIds: number[];
    }
  | { kind: 'join_overlay' }
  | {
      kind: 'round_title';
      roundNumber: number;
      title: string;
      /** '' when the round has none. */
      category: string;
      /** '' when the round has none. */
      author: string;
      /** '' unless the round shows its note on screen. */
      note: string;
    }
  | { kind: 'question'; question: QuestionView }
  | { kind: 'locking'; lockAt: number }
  | {
      kind: 'break_intro';
      roundNumber: number;
      breakNumber: number;
      isFinalBreak: boolean;
      isFeedbackPromptShown: boolean;
      funFacts: FunFact[];
      breakEndsAt: number | null;
    }
  | { kind: 'break_review'; question: BlockQuestionView }
  | {
      kind: 'break_round_title';
      roundNumber: number;
      title: string;
      note: string;
    }
  | { kind: 'reveal_intro'; roundNumber: number; title: string }
  | {
      kind: 'reveal';
      question: PlayersRevealQuestionView;
      /** '' unless the question shows its notes on screen and its answer is on air. */
      notes: string;
    }
  | {
      kind: 'leaderboard';
      board: LeaderboardBoard;
      revealCount: number;
      isFinal: boolean;
    }
  | { kind: 'ended'; isFeedbackPromptShown: boolean }
  | { kind: 'showdown'; showdown: ActiveShowdownView; step: number }
  | { kind: 'blank' };

/** What the Display screen is built from: the session, the screen on air, and the snapshot's content with the reveal questions already trimmed to what is on air. */
export interface DisplayScreenInput {
  session: SessionState;
  onAir: OnAirScreen;
  snapshot: Omit<StateSnapshotPayload, 'revealQuestions'>;
  revealQuestions: readonly PlayersRevealQuestionView[];
}

/**
 * The media link the big screen is playing, read from the Display screen /display
 * is sent: the open question's own media, or on a reveal screen the answer media
 * (which replaces the question's own), else the question's own. A closest_guess
 * reveal still before its answer step plays nothing. Screens that show no
 * question play nothing.
 */
export function getPlayingMediaUrl(screen: DisplayScreen): string | undefined {
  switch (screen.kind) {
    case 'question':
      return screen.question.mediaUrl;
    case 'reveal':
      return screen.question.revealKind === 'closest_guess_pending'
        ? undefined
        : (screen.question.answerMediaUrl ?? screen.question.mediaUrl);
    // Stryker disable next-line ConditionalExpression: an empty last `default:` falls out of the switch to the same `undefined`
    default:
      return undefined;
  }
}

const BLANK: DisplayScreen = { kind: 'blank' };

type OnAirOf<Kind extends OnAirScreen['kind']> = Extract<
  OnAirScreen,
  { kind: Kind }
>;
type ScreenBuilders = {
  [Kind in OnAirScreen['kind']]: (
    input: DisplayScreenInput,
    onAir: OnAirOf<Kind>,
  ) => DisplayScreen;
};

function jokerPickScreen({ session }: DisplayScreenInput): DisplayScreen {
  const { rounds } = session.seededGame;
  return {
    kind: 'joker_pick',
    endsAt: session.jokerPickEndsAt,
    rounds: toJokerPickRounds(
      rounds,
      pickableRounds(rounds, session.openedQuestionIds),
    ),
    pickedTeamIds: session.teams
      .filter(({ teamId }) => session.jokers[teamId]?.source === 'chosen')
      .map(({ teamId }) => teamId),
  };
}

function roundTitleScreen(
  { session }: DisplayScreenInput,
  onAir: OnAirOf<'round_title'>,
): DisplayScreen {
  const round = session.seededGame.rounds[onAir.roundIndex];
  if (!round) return BLANK;
  return {
    kind: 'round_title',
    roundNumber: onAir.roundIndex + 1,
    title: round.title,
    category: round.category ?? '',
    author: round.author ?? '',
    note: getDisplayRoundNote(session, onAir),
  };
}

function breakIntroScreen(
  { session, snapshot }: DisplayScreenInput,
  onAir: OnAirOf<'break_intro'>,
): DisplayScreen {
  const { progress, quizStructure } = snapshot;
  return {
    kind: 'break_intro',
    roundNumber: onAir.roundIndex + 1,
    breakNumber: getBreakNumber(progress.roundIndex, quizStructure),
    isFinalBreak: isShowingLastBreak(progress, quizStructure),
    isFeedbackPromptShown: onAir.isFeedbackPromptShown,
    funFacts: session.seededGame.settings.funFactsEnabled
      ? describeFunFacts(session)
      : [],
    breakEndsAt: session.breakEndsAt,
  };
}

function leaderboardScreen({
  session,
  snapshot,
}: DisplayScreenInput): DisplayScreen {
  const { progress, quizStructure } = snapshot;
  return {
    kind: 'leaderboard',
    board: describeLeaderboardBoard(session),
    revealCount: session.leaderboardRevealCount,
    // The board shown once the quiz is over, or during its last break, crowns the winners.
    isFinal:
      progress.status === 'ended' ||
      isShowingLastBreak(progress, quizStructure),
  };
}

function showdownScreen({ snapshot }: DisplayScreenInput): DisplayScreen {
  return snapshot.activeShowdown
    ? {
        kind: 'showdown',
        showdown: snapshot.activeShowdown,
        step: snapshot.showdownRevealStep,
      }
    : BLANK;
}

const SCREEN_BUILDERS: ScreenBuilders = {
  lobby: () => ({ kind: 'lobby' }),
  rules: () => ({ kind: 'rules' }),
  round_overview: () => ({ kind: 'round_overview' }),
  join_overlay: () => ({ kind: 'join_overlay' }),
  joker_pick: jokerPickScreen,
  round_title: roundTitleScreen,
  question: ({ snapshot }) =>
    snapshot.currentQuestion
      ? { kind: 'question', question: snapshot.currentQuestion }
      : BLANK,
  locking: ({ snapshot }) =>
    snapshot.questionLockAt === null
      ? BLANK
      : { kind: 'locking', lockAt: snapshot.questionLockAt },
  break_intro: breakIntroScreen,
  break_review: breakReviewScreen,
  break_round_title: breakRoundTitleScreen,
  reveal_intro: revealIntroScreen,
  reveal: revealScreen,
  leaderboard: leaderboardScreen,
  ended: (_input, onAir) => ({
    kind: 'ended',
    isFeedbackPromptShown: onAir.isFeedbackPromptShown,
  }),
  showdown: showdownScreen,
};

/** Names the content each On-air screen draws; `blank` when a kind's content can't be found. */
export function describeDisplayScreen(
  input: DisplayScreenInput,
): DisplayScreen {
  const build = SCREEN_BUILDERS[input.onAir.kind] as (
    input: DisplayScreenInput,
    onAir: OnAirScreen,
  ) => DisplayScreen;
  return build(input, input.onAir);
}

function questionById<Question extends { id: number }>(
  questions: readonly Question[],
  id: number | null,
): Question | undefined {
  return questions.find((question) => question.id === id);
}

function breakReviewScreen(
  { snapshot }: DisplayScreenInput,
  onAir: OnAirOf<'break_review'>,
): DisplayScreen {
  const question = questionById(snapshot.blockQuestions, onAir.questionId);
  return question ? { kind: 'break_review', question } : BLANK;
}

function breakRoundTitleScreen(
  { session, snapshot }: DisplayScreenInput,
  onAir: OnAirOf<'break_round_title'>,
): DisplayScreen {
  const question = questionById(snapshot.blockQuestions, onAir.questionId);
  if (!question) return BLANK;
  return {
    kind: 'break_round_title',
    roundNumber: question.roundNumber,
    title: question.roundTitle,
    note: getDisplayRoundNote(session, onAir),
  };
}

function revealIntroScreen(
  { revealQuestions }: DisplayScreenInput,
  onAir: OnAirOf<'reveal_intro'>,
): DisplayScreen {
  const question = questionById(revealQuestions, onAir.questionId);
  if (!question) return BLANK;
  return {
    kind: 'reveal_intro',
    roundNumber: question.roundNumber,
    title: question.roundTitle,
  };
}

function revealScreen(
  { session, revealQuestions }: DisplayScreenInput,
  onAir: OnAirOf<'reveal'>,
): DisplayScreen {
  const question = questionById(revealQuestions, onAir.questionId);
  return question
    ? {
        kind: 'reveal',
        question,
        notes: getDisplayRevealNotes(session.seededGame.rounds, question),
      }
    : BLANK;
}
