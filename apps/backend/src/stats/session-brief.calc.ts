import { groupTopics } from '@/stats/session-feedback.calc';
import {
  parseFiniteNumber,
  questionNotesOf,
  questionOutcome,
  type MediaKind,
} from '@campus-pubquiz/types';
import type {
  SessionDetailRoundRow,
  SessionDetailStats,
} from '@campus-pubquiz/types';
import {
  computeSessionDetail,
  type SessionDetailInput,
  SessionDetailQuestionInputRow,
  SessionDetailRoundInputRow,
} from '@/stats/session-detail.calc';

/** What a brief says about a media link: its kind, never the link. */
export type BriefMediaKind = 'image' | 'audio' | 'video';

export interface SessionBriefRoundInputRow extends SessionDetailRoundInputRow {
  /** The round's free-text author as stored. */
  author: string | null;
  note: string | null;
  isKahoot: boolean;
}

export interface SessionBriefQuestionInputRow extends SessionDetailQuestionInputRow {
  /** The raw stored notes, settings group included. */
  notes: string | null;
  media: { question?: BriefMediaKind; answer?: BriefMediaKind };
  /** The stored options of a `multiple_choice` question, in stored order. */
  options?: string[];
}

/**
 * The session detail's rows with the extra columns a brief reads. A superset
 * of `SessionDetailInput`, so the same rows feed both calcs and the figures
 * cannot disagree.
 */
export interface SessionBriefInput extends Omit<
  SessionDetailInput,
  'rounds' | 'questions'
> {
  rounds: SessionBriefRoundInputRow[];
  questions: SessionBriefQuestionInputRow[];
  /**
   * Ids of every question the session opened, as its row stored them. A
   * question with no answers outside this list reads "not played". Null for a
   * session saved before opened questions were tracked.
   */
  reachedQuestionIds: readonly number[] | null;
}

/** A brief says "video" for both YouTube links and video files. */
export function briefMediaKind(
  kind: MediaKind | undefined,
): BriefMediaKind | undefined {
  if (kind === undefined) return undefined;
  return kind === 'youtube' || kind === 'video-file' ? 'video' : kind;
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sessionSection(
  input: SessionBriefInput,
  detail: SessionDetailStats,
): string[] {
  const { session } = input;
  const { playerCount, maxPoints } = detail;
  const shares = detail.standings
    .map((s) => (maxPoints > 0 ? s.total / maxPoints : 0))
    .sort((a, b) => a - b);
  return [
    `# ${session.name}`,
    '',
    `Date: ${new Date(session.playedAt).toISOString().slice(0, 10)}`,
    `Teams: ${detail.teamCount}`,
    `Players: ${playerCount.total} (${playerCount.reportedTeams} of ${detail.teamCount} teams reported)`,
    ...(shares.length > 0
      ? [
          `Score spread: top ${percent(shares[shares.length - 1])}, median ${percent(median(shares))}, bottom ${percent(shares[0])}`,
        ]
      : []),
  ];
}

/** Placing, points, share of max points and players. No team name, code or id. */
function standingsSection(detail: SessionDetailStats): string[] {
  const rows = detail.standings.map((s) => {
    const placing = s.hasLeft
      ? 'left'
      : `${s.rankTo !== null && s.rankTo !== s.rank ? 'Joint ' : ''}${ordinal(s.rank ?? 0)}`;
    const share =
      detail.maxPoints > 0 ? percent(s.total / detail.maxPoints) : '0%';
    const players =
      s.playerCount === null ? '' : `, ${plural(s.playerCount, 'player')}`;
    return `- ${placing}: ${s.total} pts (${share})${players}`;
  });
  return ['', '## Standings', ...rows];
}

function highlightsSection(
  input: SessionBriefInput,
  detail: SessionDetailStats,
): string[] {
  const roundNumberById = new Map(
    [...input.rounds]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((r, i) => [r.roundId, i + 1]),
  );
  const describe = (label: string, questionId: number | null): string[] => {
    const row = detail.questions.find((q) => q.questionId === questionId);
    if (!row || row.correctRate === null) return [];
    const number = detail.questions
      .filter((q) => q.roundId === row.roundId)
      .findIndex((q) => q.questionId === row.questionId);
    return [
      `- ${label}: Round ${roundNumberById.get(row.roundId)} Q${number + 1} (${percent(row.correctRate)} correct)`,
    ];
  };
  const lines = [
    ...describe('Hardest question', detail.highlights.hardestQuestionId),
    ...describe('Easiest question', detail.highlights.easiestQuestionId),
  ];
  return lines.length > 0 ? ['', '## Highlights', ...lines] : [];
}

function feedbackSection(detail: SessionDetailStats): string[] {
  const { feedback } = detail;
  if (!feedback.collected) return ['', '## Feedback', 'Feedback was off.'];
  return [
    '',
    '## Feedback',
    '',
    'Topic suggestions:',
    ...(feedback.topics.length > 0
      ? feedback.topics.map((t) => `- ${t.topic}: ${t.count}`)
      : ['- none']),
    '',
    'Comments (newest first):',
    ...(feedback.comments.length > 0
      ? feedback.comments.map((c) => `- "${c.text.trim()}"`)
      : ['- none']),
  ];
}

function roundSection(
  round: SessionBriefRoundInputRow,
  roundNumber: number,
  detailRow: SessionDetailRoundRow | undefined,
  questionLines: string[],
): string[] {
  const rating = detailRow?.rating;
  const correctRate = detailRow?.correctRate ?? null;
  return [
    `## Round ${roundNumber}: ${round.title}`,
    ...(round.category ? [`Category: ${round.category}`] : []),
    ...(round.author ? [`Author: ${round.author}`] : []),
    ...(round.isKahoot ? ['Kahoot round: points scale with speed'] : []),
    ...(round.note ? [`Note: ${round.note}`] : []),
    rating
      ? `Rating: ${rating.average.toFixed(1)} stars (${plural(rating.count, 'rating')})`
      : 'Rating: no ratings',
    ...(correctRate === null ? [] : [`Correct rate: ${percent(correctRate)}`]),
    ...questionLines,
  ];
}

/** How many of the most common wrong answers a brief shows. */
const WRONG_ANSWERS_SHOWN = 3;

function groupedAnswers(
  texts: readonly string[],
  limit = Infinity,
): string | null {
  const groups = groupTopics([[...texts]]).slice(0, limit);
  return groups.length === 0
    ? null
    : groups.map((g) => `${g.topic} (${g.count})`).join(', ');
}

function medianOf(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** What went wrong on one question, by type; sort and match add nothing. */
function wrongAnswerLines(
  question: SessionBriefQuestionInputRow,
  given: readonly SessionBriefInput['answers'][number][],
): string[] {
  switch (question.type) {
    case 'free_text':
    case 'number': {
      const wrong = groupedAnswers(
        given.filter((a) => a.verdict === 'incorrect').map((a) => a.answer),
        WRONG_ANSWERS_SHOWN,
      );
      const ungraded = groupedAnswers(
        given.filter((a) => a.verdict === null).map((a) => a.answer),
      );
      return [
        ...(wrong ? [`- Wrong answers: ${wrong}`] : []),
        ...(ungraded ? [`- Ungraded answers: ${ungraded}`] : []),
      ];
    }
    case 'multiple_choice': {
      const options = question.options ?? [];
      if (options.length === 0) return [];
      const picks = options.map((option) => {
        const count = given.filter((a) => a.answer === option).length;
        return `${option} (${count})${option === question.answer ? ' [correct]' : ''}`;
      });
      return [`- Options: ${picks.join(', ')}`];
    }
    case 'closest_guess': {
      const guesses = given
        .map((a) => parseFiniteNumber(a.answer))
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
      if (guesses.length === 0) return [];
      return [
        `- Guesses: lowest ${guesses[0]}, median ${medianOf(guesses)}, highest ${guesses[guesses.length - 1]}`,
      ];
    }
    default:
      return [];
  }
}

/**
 * The questions the session put in front of teams. Uses the stored list when
 * the session row kept one; a session saved before that was tracked (null)
 * falls back to every question up to the last one with an answer, in play order.
 */
function reachedQuestionIdsOf(
  input: SessionBriefInput,
  sortedRounds: readonly SessionBriefRoundInputRow[],
): ReadonlySet<number> {
  if (input.reachedQuestionIds !== null) {
    return new Set(input.reachedQuestionIds);
  }
  const inPlayOrder = sortedRounds.flatMap((round) =>
    input.questions
      .filter((q) => q.roundId === round.roundId)
      .sort((a, b) => a.orderIndex - b.orderIndex),
  );
  const answeredIds = new Set(input.answers.map((a) => a.questionId));
  const lastAnswered = inPlayOrder.findLastIndex((q) =>
    answeredIds.has(q.questionId),
  );
  return new Set(
    inPlayOrder.slice(0, lastAnswered + 1).map((q) => q.questionId),
  );
}

function questionSection(
  question: SessionBriefQuestionInputRow,
  questionNumber: number,
  input: SessionBriefInput,
  teamCount: number,
  reachedIds: ReadonlySet<number>,
): string[] {
  const given = input.answers.filter(
    (a) => a.questionId === question.questionId,
  );
  const notes = questionNotesOf(question.notes);
  const header = [
    '',
    `### Q${questionNumber} (${question.type}, ${question.points} pts)`,
    question.prompt,
    `- Answer: ${question.answer}`,
    ...(notes ? [`- Notes: ${notes}`] : []),
    ...(question.media.question ? [`- Media: ${question.media.question}`] : []),
    ...(question.media.answer
      ? [`- Answer media: ${question.media.answer}`]
      : []),
  ];
  if (given.length === 0 && !reachedIds.has(question.questionId)) {
    return [...header, '- (not played)'];
  }
  const outcome = questionOutcome(question, given, teamCount);
  const counts = [
    `Answered ${outcome.answeredCount}`,
    `correct ${outcome.correctCount}`,
    `partial ${outcome.partialCount}`,
    ...(outcome.correctRate === null
      ? []
      : [`correct rate ${percent(outcome.correctRate)}`]),
  ].join(', ');
  return [...header, `- ${counts}`, ...wrongAnswerLines(question, given)];
}

/**
 * One ended session as Markdown for whoever writes the next quiz. Pure, and
 * built on the same rows and the same Question outcome as `computeSessionDetail`
 * so the figures match the stats page. Data only: no team name, code or id and
 * no media link is ever written. Each part is its own section function so a
 * new part is one more entry in the list below.
 */
export function computeSessionBrief(input: SessionBriefInput): string {
  // The stats page's own aggregation, so every figure here is its figure.
  const detail = computeSessionDetail(input);
  const teamCount = detail.teamCount;
  const rounds = [...input.rounds].sort((a, b) => a.orderIndex - b.orderIndex);
  const reachedIds = reachedQuestionIdsOf(input, rounds);

  const roundSections = rounds.flatMap((round, roundIndex) => {
    const questions = input.questions
      .filter((q) => q.roundId === round.roundId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const questionLines = questions.flatMap((question, questionIndex) =>
      questionSection(
        question,
        questionIndex + 1,
        input,
        teamCount,
        reachedIds,
      ),
    );
    const detailRow = detail.rounds.find((r) => r.roundId === round.roundId);
    return [
      '',
      ...roundSection(round, roundIndex + 1, detailRow, questionLines),
    ];
  });

  return [
    ...sessionSection(input, detail),
    ...standingsSection(detail),
    ...highlightsSection(input, detail),
    ...roundSections,
    ...feedbackSection(detail),
    '',
  ].join('\n');
}
