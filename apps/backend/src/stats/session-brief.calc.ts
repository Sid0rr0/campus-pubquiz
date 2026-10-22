import {
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

function questionSection(
  question: SessionBriefQuestionInputRow,
  questionNumber: number,
  input: SessionBriefInput,
  teamCount: number,
): string[] {
  const given = input.answers.filter(
    (a) => a.questionId === question.questionId,
  );
  const outcome = questionOutcome(question, given, teamCount);
  const notes = questionNotesOf(question.notes);
  const counts = [
    `Answered ${outcome.answeredCount}`,
    `correct ${outcome.correctCount}`,
    `partial ${outcome.partialCount}`,
    ...(outcome.correctRate === null
      ? []
      : [`correct rate ${percent(outcome.correctRate)}`]),
  ].join(', ');
  return [
    '',
    `### Q${questionNumber} (${question.type}, ${question.points} pts)`,
    question.prompt,
    `- Answer: ${question.answer}`,
    ...(notes ? [`- Notes: ${notes}`] : []),
    ...(question.media.question ? [`- Media: ${question.media.question}`] : []),
    ...(question.media.answer
      ? [`- Answer media: ${question.media.answer}`]
      : []),
    `- ${counts}`,
  ];
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

  const roundSections = rounds.flatMap((round, roundIndex) => {
    const questions = input.questions
      .filter((q) => q.roundId === round.roundId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const questionLines = questions.flatMap((question, questionIndex) =>
      questionSection(question, questionIndex + 1, input, teamCount),
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
