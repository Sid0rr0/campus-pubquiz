import {
  getBlockStartRoundIndex,
  getRoundAndQuestionForBlockPosition,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type QuestionPosition,
  type QuestionView,
  type RevealQuestionView,
} from '@campus-pubquiz/types';
import { toBlockQuestionView, toQuestionView } from '@/game/game-state-views';
import { getGameContext, type SessionState } from '@/game/session-state';

/** Pairs a round's questions with their round-relative labels and (for closest_guess) cached summary — shared by getBlockSeededQuestions and getPastRevealedQuestions. */
function toRevealQuestionViews(
  questions: RevealQuestionView[],
  roundNumber: number,
  roundTitle: string,
  session: SessionState,
): BlockRevealQuestionView[] {
  return questions.map((question, questionOffset) => ({
    ...question,
    ...(question.type === 'closest_guess'
      ? {
          closestGuess: session.closestGuessSummaries[question.id] ?? {
            hasSubmissions: false,
            closestGuesses: [],
          },
        }
      : {}),
    roundNumber,
    questionNumberInRound: questionOffset + 1,
    roundTitle,
  }));
}

export function getCurrentRoundTitle(session: SessionState): string {
  return session.seededGame.rounds[session.progress.roundIndex]?.title ?? '';
}

// Stays populated through 'locking' (not just 'question_open') so answers
// remain submittable during the countdown — display simply doesn't render
// it during 'locking', but /play keeps showing the last question.
export function getCurrentQuestion(session: SessionState): QuestionView | null {
  if (
    session.progress.status !== 'question_open' &&
    session.progress.status !== 'locking'
  ) {
    return null;
  }
  const question =
    session.seededGame.rounds[session.progress.roundIndex]?.questions[
      session.progress.questionIndex
    ];
  return question ? toQuestionView(question) : null;
}

/**
 * The block's questions (with their correct answers) revealed so far:
 * everything up to the furthest question ever opened (not just the one
 * currently on screen — PREVIOUS can walk the display backward without
 * re-hiding questions already shown) while the block is open (or locking),
 * during round_intro (Previous can step back into a round's intro card
 * without hiding that round's already-opened questions — furthestOpenIndex
 * naturally excludes anything from a round_intro reached by ADVANCE into a
 * fresh round, since it still points at the previous round/block), the
 * whole just-locked block during break/reveal, or — once the quiz has
 * ended — the last block ADVANCE walked through, so the admin can still
 * review/grade its answers instead of the panel vanishing the moment
 * reveal finishes. Empty otherwise.
 */
export function getBlockSeededQuestions(
  session: SessionState,
): BlockRevealQuestionView[] {
  const { status, roundIndex, questionIndex, furthestOpenIndex } =
    session.progress;
  if (
    status !== 'question_open' &&
    status !== 'locking' &&
    status !== 'round_intro' &&
    status !== 'break_intro' &&
    status !== 'break' &&
    status !== 'break_round_intro' &&
    status !== 'reveal_intro' &&
    status !== 'reveal' &&
    status !== 'ended'
  ) {
    return [];
  }

  const context = getGameContext(session);
  const rounds = session.seededGame.rounds;
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  const isOpenPhase =
    status === 'question_open' ||
    status === 'locking' ||
    status === 'round_intro';
  const revealBoundary = isOpenPhase
    ? getRoundAndQuestionForBlockPosition(
        blockStart,
        furthestOpenIndex,
        context,
      )
    : { roundIndex, questionIndex };

  return rounds
    .slice(blockStart, revealBoundary.roundIndex + 1)
    .flatMap((round, offset) => {
      const currentRoundIndex = blockStart + offset;
      const isCurrentRound = currentRoundIndex === revealBoundary.roundIndex;
      const isPartiallyRevealed = isOpenPhase && isCurrentRound;
      const questions = isPartiallyRevealed
        ? round.questions.slice(0, revealBoundary.questionIndex + 1)
        : round.questions;
      return toRevealQuestionViews(
        questions,
        currentRoundIndex + 1,
        round.title,
        session,
      );
    });
}

/**
 * Every question from blocks that finished before the current one — every
 * round strictly before the current block's start. A block can only be left
 * behind once its own break+reveal has completed (see getNextGameState), so
 * these are always safe to return with their correct answers regardless of
 * the current status. Gives a (re)connecting client (a phone that slept
 * through a round, a page refresh) the full answer history across every
 * already-finished round in one shot, rather than just the current block.
 */
export function getPastRevealedQuestions(
  session: SessionState,
): BlockRevealQuestionView[] {
  const context = getGameContext(session);
  const blockStart = getBlockStartRoundIndex(
    session.progress.roundIndex,
    context,
  );
  return session.seededGame.rounds
    .slice(0, blockStart)
    .flatMap((round, index) =>
      toRevealQuestionViews(round.questions, index + 1, round.title, session),
    );
}

/**
 * Questions open for (re-)answering while a question is open, or the whole
 * just-locked block during break/reveal so the admin can browse answers
 * while grading. Answer-free: this is broadcast to every connected phone
 * and the big screen.
 */
export function getBlockQuestions(session: SessionState): BlockQuestionView[] {
  return getBlockSeededQuestions(session).map(toBlockQuestionView);
}

/**
 * Positions of the furthest-opened round's remaining questions, not open
 * yet — the whole round's shape, so the picker doesn't grow as questions
 * unlock. Based on furthestOpenIndex rather than the literal display
 * position, so stepping the display back with PREVIOUS doesn't re-mark
 * already-opened questions as upcoming. Round boundaries within a block
 * only advance through a round_intro screen, so these can only ever be
 * later in the furthest-opened round.
 *
 * During round_intro, furthestOpenIndex may still point at an earlier
 * round (a fresh round_intro reached by ADVANCE, nothing open in the new
 * round yet) — in that case the whole round about to start is upcoming,
 * not whatever's left of the round furthestOpenIndex still points at.
 */
export function getUpcomingQuestionPositions(
  session: SessionState,
): QuestionPosition[] {
  const { status, roundIndex, furthestOpenIndex } = session.progress;
  if (
    status !== 'question_open' &&
    status !== 'locking' &&
    status !== 'round_intro'
  ) {
    return [];
  }
  const context = getGameContext(session);
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  const furthest = getRoundAndQuestionForBlockPosition(
    blockStart,
    furthestOpenIndex,
    context,
  );
  const target =
    status === 'round_intro' && furthest.roundIndex < roundIndex
      ? { roundIndex, questionIndex: -1 }
      : furthest;
  const round = session.seededGame.rounds[target.roundIndex];
  if (!round) {
    return [];
  }
  const positions: QuestionPosition[] = [];
  for (
    let index = target.questionIndex + 1;
    index < round.questions.length;
    index += 1
  ) {
    positions.push({
      roundNumber: target.roundIndex + 1,
      questionNumberInRound: index + 1,
    });
  }
  return positions;
}

/**
 * The just-finished block's questions with correct answers, shown once
 * grading is done. Populated from the first reveal round intro card
 * onward (not just 'reveal' itself) so the display can read the upcoming
 * question's round title before its answer is actually shown.
 */
export function getRevealQuestions(
  session: SessionState,
): BlockRevealQuestionView[] {
  if (
    session.progress.status !== 'reveal_intro' &&
    session.progress.status !== 'reveal'
  ) {
    return [];
  }
  return getBlockSeededQuestions(session);
}

export function getAnsweredTeamIds(session: SessionState): number[] {
  const currentQuestion = getCurrentQuestion(session);
  if (!currentQuestion) {
    return [];
  }
  return session.answeredTeamIdsByQuestion[currentQuestion.id] ?? [];
}
