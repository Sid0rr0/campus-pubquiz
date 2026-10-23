import { rankTeams } from '@campus-pubquiz/types';
import type { SessionStandings } from '@/standings/standings.service';
import {
  computeSessionDetail,
  type SessionDetailInput,
} from '@/stats/session-detail.calc';

const BASE_SESSION = {
  gameSessionId: 1,
  joinCode: 'ABCDEF',
  quizTitle: 'Quiz Night',
  name: 'Quiz Night',
  playedAt: '2026-01-01T00:00:00.000Z',
};

interface TestTeam {
  teamId: number;
  teamName: string;
  /** Took part but is no longer on the roster. */
  hasLeft?: boolean;
}

type BuildInputOverrides = Partial<Omit<SessionDetailInput, 'standings'>> & {
  teams?: TestTeam[];
  standings?: SessionStandings;
};

/** Stands in for the Standings service: totals from the answers and bonuses, ranked with the shared rule. */
function standingsFor(
  teams: TestTeam[],
  answers: SessionDetailInput['answers'],
  bonusAwards: SessionDetailInput['bonusAwards'],
): SessionStandings {
  const entries = teams.map((team) => {
    const bonusPoints = bonusAwards
      .filter((b) => b.teamId === team.teamId)
      .reduce((sum, b) => sum + b.points, 0);
    const answerPoints = answers
      .filter((a) => a.teamId === team.teamId)
      .reduce((sum, a) => sum + a.pointsAwarded * (a.isJoker ? 2 : 1), 0);
    return {
      hasLeft: team.hasLeft === true,
      entry: {
        teamId: team.teamId,
        teamName: team.teamName,
        totalPoints: answerPoints + bonusPoints,
        bonusPoints,
        positiveBonusPoints: Math.max(bonusPoints, 0),
        negativeBonusPoints: Math.min(bonusPoints, 0),
        roundPoints: [],
      },
    };
  });
  const leaderboard = rankTeams(
    entries.filter((e) => !e.hasLeft).map((e) => e.entry),
  );
  return {
    leaderboard,
    departed: entries.filter((e) => e.hasLeft).map((e) => e.entry),
    participantCount: entries.length,
    winner: leaderboard[0],
  };
}

function buildInput({
  teams = [],
  standings,
  answers = [],
  bonusAwards = [],
  ...overrides
}: BuildInputOverrides): SessionDetailInput {
  return {
    session: BASE_SESSION,
    standings: standings ?? standingsFor(teams, answers, bonusAwards),
    playerCounts: new Map(),
    rounds: [],
    roundRatings: [],
    isFeedbackCollected: true,
    feedback: [],
    questions: [],
    answers,
    bonusAwards,
    ...overrides,
  };
}

describe('computeSessionDetail', () => {
  it('passes the standings through in the order and ranks given, without sorting or ranking itself', () => {
    const entry = (teamId: number, teamName: string, totalPoints: number) => ({
      teamId,
      teamName,
      totalPoints,
      bonusPoints: 0,
      positiveBonusPoints: 0,
      negativeBonusPoints: 0,
      roundPoints: [],
    });
    // Deliberately not the order the ranking rule would give.
    const standings: SessionStandings = {
      leaderboard: [
        { ...entry(1, 'Zed', 3), rank: 1, rankTo: 2 },
        { ...entry(2, 'Amy', 3), rank: 1, rankTo: 2 },
        { ...entry(3, 'Low', 1), rank: 3, rankTo: 3 },
      ],
      departed: [entry(4, 'Gone High', 9)],
      participantCount: 4,
      winner: { ...entry(1, 'Zed', 3), rank: 1, rankTo: 2 },
    };

    const result = computeSessionDetail(buildInput({ standings }));

    expect(
      result.standings.map((s) => [
        s.teamName,
        s.rank,
        s.rankTo,
        s.hasLeft,
        s.isWinner,
        s.total,
      ]),
    ).toEqual([
      ['Zed', 1, 2, false, true, 3],
      ['Amy', 1, 2, false, false, 3],
      ['Low', 3, 3, false, false, 1],
      ['Gone High', null, null, true, false, 9],
    ]);
  });

  it('lists every stored answer on the scoresheet, ungraded and departed teams included', () => {
    const answerRow = (
      teamId: number,
      verdict: 'correct' | null,
      pointsAwarded: number,
    ) => ({
      questionId: 10,
      teamId,
      teamName: `Team ${teamId}`,
      pointsAwarded,
      gradedAt: verdict === null ? null : '2026-01-01T00:00:01.000Z',
      verdict,
      responseMs: null,
      answer: `Answer ${teamId}`,
    });
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team 1' },
          { teamId: 2, teamName: 'Team 2', hasLeft: true },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 2,
          },
        ],
        answers: [answerRow(1, 'correct', 2), answerRow(2, null, 0)],
      }),
    );

    expect(result.questions[0].roundId).toBe(100);
    expect(result.scoresheet).toEqual([
      {
        teamId: 1,
        questionId: 10,
        pointsAwarded: 2,
        isJoker: false,
        verdict: 'correct',
        answer: 'Answer 1',
      },
      {
        teamId: 2,
        questionId: 10,
        pointsAwarded: 0,
        isJoker: false,
        verdict: null,
        answer: 'Answer 2',
      },
    ]);
  });

  describe('with a joker round', () => {
    const answerRow = (
      teamId: number,
      questionId: number,
      isJoker: boolean,
    ) => ({
      questionId,
      teamId,
      teamName: `Team ${teamId}`,
      pointsAwarded: 2,
      gradedAt: '2026-01-01T00:00:01.000Z',
      verdict: 'correct' as const,
      responseMs: null,
      answer: 'a',
      isJoker,
    });
    const question = (questionId: number, roundId: number) => ({
      questionId,
      roundId,
      orderIndex: 0,
      prompt: 'Q',
      answer: 'A',
      type: 'free_text' as const,
      points: 2,
    });
    const jokerNight = () =>
      computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'Team 1' }],
          rounds: [
            { roundId: 100, title: 'R1', category: null, orderIndex: 0 },
            { roundId: 200, title: 'R2', category: null, orderIndex: 1 },
          ],
          questions: [question(10, 100), question(20, 200)],
          answers: [answerRow(1, 10, true), answerRow(1, 20, false)],
        }),
      );

    it('shows a joker round cell doubled and flagged, so the row adds up to the total', () => {
      const result = jokerNight();

      expect(
        result.scoresheet.map((c) => [
          c.questionId,
          c.pointsAwarded,
          c.isJoker,
        ]),
      ).toEqual([
        [10, 4, true],
        [20, 2, false],
      ]);
      expect(
        result.scoresheet.reduce((sum, c) => sum + c.pointsAwarded, 0),
      ).toBe(result.standings[0].total);
    });

    it('leaves correct rate, max points and the round and difficulty percentages raw', () => {
      const result = jokerNight();

      expect(result.maxPoints).toBe(4);
      expect(result.questions.map((q) => q.correctRate)).toEqual([1, 1]);
      expect(result.rounds.map((r) => r.pointsPercent)).toEqual([100, 100]);
      expect(result.difficulty.averagePercent).toBe(100);
    });
  });

  it('uses the participant count, departed teams included, as every denominator', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Stayed' },
          { teamId: 2, teamName: 'Kicked', hasLeft: true },
        ],
        rounds: [{ roundId: 100, title: 'R1', category: null, orderIndex: 0 }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 5,
          },
        ],
        answers: [1, 2].map((teamId) => ({
          questionId: 10,
          teamId,
          teamName: `Team ${teamId}`,
          pointsAwarded: 5,
          gradedAt: '2026-01-01T00:00:01.000Z',
          verdict: 'correct' as const,
          responseMs: null,
          answer: 'a',
        })),
      }),
    );

    expect(result.teamCount).toBe(2);
    expect(result.questions[0].correctRate).toBe(1);
    expect(result.rounds[0].correctRate).toBe(1);
    expect(result.rounds[0].pointsPercent).toBe(100);
    expect(result.standings.find((s) => s.isWinner)?.teamName).toBe('Stayed');
  });

  it('counts an ungraded answer as not correct', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 5,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: null,
            verdict: null,
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.questions[0].correctCount).toBe(0);
    expect(result.questions[0].answeredCount).toBe(1);
  });

  it('does not count partial match credit toward the correct-count', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'match',
            points: 4,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 1, // 1-of-4 pairs correct
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'partial',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.questions[0].correctCount).toBe(0);
  });

  it('counts a speed-scaled kahoot answer that earned fewer than full points as correct', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Kahoot Q',
            answer: 'A',
            type: 'multiple_choice',
            points: 1000,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 870,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 510,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.questions[0].correctCount).toBe(2);
    expect(result.questions[0].correctRate).toBe(1);
    expect(result.standings.map((row) => row.correctCount)).toEqual([1, 1]);
  });

  it('derives correctRate from points percentage for match questions, not binary correctness', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Match Q',
            answer: 'A',
            type: 'match',
            points: 4,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 1, // 1-of-4 pairs correct
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'partial',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 3, // 3-of-4 pairs correct
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'partial',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    // Both teams have only partial credit, so nobody is counted correct, but
    // correctRate reflects points earned (1 + 3) / achievable (2 * 4) = 50%.
    expect(result.questions[0].correctCount).toBe(0);
    expect(result.questions[0].correctRate).toBeCloseTo(0.5);
  });

  it('rates a round at the mean of its questions, so partial credit counts', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        rounds: [
          {
            roundId: 100,
            title: 'Round 1',
            category: 'History',
            orderIndex: 0,
          },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Match Q',
            answer: 'A',
            type: 'match',
            points: 4,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 1,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'partial',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 3,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'partial',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.rounds[0].correctRate).toBeCloseTo(0.5);
    expect(result.rounds[0].correctRate).toBe(result.questions[0].correctRate);
  });

  it('rates a free_text question at the summed shares of hand-graded partial marks', () => {
    const answer = (teamId: number, pointsAwarded: number) => ({
      questionId: 10,
      teamId,
      teamName: `Team ${teamId}`,
      pointsAwarded,
      gradedAt: '2026-01-01T00:00:01.000Z',
      verdict: 'partial' as const,
      responseMs: null,
      answer: 'a',
    });
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team 1' },
          { teamId: 2, teamName: 'Team 2' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 4,
          },
        ],
        answers: [answer(1, 1), answer(2, 3)],
      }),
    );

    // Shares 1/4 + 3/4 over 2 teams = 50%; nobody is fully correct.
    expect(result.questions[0].correctRate).toBeCloseTo(0.5);
    expect(result.questions[0].correctCount).toBe(0);
  });

  it('rates a kahoot match question at 1 when every team was correct with speed-scaled points', () => {
    const answer = (teamId: number, pointsAwarded: number) => ({
      questionId: 10,
      teamId,
      teamName: `Team ${teamId}`,
      pointsAwarded,
      gradedAt: '2026-01-01T00:00:01.000Z',
      verdict: 'correct' as const,
      responseMs: null,
      answer: 'a',
    });
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team 1' },
          { teamId: 2, teamName: 'Team 2' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Kahoot match',
            answer: 'A',
            type: 'match',
            points: 1000,
          },
        ],
        answers: [answer(1, 870), answer(2, 510)],
      }),
    );

    expect(result.questions[0].correctRate).toBe(1);
  });

  it('counts ungraded answers as 0 in a question correct rate', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 5,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: null,
            verdict: null,
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.questions[0].correctRate).toBe(0);
  });

  it('names a question with no credit the hardest over one with partial credit', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Partial',
            answer: 'A',
            type: 'free_text',
            points: 4,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Nothing',
            answer: 'A',
            type: 'free_text',
            points: 4,
          },
        ],
        rounds: [
          { roundId: 100, title: 'Round 1', category: null, orderIndex: 0 },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'partial',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 11,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'incorrect',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.highlights.hardestQuestionId).toBe(11);
    expect(result.highlights.easiestQuestionId).toBe(10);
  });

  it('breaks correctRate ties for hardest/easiest toward the earlier question', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q1',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Q2',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
        ],
        rounds: [
          { roundId: 100, title: 'Round 1', category: null, orderIndex: 0 },
        ],
        answers: [], // nobody answered either — both tie at 0% correctRate
      }),
    );

    expect(result.highlights.hardestQuestionId).toBe(10);
    expect(result.highlights.easiestQuestionId).toBe(10);
  });

  it('reports all-correct and none-correct question ids', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Everyone gets this',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Nobody gets this',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 1,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 1,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 11,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'incorrect',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.highlights.allCorrectQuestionIds).toEqual([10]);
    expect(result.highlights.noneCorrectQuestionIds).toEqual([11]);
  });

  it('reports null fastest-answer/fastest-team highlights when no responseMs is recorded', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 1,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.highlights.fastestAnswer).toBeNull();
    expect(result.highlights.fastestTeam).toBeNull();
    expect(result.standings[0].avgResponseMs).toBeNull();
    expect(result.questions[0].fastestResponseMs).toBeNull();
  });

  it('picks the fastest answer and fastest team from recorded response times', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 1,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: 5000,
            answer: 'a',
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'incorrect',
            responseMs: 1200,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.highlights.fastestAnswer).toEqual({
      teamName: 'Team B',
      questionId: 10,
      responseMs: 1200,
    });
    expect(result.highlights.fastestTeam).toEqual({
      teamName: 'Team B',
      avgResponseMs: 1200,
    });
  });

  it('breaks fastest answer and fastest team ties in the leaderboard name order (capitals before lowercase)', () => {
    const answerBy = (teamId: number, teamName: string) => ({
      questionId: 10,
      teamId,
      teamName,
      pointsAwarded: 1,
      gradedAt: '2026-01-01T00:00:01.000Z',
      verdict: 'correct' as const,
      responseMs: 2000,
      answer: 'a',
    });
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'apple' },
          { teamId: 2, teamName: 'Zed' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 1,
          },
        ],
        answers: [answerBy(1, 'apple'), answerBy(2, 'Zed')],
      }),
    );

    expect(result.highlights.fastestAnswer?.teamName).toBe('Zed');
    expect(result.highlights.fastestTeam?.teamName).toBe('Zed');
  });

  it('sums bonus points by category', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        bonusAwards: [
          { teamId: 1, category: 'shot', points: 2 },
          { teamId: 1, category: 'shot', points: 1 },
          { teamId: 1, category: 'selfie', points: 3 },
        ],
      }),
    );

    expect(result.highlights.bonus).toEqual({
      total: 6,
      count: 3,
      byCategory: { shot: 3, selfie: 3, custom: 0 },
    });
  });

  it.each([
    [100, 'Easy'],
    [75, 'Easy'],
    [60, 'Medium'],
    [50, 'Medium'],
    [30, 'Hard'],
    [25, 'Hard'],
    [10, 'Brutal'],
    [0, 'Brutal'],
  ])('labels a %d%% average as %s', (averagePercent, label) => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 100,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: averagePercent,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: averagePercent > 0 ? 'correct' : 'incorrect',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    expect(result.difficulty.averagePercent).toBe(averagePercent);
    expect(result.difficulty.label).toBe(label);
  });

  it('returns empty standings and null highlights for a session with zero teams', () => {
    const result = computeSessionDetail(
      buildInput({
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            answer: 'A',
            type: 'free_text',
            points: 5,
          },
        ],
        rounds: [
          { roundId: 100, title: 'Round 1', category: null, orderIndex: 0 },
        ],
      }),
    );

    expect(result.teamCount).toBe(0);
    expect(result.standings).toEqual([]);
    expect(result.difficulty.averagePercent).toBe(0);
    expect(result.difficulty.label).toBe('Brutal');
    expect(result.highlights.hardestQuestionId).toBeNull();
    expect(result.highlights.easiestQuestionId).toBeNull();
    expect(result.highlights.hardestRoundId).toBeNull();
    expect(result.highlights.allCorrectQuestionIds).toEqual([]);
    expect(result.highlights.noneCorrectQuestionIds).toEqual([]);
    expect(result.highlights.winningMargin).toBeNull();
    expect(result.highlights.fastestAnswer).toBeNull();
    expect(result.highlights.fastestTeam).toBeNull();
  });

  it('computes winningMargin as the gap between 1st and 2nd place, null with fewer than 2 teams', () => {
    const twoTeams = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        bonusAwards: [
          { teamId: 1, category: 'shot', points: 10 },
          { teamId: 2, category: 'shot', points: 4 },
        ],
      }),
    );
    expect(twoTeams.highlights.winningMargin).toBe(6);

    const oneTeam = computeSessionDetail(
      buildInput({ teams: [{ teamId: 1, teamName: 'Team A' }] }),
    );
    expect(oneTeam.highlights.winningMargin).toBeNull();
  });

  it('computes round correctRate and pointsPercent across a round with multiple questions', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team A' },
          { teamId: 2, teamName: 'Team B' },
        ],
        rounds: [
          {
            roundId: 100,
            title: 'Round 1',
            category: 'History',
            orderIndex: 0,
          },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q1',
            answer: 'A',
            type: 'free_text',
            points: 2,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Q2',
            answer: 'A',
            type: 'free_text',
            points: 2,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'correct',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 11,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'incorrect',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'incorrect',
            responseMs: null,
            answer: 'a',
          },
          {
            questionId: 11,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            verdict: 'incorrect',
            responseMs: null,
            answer: 'a',
          },
        ],
      }),
    );

    // 1 correct answer out of (2 teams * 2 questions) = 25%.
    expect(result.rounds[0].correctRate).toBeCloseTo(0.25);
    // 2 points earned out of (2 teams * 4 max points) = 25%.
    expect(result.rounds[0].pointsPercent).toBeCloseTo(25);
    expect(result.rounds[0].category).toBe('History');
  });

  describe('with a closest_guess question', () => {
    const answer = (
      questionId: number,
      teamId: number,
      verdict: 'correct' | 'incorrect',
    ) => ({
      questionId,
      teamId,
      teamName: `Team ${teamId}`,
      pointsAwarded: verdict === 'correct' ? 2 : 0,
      gradedAt: '2026-01-01T00:00:01.000Z',
      verdict,
      responseMs: null,
      answer: 'a',
    });
    const question = (
      questionId: number,
      roundId: number,
      type: 'closest_guess' | 'free_text',
    ) => ({
      questionId,
      roundId,
      orderIndex: 0,
      prompt: `Q${questionId}`,
      answer: 'A',
      type,
      points: 2,
    });
    const rounds = [
      { roundId: 100, title: 'Round 1', category: null, orderIndex: 0 },
      { roundId: 200, title: 'Round 2', category: null, orderIndex: 1 },
      { roundId: 300, title: 'Round 3', category: null, orderIndex: 2 },
    ];
    const build = () =>
      computeSessionDetail(
        buildInput({
          teams: [
            { teamId: 1, teamName: 'Team 1' },
            { teamId: 2, teamName: 'Team 2' },
          ],
          rounds,
          // Q10 closest_guess: one winner, so 50% would be the hardest; Q11
          // and Q12 are free_text and easier. Round 300 has only the guess.
          questions: [
            question(10, 100, 'closest_guess'),
            question(11, 100, 'free_text'),
            question(12, 200, 'free_text'),
            question(13, 300, 'closest_guess'),
          ],
          answers: [
            answer(10, 1, 'correct'),
            answer(10, 2, 'incorrect'),
            answer(11, 1, 'correct'),
            answer(11, 2, 'incorrect'),
            answer(12, 1, 'correct'),
            answer(12, 2, 'correct'),
            answer(13, 1, 'incorrect'),
            answer(13, 2, 'incorrect'),
          ],
        }),
      );

    it('has no correct rate but keeps its answered and correct counts', () => {
      const row = build().questions.find((q) => q.questionId === 10);
      expect(row?.correctRate).toBeNull();
      expect(row?.answeredCount).toBe(2);
      expect(row?.correctCount).toBe(1);
    });

    it('is never named hardest, easiest, all-correct or none-correct', () => {
      const { highlights } = build();
      expect(highlights.hardestQuestionId).toBe(11);
      expect(highlights.easiestQuestionId).toBe(12);
      expect(highlights.allCorrectQuestionIds).toEqual([12]);
      // Q13 had nobody correct, but a closest_guess is never a highlight.
      expect(highlights.noneCorrectQuestionIds).toEqual([]);
    });

    it('is left out of the round correct rate, and a round of only closest guesses has none', () => {
      const { rounds: rows, highlights } = build();
      // Round 1: only Q11 counts, 1 correct of 2 teams.
      expect(rows[0].correctRate).toBeCloseTo(0.5);
      expect(rows[1].correctRate).toBe(1);
      expect(rows[2].correctRate).toBeNull();
      expect(highlights.hardestRoundId).toBe(100);
    });
  });

  describe('response times, ordering and averages', () => {
    const question = (
      questionId: number,
      roundId: number,
      orderIndex: number,
      points = 2,
    ) => ({
      questionId,
      roundId,
      orderIndex,
      prompt: `Q${questionId}`,
      answer: 'A',
      type: 'free_text' as const,
      points,
    });
    const answer = (
      questionId: number,
      teamId: number,
      teamName: string,
      responseMs: number | null,
      pointsAwarded = 0,
    ) => ({
      questionId,
      teamId,
      teamName,
      pointsAwarded,
      gradedAt: '2026-01-01T00:00:01.000Z',
      verdict:
        pointsAwarded > 0 ? ('correct' as const) : ('incorrect' as const),
      responseMs,
      answer: 'a',
    });
    const standingsInOrder = (names: [number, string][]): SessionStandings => {
      const entries = names.map(([teamId, teamName]) => ({
        teamId,
        teamName,
        totalPoints: 0,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      }));
      const leaderboard = entries.map((e) => ({ ...e, rank: 1, rankTo: 2 }));
      return {
        leaderboard,
        departed: [],
        participantCount: entries.length,
        winner: leaderboard[0],
      };
    };

    it('names the fastest answer whatever order the answers and teams come in', () => {
      // Equal times: the name that sorts first wins (capitals before lowercase).
      const tied = [answer(10, 1, 'apple', 2000), answer(10, 2, 'Zed', 2000)];
      for (const answers of [tied, [...tied].reverse()]) {
        for (const order of [
          [
            [1, 'apple'],
            [2, 'Zed'],
          ],
          [
            [2, 'Zed'],
            [1, 'apple'],
          ],
        ] as [number, string][][]) {
          const { highlights } = computeSessionDetail(
            buildInput({
              standings: standingsInOrder(order),
              questions: [question(10, 100, 0)],
              answers,
            }),
          );
          expect(highlights.fastestAnswer?.teamName).toBe('Zed');
          expect(highlights.fastestTeam?.teamName).toBe('Zed');
        }
      }
    });

    it('prefers the quicker time over the name that sorts first', () => {
      const answers = [
        answer(10, 1, 'apple', 1000),
        answer(10, 2, 'Zed', 3000),
      ];
      for (const list of [answers, [...answers].reverse()]) {
        for (const order of [
          [
            [1, 'apple'],
            [2, 'Zed'],
          ],
          [
            [2, 'Zed'],
            [1, 'apple'],
          ],
        ] as [number, string][][]) {
          const { highlights } = computeSessionDetail(
            buildInput({
              standings: standingsInOrder(order),
              questions: [question(10, 100, 0)],
              answers: list,
            }),
          );
          expect(highlights.fastestAnswer).toEqual({
            teamName: 'apple',
            questionId: 10,
            responseMs: 1000,
          });
          expect(highlights.fastestTeam).toEqual({
            teamName: 'apple',
            avgResponseMs: 1000,
          });
        }
      }
    });

    it('keeps the first of two equally fast answers from the same team', () => {
      const { highlights } = computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'apple' }],
          questions: [question(10, 100, 0), question(11, 100, 1)],
          answers: [answer(10, 1, 'apple', 2000), answer(11, 1, 'apple', 2000)],
        }),
      );

      expect(highlights.fastestAnswer?.questionId).toBe(10);
    });

    it('averages a team response times and takes the minimum per question', () => {
      const result = computeSessionDetail(
        buildInput({
          teams: [
            { teamId: 1, teamName: 'A' },
            { teamId: 2, teamName: 'B' },
          ],
          questions: [question(10, 100, 0), question(11, 100, 1)],
          answers: [
            answer(10, 1, 'A', 1000),
            answer(11, 1, 'A', 3000),
            answer(10, 2, 'B', 4000),
            answer(11, 2, 'B', null),
          ],
        }),
      );

      const byTeam = new Map(result.standings.map((s) => [s.teamId, s]));
      expect(byTeam.get(1)?.avgResponseMs).toBe(2000);
      expect(byTeam.get(2)?.avgResponseMs).toBe(4000);
      const byQuestion = new Map(
        result.questions.map((q) => [q.questionId, q]),
      );
      expect(byQuestion.get(10)?.fastestResponseMs).toBe(1000);
      // Only team A's 3000: the untimed answer and the other question's are left out.
      expect(byQuestion.get(11)?.fastestResponseMs).toBe(3000);
    });

    it('gives a question with no timed answer no fastest time', () => {
      const result = computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'A' }],
          questions: [question(10, 100, 0), question(11, 100, 1)],
          answers: [answer(10, 1, 'A', 500)],
        }),
      );

      expect(result.questions.map((q) => q.fastestResponseMs)).toEqual([
        500,
        null,
      ]);
    });

    it('orders rounds, then questions within a round, by their order index', () => {
      const result = computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'A' }],
          rounds: [
            { roundId: 300, title: 'Third', category: null, orderIndex: 2 },
            { roundId: 100, title: 'First', category: null, orderIndex: 0 },
            { roundId: 200, title: 'Second', category: null, orderIndex: 1 },
          ],
          questions: [
            question(31, 300, 0),
            question(12, 100, 1),
            question(21, 200, 0),
            question(11, 100, 0),
          ],
        }),
      );

      expect(result.rounds.map((r) => r.roundId)).toEqual([100, 200, 300]);
      expect(result.questions.map((q) => q.questionId)).toEqual([
        11, 12, 21, 31,
      ]);
      expect(result.questions.map((q) => q.roundTitle)).toEqual([
        'First',
        'First',
        'Second',
        'Third',
      ]);
    });

    it('gives a question of an unlisted round an empty round title', () => {
      const result = computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'A' }],
          questions: [question(10, 999, 0)],
        }),
      );

      expect(result.questions[0].roundTitle).toBe('');
    });

    it('counts only a question own answers', () => {
      const result = computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'A' }],
          questions: [question(10, 100, 0), question(11, 100, 1)],
          answers: [answer(10, 1, 'A', 700), answer(11, 1, 'A', 300)],
        }),
      );

      expect(result.questions.map((q) => q.fastestResponseMs)).toEqual([
        700, 300,
      ]);
    });

    it('works the quiz difficulty out as the average team points over the maximum', () => {
      // Max 4; two teams, 3 answer points in all: 1.5 each = 37.5%.
      const result = computeSessionDetail(
        buildInput({
          teams: [
            { teamId: 1, teamName: 'A' },
            { teamId: 2, teamName: 'B' },
          ],
          questions: [question(10, 100, 0, 4)],
          answers: [answer(10, 1, 'A', null, 2), answer(10, 2, 'B', null, 1)],
        }),
      );

      expect(result.difficulty.averagePercent).toBe(37.5);
      expect(result.difficulty.label).toBe('Hard');
    });

    it('has zero difficulty and round percentage when no question is worth points', () => {
      const result = computeSessionDetail(
        buildInput({
          teams: [{ teamId: 1, teamName: 'A' }],
          rounds: [{ roundId: 100, title: 'R', category: null, orderIndex: 0 }],
          questions: [question(10, 100, 0, 0)],
          answers: [answer(10, 1, 'A', null, 0)],
        }),
      );

      expect(result.difficulty.averagePercent).toBe(0);
      expect(result.rounds[0].pointsPercent).toBe(0);
    });
  });
});
