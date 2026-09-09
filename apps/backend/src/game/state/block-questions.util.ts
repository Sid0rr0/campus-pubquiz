import {
  getBlockEndRoundIndex,
  getBlockStartRoundIndex,
  getRoundAndQuestionForBlockPosition,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type QuestionView,
  type RevealQuestionView,
  type UpcomingQuestionPosition,
} from '@campus-pubquiz/types';
import {
  toBlockQuestionView,
  toQuestionView,
} from '@/game/state/game-state-views';
import { getGameContext, type SessionState } from '@/game/state/session-state';

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
 * The (roundIndex, questionIndex) of the furthest question ever opened in
 * the current block — shared by getUpcomingQuestionPositions and
 * buildPresenterContext's next-question preview.
 *
 * During round_intro, furthestOpenIndex may still point at an earlier
 * round (a fresh round_intro reached by ADVANCE, nothing open in the new
 * round yet) — in that case the whole round about to start is the target,
 * not whatever's left of the round furthestOpenIndex still points at.
 */
export function getFurthestOpenPosition(session: SessionState): {
  roundIndex: number;
  questionIndex: number;
} {
  const { status, roundIndex, furthestOpenIndex } = session.progress;
  const context = getGameContext(session);
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  const furthest = getRoundAndQuestionForBlockPosition(
    blockStart,
    furthestOpenIndex,
    context,
  );
  return status === 'round_intro' && furthest.roundIndex < roundIndex
    ? { roundIndex, questionIndex: -1 }
    : furthest;
}

/**
 * Positions (and round titles) of the rest of the current block's
 * questions, not open yet — the whole remaining block shape, spanning every
 * round from the furthest-opened one through the round that ends the block
 * (breakAfter), so the picker doesn't grow as questions or rounds unlock.
 * Based on furthestOpenIndex rather than the literal display position, so
 * stepping the display back with PREVIOUS doesn't re-mark already-opened
 * questions as upcoming.
 */
export function getUpcomingQuestionPositions(
  session: SessionState,
): UpcomingQuestionPosition[] {
  const { status } = session.progress;
  if (
    status !== 'question_open' &&
    status !== 'locking' &&
    status !== 'round_intro'
  ) {
    return [];
  }
  const target = getFurthestOpenPosition(session);
  const rounds = session.seededGame.rounds;
  if (!rounds[target.roundIndex]) {
    return [];
  }
  const context = getGameContext(session);
  const blockEnd = getBlockEndRoundIndex(target.roundIndex, context);

  const positions: UpcomingQuestionPosition[] = [];
  for (
    let roundIndex = target.roundIndex;
    roundIndex <= blockEnd;
    roundIndex += 1
  ) {
    const round = rounds[roundIndex];
    const startQuestionIndex =
      roundIndex === target.roundIndex ? target.questionIndex + 1 : 0;
    for (
      let questionIndex = startQuestionIndex;
      questionIndex < round.questions.length;
      questionIndex += 1
    ) {
      positions.push({
        roundNumber: roundIndex + 1,
        questionNumberInRound: questionIndex + 1,
        roundTitle: round.title,
      });
    }
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
