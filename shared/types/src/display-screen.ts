import { describeFunFacts, type FunFact } from './fun-facts';
import { getBreakNumber, isShowingLastBreak } from './game-state-structure';
import { describeLeaderboardBoard } from './leaderboard-board';
import type { OnAirScreen } from './on-air-screen';
import type {
  BlockQuestionView,
  PlayersRevealQuestionView,
  QuestionView,
} from './question-views';
import type { LeaderboardBoard, StateSnapshotPayload } from './room-views';
import { getDisplayRoundNote } from './round-note';
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
  | { kind: 'reveal'; question: PlayersRevealQuestionView }
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

const BLANK: DisplayScreen = { kind: 'blank' };

/** Names the content each On-air screen draws; `blank` when a kind's content can't be found. */
export function describeDisplayScreen({
  session,
  onAir,
  snapshot,
  revealQuestions,
}: DisplayScreenInput): DisplayScreen {
  const { progress, quizStructure } = snapshot;
  const { rounds, settings } = session.seededGame;
  const questionById = <Question extends { id: number }>(
    questions: readonly Question[],
    id: number | null,
  ): Question | undefined => questions.find((question) => question.id === id);

  switch (onAir.kind) {
    case 'lobby':
    case 'rules':
    case 'round_overview':
    case 'join_overlay':
      return { kind: onAir.kind };
    case 'round_title': {
      const round = rounds[onAir.roundIndex];
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
    case 'question':
      return snapshot.currentQuestion
        ? { kind: 'question', question: snapshot.currentQuestion }
        : BLANK;
    case 'locking':
      return snapshot.questionLockAt === null
        ? BLANK
        : { kind: 'locking', lockAt: snapshot.questionLockAt };
    case 'break_intro':
      return {
        kind: 'break_intro',
        roundNumber: onAir.roundIndex + 1,
        breakNumber: getBreakNumber(progress.roundIndex, quizStructure),
        isFinalBreak: isShowingLastBreak(progress, quizStructure),
        isFeedbackPromptShown: onAir.isFeedbackPromptShown,
        funFacts: settings.funFactsEnabled ? describeFunFacts(session) : [],
        breakEndsAt: session.breakEndsAt,
      };
    case 'break_review': {
      const question = questionById(snapshot.blockQuestions, onAir.questionId);
      return question ? { kind: 'break_review', question } : BLANK;
    }
    case 'break_round_title': {
      const question = questionById(snapshot.blockQuestions, onAir.questionId);
      if (!question) return BLANK;
      return {
        kind: 'break_round_title',
        roundNumber: question.roundNumber,
        title: question.roundTitle,
        note: getDisplayRoundNote(session, onAir),
      };
    }
    case 'reveal_intro': {
      const question = questionById(revealQuestions, onAir.questionId);
      if (!question) return BLANK;
      return {
        kind: 'reveal_intro',
        roundNumber: question.roundNumber,
        title: question.roundTitle,
      };
    }
    case 'reveal': {
      const question = questionById(revealQuestions, onAir.questionId);
      return question ? { kind: 'reveal', question } : BLANK;
    }
    case 'leaderboard':
      return {
        kind: 'leaderboard',
        board: describeLeaderboardBoard(session),
        revealCount: session.leaderboardRevealCount,
        // The board shown once the quiz is over, or during its last break, crowns the winners.
        isFinal:
          progress.status === 'ended' ||
          isShowingLastBreak(progress, quizStructure),
      };
    case 'ended':
      return {
        kind: 'ended',
        isFeedbackPromptShown: onAir.isFeedbackPromptShown,
      };
    case 'showdown':
      return snapshot.activeShowdown
        ? {
            kind: 'showdown',
            showdown: snapshot.activeShowdown,
            step: snapshot.showdownRevealStep,
          }
        : BLANK;
  }
}
