import {
  KAHOOT_LEADERBOARD_TOP_N,
  getBreakNumber,
  getNextGameState,
  getQuizStructureSummary,
  type GameProgress,
  type ScreenPreview,
} from '@campus-pubquiz/types';
import { getBlockSeededQuestions } from '@/game/state/block-questions.util';
import { tryStepClosestGuessReveal } from '@/game/state/closest-guess-reveal.util';
import { getGameContext, type SessionState } from '@/game/state/session-state';
import { tryStepShowdownReveal } from '@/game/state/showdown-reveal.util';

function describeBlockReviewScreen(
  session: SessionState,
  breakNumber: number,
): ScreenPreview {
  const { progress } = session;
  const question = getBlockSeededQuestions(session)[progress.revealIndex];
  if (progress.status === 'break_round_intro' && question) {
    return {
      heading: `Break · Round ${question.roundNumber} title`,
      body: question.roundTitle,
    };
  }
  if (progress.status === 'break' && question) {
    return {
      heading: `Break · Reviewing R${question.roundNumber} Q${question.questionNumberInRound}`,
      body: question.prompt,
    };
  }
  return {
    heading: `Break ${breakNumber}`,
    body: `After round ${progress.roundIndex + 1}`,
  };
}

function describeRevealScreen(session: SessionState): ScreenPreview {
  const { progress } = session;
  const question = getBlockSeededQuestions(session)[progress.revealIndex];
  if (!question) return { heading: 'Revealing answers' };
  if (progress.status === 'reveal_intro') {
    return {
      heading: `Revealing · Round ${question.roundNumber} title`,
      body: question.roundTitle,
    };
  }
  return {
    heading: `Revealing R${question.roundNumber} Q${question.questionNumberInRound}`,
    body: `${question.prompt} — Answer: ${question.answer}`,
  };
}

/** Describes the screen /display renders for `session`'s progress — mirrors display/page.tsx's per-status branches. */
export function describeScreen(session: SessionState): ScreenPreview {
  const { progress, seededGame } = session;
  const round = seededGame.rounds[progress.roundIndex];

  if (progress.isLeaderboardVisible) {
    return progress.status === 'ended'
      ? { heading: 'Leaderboard', body: 'Final standings' }
      : { heading: 'Leaderboard' };
  }

  switch (progress.status) {
    case 'lobby':
      return { heading: 'Lobby', body: 'Teams joining' };
    case 'rules':
      return { heading: 'Rules' };
    case 'round_overview':
      return {
        heading: 'Round overview',
        body: seededGame.rounds.map((r) => r.title).join(' · '),
      };
    case 'round_intro':
      return {
        heading: `Round ${progress.roundIndex + 1} title`,
        body: round?.title,
      };
    case 'question_open': {
      const question = round?.questions[progress.questionIndex];
      return {
        heading: `R${progress.roundIndex + 1} Q${progress.questionIndex + 1}`,
        ...(question ? { question } : {}),
      };
    }
    case 'locking':
      return {
        heading: 'Locking answers',
        body: `R${progress.roundIndex + 1} Q${progress.questionIndex + 1} countdown`,
      };
    case 'break_intro':
    case 'break':
    case 'break_round_intro':
      return describeBlockReviewScreen(
        session,
        getBreakNumber(
          progress.roundIndex,
          getQuizStructureSummary(getGameContext(session)),
        ),
      );
    case 'reveal_intro':
    case 'reveal':
      return describeRevealScreen(session);
    case 'ended':
      return session.activeShowdownRound
        ? { heading: 'Showdown' }
        : { heading: 'Quiz complete!' };
  }
}

function getLeaderboardTeamCount(session: SessionState): number {
  const isKahoot =
    session.seededGame.rounds[session.progress.roundIndex]?.kahootMode ?? false;
  return isKahoot
    ? Math.min(KAHOOT_LEADERBOARD_TOP_N, session.leaderboard.length)
    : session.leaderboard.length;
}

/** The progress plain ADVANCE (START_QUIZ from the lobby) moves to, or null when it's illegal here. */
function getAdvancedProgress(session: SessionState): GameProgress | null {
  const action = session.progress.status === 'lobby' ? 'START_QUIZ' : 'ADVANCE';
  try {
    return getNextGameState(session.progress, action, getGameContext(session));
  } catch {
    return null;
  }
}

function tryPreviewShowdownStep(session: SessionState): ScreenPreview | null {
  try {
    const stepped = tryStepShowdownReveal(session, 'ADVANCE');
    if (
      !stepped ||
      stepped.session.showdownRevealStep === session.showdownRevealStep
    ) {
      return null;
    }
    return {
      heading: 'Showdown',
      body: `Reveal step ${stepped.session.showdownRevealStep}`,
    };
  } catch {
    return { heading: 'Showdown', body: 'Waiting for every guess' };
  }
}

/**
 * The screen /display will show after /remote's Advance slot is pressed —
 * mirrors NavigationButtons (reveal the next leaderboard team, then hide
 * the board) and GameStateService.applyAction's intercepts (showdown and
 * closest_guess sub-steps) before falling through to the state machine.
 */
export function describeNextScreen(
  session: SessionState,
): ScreenPreview | null {
  const { progress } = session;

  if (progress.isLeaderboardVisible) {
    const teamCount = getLeaderboardTeamCount(session);
    if (session.leaderboardRevealCount < teamCount) {
      return {
        heading: 'Leaderboard',
        body: `Next team (${session.leaderboardRevealCount + 1} of ${teamCount})`,
      };
    }
    return describeScreen({
      ...session,
      progress: { ...progress, isLeaderboardVisible: false },
    });
  }

  if (progress.status === 'ended') {
    return session.activeShowdownRound ? tryPreviewShowdownStep(session) : null;
  }

  if (
    progress.status === 'reveal' &&
    tryStepClosestGuessReveal(session, 'ADVANCE')
  ) {
    return { ...describeScreen(session), body: 'Next closest-guess step' };
  }

  const next = getAdvancedProgress(session);
  return next ? describeScreen({ ...session, progress: next }) : null;
}
