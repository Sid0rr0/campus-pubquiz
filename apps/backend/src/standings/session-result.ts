import {
  type LeaderboardEntry,
  questionOutcome,
  type QuestionType,
  type Verdict,
} from '@campus-pubquiz/types';

/** A team's points with no place in the ranking — one that took part but is no longer on the roster. */
export type DepartedTeam = Omit<LeaderboardEntry, 'rank' | 'rankTo'>;

export interface SessionStandings {
  /** Every roster team, already in final order with `rank`/`rankTo`. */
  leaderboard: LeaderboardEntry[];
  /** Teams that took part but were kicked or left: points only, never ranked, highest total first. */
  departed: DepartedTeam[];
  /** Ranked plus departed teams — the team count every stats denominator uses. */
  participantCount: number;
  /** The one winner: the first ranked team (undefined for an empty roster). Never a departed team. */
  winner: LeaderboardEntry | undefined;
}

/** A question played in the session, as stored. */
export interface SessionResultQuestion {
  id: number;
  roundId: number;
  type: QuestionType;
  points: number;
}

/** A stored answer to one of the session's questions. */
export interface SessionResultAnswer {
  questionId: number;
  teamId: number;
  verdict: Verdict | null;
  pointsAwarded: number;
}

export interface SessionResultInput {
  standings: SessionStandings;
  questions: readonly SessionResultQuestion[];
  answers: readonly SessionResultAnswer[];
}

export interface TeamResult {
  teamId: number;
  teamName: string;
  /** Competition rank; null for a team that left. */
  placing: number | null;
  /** End of the tie group; null for a team that left. */
  placingTo: number | null;
  hasLeft: boolean;
  /** Taken from Standings, never re-summed. */
  totalPoints: number;
  bonusPoints: number;
  /** `totalPoints` less `bonusPoints`. */
  answerPoints: number;
  /** At least one stored answer in the session. */
  answered: boolean;
  /** Answers whose verdict is `correct`. */
  correctCount: number;
  /** Placed 1st: every tied team wins it, a team that left never does. */
  wonNight: boolean;
  /** The single team Standings picked as winner. */
  isSessionWinner: boolean;
}

export interface QuestionResult {
  questionId: number;
  answeredCount: number;
  correctCount: number;
  /** Summed verdict credit over the participant count; null when it says nothing. */
  correctRate: number | null;
}

export interface SessionResult {
  /** Ranked teams in Standings order, then the departed teams. */
  teams: TeamResult[];
  /** In the order the questions were given. */
  questions: QuestionResult[];
  participantCount: number;
  maxPoints: number;
}

/**
 * What one ended session's results mean. Pure: placing, ties, the winner and
 * who took part come from Standings unchanged; this module never ranks, sorts
 * teams or re-sums totals.
 */
export function sessionResult(input: SessionResultInput): SessionResult {
  const { standings, questions, answers } = input;
  const { participantCount } = standings;

  const answeredTeams = new Set(answers.map((a) => a.teamId));
  const correctByTeam = new Map<number, number>();
  for (const a of answers) {
    if (a.verdict === 'correct') {
      correctByTeam.set(a.teamId, (correctByTeam.get(a.teamId) ?? 0) + 1);
    }
  }

  const teamResult = (
    entry: SessionStandings['departed'][number],
    place: { rank: number; rankTo: number } | null,
  ): TeamResult => ({
    teamId: entry.teamId,
    teamName: entry.teamName,
    placing: place?.rank ?? null,
    placingTo: place?.rankTo ?? null,
    hasLeft: place === null,
    totalPoints: entry.totalPoints,
    bonusPoints: entry.bonusPoints,
    answerPoints: entry.totalPoints - entry.bonusPoints,
    answered: answeredTeams.has(entry.teamId),
    correctCount: correctByTeam.get(entry.teamId) ?? 0,
    wonNight: place?.rank === 1,
    isSessionWinner: standings.winner?.teamId === entry.teamId,
  });

  const answersByQuestion = new Map<number, SessionResultAnswer[]>();
  for (const a of answers) {
    const list = answersByQuestion.get(a.questionId) ?? [];
    list.push(a);
    answersByQuestion.set(a.questionId, list);
  }

  return {
    teams: [
      ...standings.leaderboard.map((entry) => teamResult(entry, entry)),
      ...standings.departed.map((entry) => teamResult(entry, null)),
    ],
    questions: questions.map((question) => {
      const given = answersByQuestion.get(question.id) ?? [];
      const { answeredCount, correctCount, correctRate } = questionOutcome(
        question,
        given,
        participantCount,
      );
      return {
        questionId: question.id,
        answeredCount,
        correctCount,
        correctRate,
      };
    }),
    participantCount,
    maxPoints: questions.reduce((sum, q) => sum + q.points, 0),
  };
}
