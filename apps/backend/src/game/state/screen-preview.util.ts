import {
  getBlockSeededQuestions,
  getBreakNumber,
  getGameContext,
  getQuizStructureSummary,
  getHostOnlyText,
  isBreakExit,
  nextPressAction,
  type OnAirScreen,
  type PresenterContextPayload,
  type PreviewedMove,
  previewMove,
  projectScreen,
  type ScreenPreview,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';

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

type OnAirOf<Kind extends OnAirScreen['kind']> = Extract<
  OnAirScreen,
  { kind: Kind }
>;
type ScreenTexts = {
  [Kind in OnAirScreen['kind']]: (
    session: SessionState,
    screen: OnAirOf<Kind>,
  ) => ScreenPreview;
};

function questionText(
  { seededGame }: SessionState,
  screen: OnAirOf<'question'>,
): ScreenPreview {
  const question =
    seededGame.rounds[screen.roundIndex]?.questions[screen.questionIndex];
  return {
    heading: `R${screen.roundIndex + 1} Q${screen.questionIndex + 1}`,
    // Every clue, unshown ones included: this preview only reaches the admin room (the presenter remote).
    ...(question ? { question } : {}),
  };
}

function breakReviewText(
  session: SessionState,
  screen: OnAirOf<'break_review'>,
): ScreenPreview {
  const question = findBlockQuestion(session, screen.questionId);
  return question
    ? {
        heading: `Break · Reviewing R${question.roundNumber} Q${question.questionNumberInRound}`,
        body: question.prompt,
      }
    : describeBreakIntro(session);
}

function breakRoundTitleText(
  session: SessionState,
  screen: OnAirOf<'break_round_title'>,
): ScreenPreview {
  const question = findBlockQuestion(session, screen.questionId);
  return question
    ? {
        heading: `Break · Round ${question.roundNumber} title`,
        body: question.roundTitle,
      }
    : describeBreakIntro(session);
}

/** How each answer-airing screen kind is previewed: the word in its heading, and the heading when no question is found. */
const REVEAL_WORDS = {
  answers_intro: { word: 'Answers', bare: 'Answers' },
  answers: { word: 'Answers', bare: 'Answers' },
  reveal_intro: { word: 'Revealing', bare: 'Revealing answers' },
  reveal: { word: 'Revealing', bare: 'Revealing answers' },
} as const;

function revealIntroText(
  session: SessionState,
  screen: OnAirOf<'reveal_intro' | 'answers_intro'>,
): ScreenPreview {
  const { word, bare } = REVEAL_WORDS[screen.kind];
  const question = findBlockQuestion(session, screen.questionId);
  return question
    ? {
        heading: `${word} · Round ${question.roundNumber} title`,
        body: question.roundTitle,
      }
    : { heading: bare };
}

function revealText(
  session: SessionState,
  screen: OnAirOf<'reveal' | 'answers'>,
): ScreenPreview {
  const { word, bare } = REVEAL_WORDS[screen.kind];
  const question = findBlockQuestion(session, screen.questionId);
  return question
    ? {
        heading: `${word} R${question.roundNumber} Q${question.questionNumberInRound}`,
        body: `${question.prompt} — Answer: ${question.answer}`,
      }
    : { heading: bare };
}

const SCREEN_TEXTS: ScreenTexts = {
  lobby: () => ({ heading: 'Lobby', body: 'Teams joining' }),
  rules: () => ({ heading: 'Rules' }),
  round_overview: ({ seededGame }) => ({
    heading: 'Round overview',
    body: seededGame.rounds.map((round) => round.title).join(' · '),
  }),
  joker_pick: () => ({
    heading: 'Joker pick',
    body: 'Teams choose their joker round',
  }),
  round_title: ({ seededGame }, screen) => ({
    heading: `Round ${screen.roundIndex + 1} title`,
    body: seededGame.rounds[screen.roundIndex]?.title,
  }),
  question: questionText,
  locking: (_session, screen) => ({
    heading: 'Locking answers',
    body: `R${screen.roundIndex + 1} Q${screen.questionIndex + 1} countdown`,
  }),
  break_intro: describeBreakIntro,
  break_review: breakReviewText,
  break_round_title: breakRoundTitleText,
  answers_intro: revealIntroText,
  answers: revealText,
  reveal_intro: revealIntroText,
  reveal: revealText,
  leaderboard: (session) =>
    session.progress.status === 'ended'
      ? { heading: 'Leaderboard', body: 'Final standings' }
      : { heading: 'Leaderboard' },
  join_overlay: () => ({ heading: 'Join overlay' }),
  ended: () => ({ heading: 'Quiz complete!' }),
  showdown: () => ({ heading: 'Showdown' }),
};

/** Words for the screen the projection names as on air — the text is here, what is on air is decided by the projection alone. */
function describeOnAirScreenText(
  session: SessionState,
  screen: OnAirScreen,
): ScreenPreview {
  const describe = SCREEN_TEXTS[screen.kind] as (
    session: SessionState,
    screen: OnAirScreen,
  ) => ScreenPreview;
  return describe(session, screen);
}

/** Describes the screen /display renders for `session`'s progress — the words for the screen the Screen projection names as on air. */
export function describeScreen(session: SessionState): ScreenPreview {
  const { onAirScreen } = projectScreen(session, SOCKET_ROOMS.ADMIN);
  return describeOnAirScreenText(session, onAirScreen);
}

/** The words for a press moving to `after`; leaving the break for the Early answer reveal's results says what follows the board. */
function describeTransition(
  session: SessionState,
  after: SessionState,
): ScreenPreview {
  const { status, roundIndex } = after.progress;
  if (
    !isBreakExit(session.progress.status, status) ||
    status === 'reveal_intro'
  ) {
    return describeScreen(after);
  }
  return {
    heading: 'Leaderboard',
    body:
      status === 'ended'
        ? 'Results, then final standings'
        : `Results, then Round ${roundIndex + 1} intro`,
  };
}

/** Words for what a dry-run commit of the next press leaves on air; waiting and blocked steps move no screen and are described from the step. */
function describePreviewedMove(
  session: SessionState,
  { step, session: after }: PreviewedMove,
): ScreenPreview | null {
  switch (step.kind) {
    case 'showdown_waiting':
      return { heading: 'Showdown', body: 'Waiting for every guess' };
    case 'grading_pending':
      return { heading: 'Grading', body: 'Waiting for grading' };
    case 'leaderboard_reveal':
      return {
        heading: 'Leaderboard',
        body: `Next place (${step.place} of ${step.placeCount})`,
      };
    case 'reveal_step':
      return describeRevealStep(session, step.reveal, after);
    case 'join_overlay_hide':
      return { ...describeScreen(after), body: 'Hides the join overlay' };
    case 'transition':
      return describeTransition(session, after);
    case 'leaderboard_hide':
      return describeScreen(after);
    case 'blocked':
      return null;
  }
}

function describeRevealStep(
  session: SessionState,
  reveal: Extract<PreviewedMove['step'], { kind: 'reveal_step' }>['reveal'],
  after: SessionState,
): ScreenPreview | null {
  if (reveal === 'closest_guess') {
    return { ...describeScreen(session), body: 'Next closest-guess step' };
  }
  if (reveal === 'clues') {
    return after.revealStep === session.revealStep
      ? null
      : {
          ...describeScreen(session),
          body: `Clue ${after.revealStep + 1} on the big screen`,
        };
  }
  return after.revealStep === session.revealStep
    ? null
    : { heading: 'Showdown', body: `Reveal step ${after.revealStep}` };
}

/** The screen /display will show after /remote's Advance slot is pressed: the next press, as a dry-run commit leaves it. */
export function describeNextScreen(
  session: SessionState,
): ScreenPreview | null {
  return describePreviewedMove(
    session,
    previewMove(session, nextPressAction(session), Date.now()),
  );
}

/**
 * Host notes for the question on the big screen + what /display shows now and after the
 * next Advance, for the /remote presenter view alone. Callers MUST only forward this over an
 * admin-room-only channel (PRESENTER_CONTEXT_UPDATED) — never through the
 * broadcast snapshot.
 */
export function buildPresenterContext(
  session: SessionState,
): PresenterContextPayload {
  const { onAirScreen } = projectScreen(session, SOCKET_ROOMS.ADMIN);
  const { roundNote, questionNotes } = getHostOnlyText(
    session.seededGame.rounds,
    onAirScreen,
  );

  return {
    currentQuestionNotes: questionNotes || null,
    currentRoundNote: roundNote || null,
    currentScreen: describeOnAirScreenText(session, onAirScreen),
    nextScreen: describeNextScreen(session),
  };
}
