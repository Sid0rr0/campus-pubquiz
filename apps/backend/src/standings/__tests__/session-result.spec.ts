import type { LeaderboardEntry } from '@campus-pubquiz/types';
import {
  sessionResult,
  type SessionResultInput,
} from '@/standings/session-result';
import type {
  DepartedTeam,
  SessionStandings,
} from '@/standings/standings.service';

function ranked(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank: number,
  rankTo = rank,
  bonusPoints = 0,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo,
    bonusPoints,
    positiveBonusPoints: Math.max(bonusPoints, 0),
    negativeBonusPoints: Math.min(bonusPoints, 0),
    roundPoints: [],
  };
}

function departedTeam(
  teamId: number,
  teamName: string,
  totalPoints: number,
): DepartedTeam {
  const {
    rank: _rank,
    rankTo: _rankTo,
    ...rest
  } = ranked(teamId, teamName, totalPoints, 1);
  return rest;
}

function standingsOf(
  leaderboard: LeaderboardEntry[],
  departed: DepartedTeam[] = [],
): SessionStandings {
  return {
    leaderboard,
    departed,
    participantCount: leaderboard.length + departed.length,
    winner: leaderboard[0],
  };
}

function input(
  standings: SessionStandings,
  overrides: Partial<Omit<SessionResultInput, 'standings'>> = {},
): SessionResultInput {
  return { standings, questions: [], answers: [], ...overrides };
}

const question = (
  id: number,
  points = 2,
  type: SessionResultInput['questions'][number]['type'] = 'free_text',
) => ({ id, roundId: 1, type, points });

const answer = (
  questionId: number,
  teamId: number,
  verdict: 'correct' | 'partial' | 'incorrect' | null,
  pointsAwarded = 0,
) => ({ questionId, teamId, verdict, pointsAwarded });

describe('sessionResult', () => {
  it('gives a tie for first the night won for every tied team and the session winner to one', () => {
    const result = sessionResult(
      input(
        standingsOf([
          ranked(1, 'Alpha', 5, 1, 2),
          ranked(2, 'Beta', 5, 1, 2),
          ranked(3, 'Gamma', 1, 3),
        ]),
      ),
    );

    expect(result.teams.map((t) => t.wonNight)).toEqual([true, true, false]);
    expect(result.teams.map((t) => t.isSessionWinner)).toEqual([
      true,
      false,
      false,
    ]);
    expect(result.teams[0]).toMatchObject({ placing: 1, placingTo: 2 });
  });

  it('gives a team that left no placing and no win, but counts it as a participant', () => {
    const result = sessionResult(
      input(
        standingsOf([ranked(1, 'Alpha', 5, 1)], [departedTeam(9, 'Gone', 8)]),
      ),
    );

    expect(result.participantCount).toBe(2);
    expect(result.teams.map((t) => t.teamId)).toEqual([1, 9]);
    expect(result.teams[1]).toMatchObject({
      hasLeft: true,
      placing: null,
      placingTo: null,
      wonNight: false,
      isSessionWinner: false,
      totalPoints: 8,
    });
  });

  it('keeps the placing of a rostered team that answered nothing', () => {
    const result = sessionResult(
      input(standingsOf([ranked(1, 'Alpha', 0, 1)]), {
        questions: [question(10)],
      }),
    );

    expect(result.teams[0]).toMatchObject({
      answered: false,
      placing: 1,
      correctCount: 0,
    });
  });

  it('counts answered and correct answers per team', () => {
    const result = sessionResult(
      input(standingsOf([ranked(1, 'Alpha', 3, 1), ranked(2, 'Beta', 0, 2)]), {
        questions: [question(10), question(11)],
        answers: [
          answer(10, 1, 'correct', 2),
          answer(11, 1, 'partial', 1),
          answer(10, 2, 'incorrect'),
        ],
      }),
    );

    expect(result.teams[0]).toMatchObject({ answered: true, correctCount: 1 });
    expect(result.teams[1]).toMatchObject({ answered: true, correctCount: 0 });
  });

  it('gives a closest_guess question no correct rate but keeps its counts', () => {
    const result = sessionResult(
      input(standingsOf([ranked(1, 'Alpha', 2, 1), ranked(2, 'Beta', 0, 2)]), {
        questions: [question(10, 2, 'closest_guess')],
        answers: [answer(10, 1, 'correct', 2), answer(10, 2, 'incorrect')],
      }),
    );

    expect(result.questions).toEqual([
      { questionId: 10, answeredCount: 2, correctCount: 1, correctRate: null },
    ]);
  });

  it('counts a partial answer by its share and a speed-scaled correct answer in full', () => {
    const result = sessionResult(
      input(standingsOf([ranked(1, 'Alpha', 0, 1), ranked(2, 'Beta', 0, 2)]), {
        questions: [question(10, 4)],
        answers: [answer(10, 1, 'partial', 1), answer(10, 2, 'correct', 1)],
      }),
    );

    // (0.25 + 1) credit over two participants
    expect(result.questions[0]!.correctRate).toBeCloseTo(0.625);
  });

  it('has no rates when nobody took part', () => {
    const result = sessionResult(
      input(standingsOf([]), { questions: [question(10)] }),
    );

    expect(result.participantCount).toBe(0);
    expect(result.questions[0]).toMatchObject({
      answeredCount: 0,
      correctRate: null,
    });
  });

  it('takes totals from Standings unchanged, bonus included', () => {
    const result = sessionResult(
      input(standingsOf([ranked(1, 'Alpha', 7, 1, 1, 3)]), {
        questions: [question(10)],
        answers: [answer(10, 1, 'correct', 99)],
      }),
    );

    expect(result.teams[0]).toMatchObject({
      totalPoints: 7,
      bonusPoints: 3,
      answerPoints: 4,
    });
  });

  it('sums the questions points into max points', () => {
    const result = sessionResult(
      input(standingsOf([ranked(1, 'Alpha', 0, 1)]), {
        questions: [question(10, 2), question(11, 3)],
      }),
    );

    expect(result.maxPoints).toBe(5);
  });
});
