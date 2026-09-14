import {
  getBlockEndPosition,
  getBlockPositionForQuestion,
  getBlockStartPosition,
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

interface RoundQuestionEntry {
  question: RevealQuestionView;
  questionIndexInRound: number;
}

/** Pairs a round's questions with their round-relative labels and (for closest_guess) cached summary — shared by getBlockSeededQuestions and getPastRevealedQuestions. `questionIndexInRound` is each entry's actual index within its round (not necessarily starting at 0 — a kahootMode block can start mid-round), so questionNumberInRound stays correct even for a partial run. */
function toRevealQuestionViews(
  entries: RoundQuestionEntry[],
  roundNumber: number,
  roundTitle: string,
  session: SessionState,
): BlockRevealQuestionView[] {
  return entries.map(({ question, questionIndexInRound }) => ({
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
    questionNumberInRound: questionIndexInRound + 1,
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
  const blockStart = getBlockStartPosition(roundIndex, questionIndex, context);
  const isOpenPhase =
    status === 'question_open' ||
    status === 'locking' ||
    status === 'round_intro';
  const revealBoundaryPosition = isOpenPhase
    ? furthestOpenIndex
    : getBlockPositionForQuestion(roundIndex, questionIndex, context);

  // furthestOpenIndex === -1: a fresh block, nothing opened yet.
  if (revealBoundaryPosition < 0) return [];

  const targets = Array.from(
    { length: revealBoundaryPosition + 1 },
    (_, position) =>
      getRoundAndQuestionForBlockPosition(blockStart, position, context),
  );

  const groups = targets.reduce<
    { roundIndex: number; entries: RoundQuestionEntry[] }[]
  >((acc, target) => {
    const entry: RoundQuestionEntry = {
      question: rounds[target.roundIndex].questions[target.questionIndex],
      questionIndexInRound: target.questionIndex,
    };
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.roundIndex === target.roundIndex) {
      return [
        ...acc.slice(0, -1),
        {
          roundIndex: lastGroup.roundIndex,
          entries: [...lastGroup.entries, entry],
        },
      ];
    }
    return [...acc, { roundIndex: target.roundIndex, entries: [entry] }];
  }, []);

  return groups.flatMap((group) =>
    toRevealQuestionViews(
      group.entries,
      group.roundIndex + 1,
      rounds[group.roundIndex].title,
      session,
    ),
  );
}

/**
 * Every question from blocks that finished before the current one: every
 * round strictly before the current block's round, plus — when the current
 * block starts mid-round (a kahootMode round's earlier questions, each its
 * own already-finished block) — that round's questions before the block's
 * start. A block can only be left behind once its own break+reveal has
 * completed (see getNextGameState), so these are always safe to return with
 * their correct answers regardless of the current status. Gives a
 * (re)connecting client (a phone that slept through a round, a page refresh)
 * the full answer history across every already-finished question, not just
 * the current block.
 */
export function getPastRevealedQuestions(
  session: SessionState,
): BlockRevealQuestionView[] {
  const context = getGameContext(session);
  const { roundIndex, questionIndex } = session.progress;
  const blockStart = getBlockStartPosition(roundIndex, questionIndex, context);
  const rounds = session.seededGame.rounds;

  const views = rounds.slice(0, blockStart.roundIndex).flatMap((round, index) =>
    toRevealQuestionViews(
      round.questions.map((question, i) => ({
        question,
        questionIndexInRound: i,
      })),
      index + 1,
      round.title,
      session,
    ),
  );

  if (blockStart.questionIndex === 0) return views;

  const round = rounds[blockStart.roundIndex];
  const partialRoundViews = toRevealQuestionViews(
    round.questions
      .slice(0, blockStart.questionIndex)
      .map((question, i) => ({ question, questionIndexInRound: i })),
    blockStart.roundIndex + 1,
    round.title,
    session,
  );

  return [...views, ...partialRoundViews];
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
  const { status, roundIndex, questionIndex, furthestOpenIndex } =
    session.progress;
  const context = getGameContext(session);
  const blockStart = getBlockStartPosition(roundIndex, questionIndex, context);
  // -1 means no question in the current block has ever been opened —
  // handled directly rather than through getRoundAndQuestionForBlockPosition
  // (which only walks forward from blockStart), preserving the sentinel
  // "nothing opened yet in this round" shape.
  if (furthestOpenIndex < 0) {
    return { roundIndex: blockStart.roundIndex, questionIndex: -1 };
  }
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
 * round from the furthest-opened one through the block's last question, so
 * the picker doesn't grow as questions or rounds unlock. Based on
 * furthestOpenIndex rather than the literal display position, so stepping
 * the display back with PREVIOUS doesn't re-mark already-opened questions
 * as upcoming. Naturally empty for a kahootMode round, whose block is
 * always just the current question.
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
  const blockEnd = getBlockEndPosition(
    target.roundIndex,
    target.questionIndex,
    context,
  );

  const positions: UpcomingQuestionPosition[] = [];
  for (
    let roundIndex = target.roundIndex;
    roundIndex <= blockEnd.roundIndex;
    roundIndex += 1
  ) {
    const round = rounds[roundIndex];
    const startQuestionIndex =
      roundIndex === target.roundIndex ? target.questionIndex + 1 : 0;
    const endQuestionIndexExclusive =
      roundIndex === blockEnd.roundIndex
        ? blockEnd.questionIndex + 1
        : round.questions.length;
    for (
      let questionIndex = startQuestionIndex;
      questionIndex < endQuestionIndexExclusive;
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
