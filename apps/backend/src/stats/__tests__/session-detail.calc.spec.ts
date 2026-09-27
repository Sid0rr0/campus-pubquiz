import {
  computeSessionDetail,
  type SessionDetailInput,
} from '@/stats/session-detail.calc';

const BASE_SESSION = {
  gameSessionId: 1,
  joinCode: 'ABCDEF',
  quizTitle: 'Quiz Night',
  playedAt: '2026-01-01T00:00:00.000Z',
};

function buildInput(
  overrides: Partial<SessionDetailInput>,
): SessionDetailInput {
  return {
    session: BASE_SESSION,
    teams: [],
    rounds: [],
    questions: [],
    answers: [],
    bonusAwards: [],
    ...overrides,
  };
}

describe('computeSessionDetail', () => {
  it('ranks standings by total (answer + bonus) desc, team name asc on ties', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [
          { teamId: 1, teamName: 'Team B' },
          { teamId: 2, teamName: 'Team A' },
        ],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
            type: 'free_text',
            points: 5,
          },
        ],
        answers: [
          {
            questionId: 10,
            teamId: 1,
            teamName: 'Team B',
            pointsAwarded: 5,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team A',
            pointsAwarded: 5,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
          },
        ],
      }),
    );

    expect(result.standings.map((s) => s.teamName)).toEqual([
      'Team A',
      'Team B',
    ]);
    expect(result.standings.map((s) => s.rank)).toEqual([1, 2]);
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
            type: 'audio',
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
            responseMs: null,
          },
        ],
      }),
    );

    expect(result.questions[0].correctCount).toBe(0);
    expect(result.questions[0].answeredCount).toBe(1);
  });

  it('counts partial match credit (points > 0, graded) as correct', () => {
    const result = computeSessionDetail(
      buildInput({
        teams: [{ teamId: 1, teamName: 'Team A' }],
        questions: [
          {
            questionId: 10,
            roundId: 100,
            orderIndex: 0,
            prompt: 'Q',
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
            responseMs: null,
          },
        ],
      }),
    );

    expect(result.questions[0].correctCount).toBe(1);
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
            type: 'free_text',
            points: 1,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Q2',
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
            type: 'free_text',
            points: 1,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Nobody gets this',
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
            responseMs: null,
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 1,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
          },
          {
            questionId: 11,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
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
            responseMs: null,
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
            responseMs: 5000,
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: 1200,
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
            responseMs: null,
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
            type: 'free_text',
            points: 2,
          },
          {
            questionId: 11,
            roundId: 100,
            orderIndex: 1,
            prompt: 'Q2',
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
            responseMs: null,
          },
          {
            questionId: 11,
            teamId: 1,
            teamName: 'Team A',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
          },
          {
            questionId: 10,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
          },
          {
            questionId: 11,
            teamId: 2,
            teamName: 'Team B',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:01.000Z',
            responseMs: null,
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
});
