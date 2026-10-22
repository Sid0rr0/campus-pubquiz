import type { GameStatus } from './game-state-types';

/** How long the joker pick stays open, in seconds. Fixed, not a setting. */
export const JOKER_PICK_SECONDS = 60;

/** How a team came to hold its joker: it picked the round, the server drew one for it, or the quiz master set it. */
export const JOKER_SOURCES = ['chosen', 'drawn', 'set_by_quiz_master'] as const;
export type JokerSource = (typeof JOKER_SOURCES)[number];

/** A team's joker: the round whose answer points count double, and how the team came to hold it. */
export interface TeamJoker {
  roundId: number;
  source: JokerSource;
}

/** A team's joker as the quiz master reads it: which round, by number and title, and how the team came to hold it. */
export interface AdminTeamJoker extends TeamJoker {
  /** 1-based position of the joker round in the quiz. */
  roundNumber: number;
  roundTitle: string;
}

/** A team asking for a round as its joker; the ack says whether it was saved. Replaces whatever the team had. */
export interface PickJokerPayload {
  roundId: number;
}

/** The quiz master giving a team a joker round; the ack says whether it was saved. Replaces whatever the team had. */
export interface SetTeamJokerPayload {
  teamId: number;
  roundId: number;
}

/** Sent to a team's own phones after its joker changed, so every phone of the team shows the same one. */
export interface TeamJokerSyncedPayload {
  joker: TeamJoker | null;
}

/** One round on the joker pick: what a team needs to recognise it. */
export interface JokerPickRound {
  roundId: number;
  /** 1-based position of the round in the quiz. */
  roundNumber: number;
  title: string;
  /** '' when the round has none. */
  category: string;
  /** '' when the round has none. */
  author: string;
}

/**
 * The joker pick as the players room sees it: the deadline (null once the pick
 * has closed) and the rounds a team may still choose. Never a team's choice.
 */
export interface JokerPickPlayersView {
  endsAt: number | null;
  rounds: JokerPickRound[];
}

/** The part of a seeded round the joker pick lists — a SeededRound fits. */
interface JokerListedRound {
  id: number;
  title: string;
  category?: string;
  author?: string;
}

/** `listed` (some or all of `allRounds`, by identity) as the joker pick shows them, each with its place in the whole quiz. */
export function toJokerPickRounds(
  allRounds: readonly JokerListedRound[],
  listed: readonly JokerListedRound[],
): JokerPickRound[] {
  return listed.map((round) => ({
    roundId: round.id,
    roundNumber: allRounds.indexOf(round) + 1,
    title: round.title,
    category: round.category ?? '',
    author: round.author ?? '',
  }));
}

/**
 * The rounds with no opened question, in quiz order: the only ones a joker may
 * sit on, since a team that has seen a round's questions must not double it.
 */
export function pickableRounds<
  R extends { questions: readonly { id: number }[] },
>(rounds: readonly R[], openedQuestionIds: readonly number[]): R[] {
  const opened = new Set(openedQuestionIds);
  return rounds.filter(
    (round) => !round.questions.some((question) => opened.has(question.id)),
  );
}

/**
 * One of `pickableRoundIds` with equal chance, or null when there is none.
 * `random` is injected (a value in [0, 1) like `Math.random`) so tests are
 * deterministic.
 */
export function drawJoker(
  pickableRoundIds: readonly number[],
  random: () => number,
): number | null {
  if (pickableRoundIds.length === 0) return null;
  const index = Math.min(
    Math.floor(random() * pickableRoundIds.length),
    pickableRoundIds.length - 1,
  );
  return pickableRoundIds[index];
}

/** The statuses before the joker pick has ever opened, when there is no joker to show or change yet. */
const STATUSES_BEFORE_JOKER_PICK: readonly GameStatus[] = [
  'lobby',
  'rules',
  'round_overview',
];

/** Whether the quiz has reached the joker pick: at it, or past it (the pick may since have closed). */
export function hasJokerPickOpened(status: GameStatus): boolean {
  return !STATUSES_BEFORE_JOKER_PICK.includes(status);
}

/**
 * Whether the quiz master may set a team's joker to `roundId`: the session plays
 * with jokers, the pick has opened (it may since have closed), and the round has
 * not started.
 */
export function canSetJoker(
  context: {
    isEnabled: boolean;
    status: GameStatus;
    pickableRoundIds: readonly number[];
  },
  roundId: number,
): boolean {
  return (
    context.isEnabled &&
    hasJokerPickOpened(context.status) &&
    context.pickableRoundIds.includes(roundId)
  );
}

/** Whether a team may choose `roundId` as its joker: only while the pick is open, and only a round that has not started. */
export function canChooseJoker(
  pick: { isPickOpen: boolean; pickableRoundIds: readonly number[] },
  roundId: number,
): boolean {
  return pick.isPickOpen && pick.pickableRoundIds.includes(roundId);
}
