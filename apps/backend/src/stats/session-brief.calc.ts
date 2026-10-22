import {
  questionNotesOf,
  questionOutcome,
  type MediaKind,
} from '@campus-pubquiz/types';
import type {
  SessionDetailInput,
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

function sessionSection(input: SessionBriefInput, teamCount: number): string[] {
  const { session } = input;
  return [
    `# ${session.name}`,
    '',
    `Date: ${new Date(session.playedAt).toISOString().slice(0, 10)}`,
    `Teams: ${teamCount}`,
  ];
}

function roundSection(
  round: SessionBriefRoundInputRow,
  roundNumber: number,
  questionLines: string[],
): string[] {
  return [
    `## Round ${roundNumber}: ${round.title}`,
    ...(round.category ? [`Category: ${round.category}`] : []),
    ...(round.author ? [`Author: ${round.author}`] : []),
    ...(round.isKahoot ? ['Kahoot round: points scale with speed'] : []),
    ...(round.note ? [`Note: ${round.note}`] : []),
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
  const teamCount = input.standings.participantCount;
  const rounds = [...input.rounds].sort((a, b) => a.orderIndex - b.orderIndex);

  const roundSections = rounds.flatMap((round, roundIndex) => {
    const questions = input.questions
      .filter((q) => q.roundId === round.roundId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const questionLines = questions.flatMap((question, questionIndex) =>
      questionSection(question, questionIndex + 1, input, teamCount),
    );
    return ['', ...roundSection(round, roundIndex + 1, questionLines)];
  });

  return [...sessionSection(input, teamCount), ...roundSections, ''].join('\n');
}
