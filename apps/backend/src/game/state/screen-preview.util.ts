import {
  getBlockSeededQuestions,
  getBreakNumber,
  getCurrentQuestion,
  getGameContext,
  getQuizStructureSummary,
  nextPressAction,
  type OnAirScreen,
  type PresenterContextPayload,
  projectScreen,
  type ScreenPreview,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';
import {
  previewMove,
  type PreviewedMove,
} from '@/game/state/commit-a-move.service';

function describeBreakIntro(session: SessionState): ScreenPreview {
  const { progress } = session;
  const breakNumber = getBreakNumber(
    progress.roundIndex,
    getQuizStructureSummary(getGameContext(session)),
  );
  return {
    heading: `Break ${breakNumber}`,
    body: `After round ${progress.roundIndex + 1}`,
  };
}

/** The just-locked block's question the named screen is about, with its correct answer. */
function findBlockQuestion(session: SessionState, questionId: number | null) {
  return getBlockSeededQuestions(session).find(
    (question) => question.id === questionId,
  );
}

/** Words for the screen the projection names as on air — the text is here, what is on air is decided by the projection alone. */
function describeOnAirScreenText(
  session: SessionState,
  screen: OnAirScreen,
): ScreenPreview {
  const { seededGame } = session;
  switch (screen.kind) {
    case 'lobby':
      return { heading: 'Lobby', body: 'Teams joining' };
    case 'rules':
      return { heading: 'Rules' };
    case 'round_overview':
      return {
        heading: 'Round overview',
        body: seededGame.rounds.map((round) => round.title).join(' · '),
      };
    case 'round_title':
      return {
        heading: `Round ${screen.roundIndex + 1} title`,
        body: seededGame.rounds[screen.roundIndex]?.title,
      };
    case 'question': {
      const question =
        seededGame.rounds[screen.roundIndex]?.questions[screen.questionIndex];
      return {
        heading: `R${screen.roundIndex + 1} Q${screen.questionIndex + 1}`,
        ...(question ? { question } : {}),
      };
    }
    case 'locking':
      return {
        heading: 'Locking answers',
        body: `R${screen.roundIndex + 1} Q${screen.questionIndex + 1} countdown`,
      };
    case 'break_intro':
      return describeBreakIntro(session);
    case 'break_review': {
      const question = findBlockQuestion(session, screen.questionId);
      return question
        ? {
            heading: `Break · Reviewing R${question.roundNumber} Q${question.questionNumberInRound}`,
            body: question.prompt,
          }
        : describeBreakIntro(session);
    }
    case 'break_round_title': {
      const question = findBlockQuestion(session, screen.questionId);
      return question
        ? {
            heading: `Break · Round ${question.roundNumber} title`,
            body: question.roundTitle,
          }
        : describeBreakIntro(session);
    }
    case 'reveal_intro': {
      const question = findBlockQuestion(session, screen.questionId);
      return question
        ? {
            heading: `Revealing · Round ${question.roundNumber} title`,
            body: question.roundTitle,
          }
        : { heading: 'Revealing answers' };
    }
    case 'reveal': {
      const question = findBlockQuestion(session, screen.questionId);
      return question
        ? {
            heading: `Revealing R${question.roundNumber} Q${question.questionNumberInRound}`,
            body: `${question.prompt} — Answer: ${question.answer}`,
          }
        : { heading: 'Revealing answers' };
    }
    case 'leaderboard':
      return session.progress.status === 'ended'
        ? { heading: 'Leaderboard', body: 'Final standings' }
        : { heading: 'Leaderboard' };
    case 'join_overlay':
      return { heading: 'Join overlay' };
    case 'ended':
      return { heading: 'Quiz complete!' };
    case 'showdown':
      return { heading: 'Showdown' };
  }
}

/** Describes the screen /display renders for `session`'s progress — the words for the screen the Screen projection names as on air. */
export function describeScreen(session: SessionState): ScreenPreview {
  const { onAirScreen } = projectScreen(session, SOCKET_ROOMS.ADMIN);
  return describeOnAirScreenText(session, onAirScreen);
}

/** Words for what a dry-run commit of the next press leaves on air; waiting and blocked steps move no screen and are described from the step. */
function describePreviewedMove(
  session: SessionState,
  { step, session: after }: PreviewedMove,
): ScreenPreview | null {
  switch (step.kind) {
    case 'showdown_step':
      return after.showdownRevealStep === session.showdownRevealStep
        ? null
        : {
            heading: 'Showdown',
            body: `Reveal step ${after.showdownRevealStep}`,
          };
    case 'showdown_waiting':
      return { heading: 'Showdown', body: 'Waiting for every guess' };
    case 'grading_pending':
      return { heading: 'Grading', body: 'Waiting for grading' };
    case 'leaderboard_reveal':
      return {
        heading: 'Leaderboard',
        body: `Next place (${step.place} of ${step.placeCount})`,
      };
    case 'closest_guess_step':
      return { ...describeScreen(session), body: 'Next closest-guess step' };
    case 'join_overlay_hide':
      return { ...describeScreen(after), body: 'Hides the join overlay' };
    case 'leaderboard_hide':
    case 'transition':
      return describeScreen(after);
    case 'blocked':
      return null;
  }
}

/** The screen /display will show after /remote's Advance slot is pressed: the next press, as a dry-run commit leaves it. */
export function describeNextScreen(
  session: SessionState,
): ScreenPreview | null {
  return describePreviewedMove(
    session,
    previewMove(session, nextPressAction(session)),
  );
}

/** The note of the round whose intro or break round intro is on air; null on every other screen (the reveal intro included). */
function roundNoteOnAir(
  session: SessionState,
  screen: OnAirScreen,
): string | null {
  if (screen.kind !== 'round_title' && screen.kind !== 'break_round_title') {
    return null;
  }
  if (screen.roundIndex === null) return null;
  return session.seededGame.rounds[screen.roundIndex]?.note ?? null;
}

/**
 * Host notes for the open question + what /display shows now and after the
 * next Advance, for the /remote presenter view alone. Callers MUST only forward this over an
 * admin-room-only channel (PRESENTER_CONTEXT_UPDATED) — never through the
 * broadcast snapshot.
 */
export function buildPresenterContext(
  session: SessionState,
): PresenterContextPayload {
  const currentQuestion = getCurrentQuestion(session);
  const currentRound = session.seededGame.rounds[session.progress.roundIndex];
  const currentQuestionNotes =
    currentQuestion && currentRound
      ? (currentRound.questionNotesById?.[currentQuestion.id] ?? null)
      : null;

  const { onAirScreen } = projectScreen(session, SOCKET_ROOMS.ADMIN);

  return {
    currentQuestionNotes,
    currentRoundNote: roundNoteOnAir(session, onAirScreen),
    currentScreen: describeOnAirScreenText(session, onAirScreen),
    nextScreen: describeNextScreen(session),
  };
}
