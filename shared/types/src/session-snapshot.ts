import { getBlockInPlay, getBlockInPlayIds } from './block-in-play';
import {
  getBlockSeededQuestions,
  getAnsweredTeamIds,
  getBlockQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getPastRevealedQuestions,
  getRevealQuestions,
  getUpcomingQuestionPositions,
} from './block-questions';
import { isAnsweringStatus } from './game-state-groups';
import {
  hasJokerPickOpened,
  pickableRounds,
  toJokerPickRounds,
  type AdminTeamJoker,
  type JokerPickRound,
} from './joker';
import { getQuizStructureSummary } from './game-state-structure';
import { teamCoins } from './power-ups';
import { getTimedPhaseKey } from './game-state-timed-phase';
import {
  isCurrentKahootQuestionRevealed,
  isQuestionHiddenBehindKahootLeaderboard,
} from './kahoot-visibility';
import { hasMeaningfulCorrectRate } from './question-correct-rate';
import { questionOutcome } from './question-outcome';
import type { SeededQuestion } from './question-views';
import type {
  AdminQuestionContext,
  AdminTeamView,
  AdminStatePayload,
  DisplayStatePayload,
  PlayersStatePayload,
  ScreenOperatorFields,
  StateSnapshotPayload,
  TeamsCorrect,
  TeamView,
} from './room-views';
import {
  getGameContext,
  type SeededRound,
  type SessionState,
} from './session-state';
import { buildActiveShowdownView } from './showdown-reveal';
import { revealStepOf } from './stepped-reveal';

/**
 * The phaseStartedAt/phaseElapsedMs pair for whatever timed phase is
 * *currently displayed* (session.progress) — which may not be the live
 * frontier (session.livePhaseKey) if the admin has stepped back via
 * Previous. Displaying the frontier itself is live (phaseStartedAt set,
 * ticking); displaying anything else timed is a fixed, already-banked value
 * (see SessionState.phaseElapsedByKey); displaying an untimed status is
 * neither.
 */
function resolveCurrentPhaseTimerView(session: SessionState): {
  phaseStartedAt: number | null;
  phaseElapsedMs: number | null;
} {
  const displayedKey = getTimedPhaseKey(
    session.progress,
    getGameContext(session),
  );
  if (displayedKey === null) {
    return { phaseStartedAt: null, phaseElapsedMs: null };
  }
  if (displayedKey === session.livePhaseKey) {
    return { phaseStartedAt: session.phaseStartedAt, phaseElapsedMs: null };
  }
  return {
    phaseStartedAt: null,
    phaseElapsedMs: session.phaseElapsedByKey[displayedKey] ?? null,
  };
}

/**
 * The teams-correct count for the question on air in 'reveal'. Null outside a
 * reveal and for a question type with no correct rate (a closest_guess reveal
 * names the closest teams). Teams that gave no answer count in the total.
 */
function describeTeamsCorrect(session: SessionState): TeamsCorrect | null {
  if (session.progress.status !== 'reveal') return null;
  const question =
    getBlockSeededQuestions(session)[session.progress.revealIndex];
  if (!question || !hasMeaningfulCorrectRate(question.type)) return null;
  // The leaderboard lists every roster team (re-read with each write and on
  // restore); `session.teams` is only filled as teams join.
  const teamCount = session.leaderboard.length;
  const { correctCount, partialCount } = questionOutcome(
    question,
    session.funFactData.answers.filter(
      (answer) => answer.questionId === question.id,
    ),
    teamCount,
  );
  return {
    correct: correctCount,
    partial: partialCount,
    teamCount,
  };
}

/** The fields only the big screen and /control (and /remote) read — added to the display and admin views, never the players view. */
export function buildScreenOperatorFields(
  session: SessionState,
): ScreenOperatorFields {
  return {
    roundTitles: session.seededGame.rounds.map((round) => round.title),
    answeredTeamIds: getAnsweredTeamIds(session),
    breakEndsAt: session.breakEndsAt,
    displayTextScale: session.displayTextScale,
    isDisplaySoundMuted: session.isDisplaySoundMuted,
  };
}

/** Whether the joker pick is open for choosing right now: it is the status and its deadline is armed. The one rule behind the players view, the phone screen and the pick gate. */
export function isJokerPickOpen(session: SessionState): boolean {
  return (
    session.progress.status === 'joker_pick' && session.jokerPickEndsAt !== null
  );
}

/** Whether the session plays with jokers and has reached the joker pick, so the rounds can be named for a joker. */
function isJokerLineupKnown(session: SessionState): boolean {
  return (
    session.seededGame.settings.jokersEnabled &&
    hasJokerPickOpened(session.progress.status)
  );
}

/** The session's rounds as the joker pick lists them; with `onlyPickable`, only those with no opened question. */
export function describeJokerPickRounds(
  session: SessionState,
  onlyPickable: boolean,
): JokerPickRound[] {
  const { rounds } = session.seededGame;
  return toJokerPickRounds(
    rounds,
    onlyPickable ? pickableRounds(rounds, session.openedQuestionIds) : rounds,
  );
}

/** The team's joker with its round named, or null when it has none (or its round is gone from the quiz). */
function describeAdminTeamJoker(
  session: SessionState,
  teamId: number,
): AdminTeamJoker | null {
  const joker = session.jokers[teamId];
  if (!joker) return null;
  const { rounds } = session.seededGame;
  const index = rounds.findIndex((round) => round.id === joker.roundId);
  if (index === -1) return null;
  return {
    ...joker,
    roundNumber: index + 1,
    roundTitle: rounds[index].title,
  };
}

/** The fields only /display reads — added to its view alone by the Screen projection. */
export function buildDisplayFields(
  session: SessionState,
): Pick<
  DisplayStatePayload,
  | 'roundCategories'
  | 'roundAuthors'
  | 'kahootQuestionEndsAt'
  | 'jokerPickEndsAt'
  | 'teamsCorrect'
> {
  const { rounds } = session.seededGame;
  return {
    roundCategories: rounds.map((round) => round.category ?? ''),
    roundAuthors: rounds.map((round) => round.author ?? ''),
    kahootQuestionEndsAt: session.kahootQuestionEndsAt,
    jokerPickEndsAt: session.jokerPickEndsAt,
    teamsCorrect: describeTeamsCorrect(session),
  };
}

/** The fields only /control and /remote read — added to the admin view alone. */
export function buildAdminFields(
  session: SessionState,
): Pick<
  AdminStatePayload,
  | 'teams'
  | 'settableJokerRounds'
  | 'ungradedQuestionIds'
  | 'phaseStartedAt'
  | 'phaseElapsedMs'
> {
  const { maxPlayersPerTeam } = session.seededGame.settings;
  return {
    settableJokerRounds: isJokerLineupKnown(session)
      ? describeJokerPickRounds(session, true)
      : [],
    teams: session.teams.map((team): AdminTeamView => {
      const playerCount = session.playerCounts[team.teamId] ?? null;
      return {
        ...team,
        isConnected: Boolean(session.connectedTeamSockets[team.teamId]),
        playerCount,
        isOverPlayerCap:
          // Stryker disable next-line ConditionalExpression: equivalent for the `true &&` variant, null > number is false anyway; the null guard is for the type checker
          playerCount !== null && playerCount > maxPlayersPerTeam,
        joker: describeAdminTeamJoker(session, team.teamId),
        coins: teamCoins(
          session.seededGame.settings,
          session.carriedCoins[team.teamId],
        ),
      };
    }),
    ungradedQuestionIds: session.ungradedQuestionIds,
    ...resolveCurrentPhaseTimerView(session),
  };
}

/** The fields only /play reads — added to the players view alone. */
export function buildPlayersFields(
  session: SessionState,
): Pick<
  PlayersStatePayload,
  'upcomingQuestions' | 'pastRevealedQuestions' | 'jokerPick' | 'jokerRounds'
> {
  return {
    jokerRounds: isJokerLineupKnown(session)
      ? describeJokerPickRounds(session, false)
      : [],
    upcomingQuestions: getUpcomingQuestionPositions(session),
    pastRevealedQuestions: getPastRevealedQuestions(session),
    jokerPick:
      session.progress.status === 'joker_pick'
        ? {
            endsAt: session.jokerPickEndsAt,
            rounds: describeJokerPickRounds(session, true),
          }
        : null,
  };
}

/** Assembles the shared base of every room's view for a session — the shape every display/admin/players client resyncs to on connect or after every applyAction. */
export function buildSnapshot(session: SessionState): StateSnapshotPayload {
  const showdownRevealStep = revealStepOf(session, 'showdown');
  return {
    progress: session.progress,
    quizStructure: getQuizStructureSummary(getGameContext(session)),
    roundTitle: getCurrentRoundTitle(session),
    isCurrentRoundKahoot:
      session.seededGame.rounds[session.progress.roundIndex]?.kahootMode ??
      false,
    currentQuestion: getCurrentQuestion(session),
    blockQuestions: getBlockQuestions(session),
    revealQuestions: getRevealQuestions(session),
    leaderboard: session.leaderboard,
    joinCode: session.seededGame.joinCode,
    teams: session.teams.map(
      (team): TeamView => ({
        ...team,
        isConnected: Boolean(session.connectedTeamSockets[team.teamId]),
      }),
    ),
    questionLockAt: session.questionLockAt,
    settings: session.seededGame.settings,
    activeShowdown: buildActiveShowdownView(
      session.activeShowdownRound,
      showdownRevealStep,
    ),
    showdownRevealStep,
  };
}

/**
 * Whether the session's current block can be answered right now: its
 * questions are open (or locking), or a round intro sits over questions
 * already open — and never for a kahoot question still hidden behind the
 * leaderboard, and never for a kahoot question whose reveal already aired.
 * The one rule behind both the players view and the answer-submission gate.
 */
export function isBlockAnswerable(session: SessionState): boolean {
  return (
    isAnsweringStatus(session.progress.status) &&
    !isQuestionHiddenBehindKahootLeaderboard(session) &&
    !isCurrentKahootQuestionRevealed(session) &&
    getBlockInPlayIds(session.seededGame.rounds, session.progress).length > 0
  );
}

/**
 * The session's copy of `questionId` when it can be answered right now (the
 * block is answerable and the question is in it), else undefined. One block
 * lookup serves the submit gate and the question it hands over.
 */
export function findQuestionOpenForAnswering(
  session: SessionState,
  questionId: number,
): SeededQuestion | undefined {
  if (!isBlockAnswerable(session)) return undefined;
  const { rounds } = session.seededGame;
  const position = getBlockInPlay(rounds, session.progress).find(
    (inPlay) => inPlay.questionId === questionId,
  );
  return position === undefined
    ? undefined
    : rounds[position.roundIndex].questions[position.questionIndex];
}

/**
 * Correct answer + round position for a question, for the admin grading
 * view alone. Callers MUST only forward this over an admin-room-only
 * channel (ANSWERS_UPDATED) — never through the broadcast snapshot.
 */
export function buildAdminQuestionContext(
  rounds: SeededRound[],
  questionId: number,
): AdminQuestionContext | null {
  for (const [roundOffset, round] of rounds.entries()) {
    const questionOffset = round.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (questionOffset === -1) continue;

    const question = round.questions[questionOffset];
    return {
      type: question.type,
      prompt: question.prompt,
      ...(question.options !== undefined ? { options: question.options } : {}),
      ...(question.matchTargets !== undefined
        ? { matchTargets: question.matchTargets }
        : {}),
      ...(question.mediaUrl !== undefined
        ? { mediaUrl: question.mediaUrl }
        : {}),
      points: question.points,
      correctAnswer: question.answer,
      roundTitle: round.title,
      roundNumber: roundOffset + 1,
      questionNumberInRound: questionOffset + 1,
      totalQuestionsInRound: round.questions.length,
    };
  }
  return null;
}
