import { GameSession } from '@/db/entities/game-session.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { Round } from '@/db/entities/round.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';
import { StandingsService } from '@/standings/standings.service';

describe('StandingsService (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();
  let standings: StandingsService;

  beforeEach(() => {
    standings = new StandingsService(
      state.em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
    );
  });

  async function addQuestion(orderIndex: number, round: Round = state.round) {
    const question = state.em.create(Question, {
      round,
      orderIndex,
      type: 'free_text',
      prompt: `Question ${orderIndex}`,
      answer: 'Reference',
      points: 1,
    });
    await state.em.flush();
    return question;
  }

  async function scoreAnswer(
    questionId: number,
    teamId: number,
    points: number,
  ) {
    const { answerId } = await state.answerService.submit(
      state.session.id,
      questionId,
      teamId,
      'guess',
    );
    await state.answerService.grade(state.session.id, answerId, points);
  }

  async function awardBonus(
    team: Awaited<ReturnType<typeof insertTeam>>,
    points: number,
  ) {
    state.em.create(BonusAward, {
      gameSession: state.session,
      team,
      category: 'custom',
      reason: 'Because',
      points,
    });
    await state.em.flush();
  }

  it('lists a roster team with no answers at zero', async () => {
    const team = await insertTeam('Quiet Team', 'token-q');

    const { leaderboard } = await standings.forSession(state.session.id);

    expect(leaderboard).toEqual([
      {
        teamId: team.id,
        teamName: 'Quiet Team',
        totalPoints: 0,
        rank: 1,
        rankTo: 1,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
      },
    ]);
  });

  it('ranks a team with answers only above a team with a bonus only', async () => {
    const answerer = await insertTeam('Answerer', 'token-a');
    const bonusTeam = await insertTeam('Bonus Team', 'token-b');
    await scoreAnswer(state.question.id, answerer.id, 3);
    await awardBonus(bonusTeam, 2);

    const { leaderboard } = await standings.forSession(state.session.id);

    expect(leaderboard).toEqual([
      expect.objectContaining({
        teamName: 'Answerer',
        totalPoints: 3,
        bonusPoints: 0,
        rank: 1,
        rankTo: 1,
        roundPoints: [{ roundTitle: 'Round 1', points: 3 }],
      }),
      expect.objectContaining({
        teamName: 'Bonus Team',
        totalPoints: 2,
        bonusPoints: 2,
        positiveBonusPoints: 2,
        rank: 2,
        rankTo: 2,
        roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
      }),
    ]);
  });

  it('nets a penalty into the total but reports positive and negative bonuses separately', async () => {
    const team = await insertTeam('Team A', 'token-a');
    await scoreAnswer(state.question.id, team.id, 5);
    await awardBonus(team, 3);
    await awardBonus(team, -4);

    const { leaderboard } = await standings.forSession(state.session.id);

    expect(leaderboard[0]).toEqual(
      expect.objectContaining({
        totalPoints: 4,
        bonusPoints: -1,
        positiveBonusPoints: 3,
        negativeBonusPoints: -4,
      }),
    );
  });

  it('gives teams tied on total a shared rank, in name order, with the next rank skipping the tie', async () => {
    const zed = await insertTeam('Zed', 'token-z');
    const amy = await insertTeam('Amy', 'token-a');
    const leader = await insertTeam('Leader', 'token-l');
    const last = await insertTeam('Last', 'token-x');
    await scoreAnswer(state.question.id, leader.id, 5);
    await scoreAnswer(state.question.id, zed.id, 2);
    await scoreAnswer(state.question.id, amy.id, 2);
    await scoreAnswer(state.question.id, last.id, 1);

    const { leaderboard } = await standings.forSession(state.session.id);

    expect(leaderboard.map((e) => [e.teamName, e.rank, e.rankTo])).toEqual([
      ['Leader', 1, 1],
      ['Amy', 2, 3],
      ['Zed', 2, 3],
      ['Last', 4, 4],
    ]);
  });

  it('names one winner when a showdown bonus breaks a tie for first', async () => {
    const amy = await insertTeam('Amy', 'token-a');
    const zed = await insertTeam('Zed', 'token-z');
    await scoreAnswer(state.question.id, amy.id, 4);
    await scoreAnswer(state.question.id, zed.id, 4);
    await awardBonus(zed, 1);

    const { leaderboard, winner } = await standings.forSession(
      state.session.id,
    );

    expect(winner?.teamName).toBe('Zed');
    expect(leaderboard.filter((e) => e.rank === 1)).toHaveLength(1);
    expect(leaderboard.map((e) => e.teamName)).toEqual(['Zed', 'Amy']);
  });

  it('falls back to name order for the winner when a tie for first is unbroken', async () => {
    await insertTeam('Zed', 'token-z');
    await insertTeam('Amy', 'token-a');

    const { leaderboard, winner } = await standings.forSession(
      state.session.id,
    );

    expect(winner?.teamName).toBe('Amy');
    expect(leaderboard.map((e) => e.rank)).toEqual([1, 1]);
  });

  it('has no winner for an empty roster', async () => {
    const { leaderboard, winner } = await standings.forSession(
      state.session.id,
    );

    expect(leaderboard).toEqual([]);
    expect(winner).toBeUndefined();
  });

  it("reports per-round points for the session's current quiz, in round order", async () => {
    const round2 = state.em.create(Round, {
      quiz: state.round.quiz,
      title: 'Round 2',
      orderIndex: 1,
    });
    const question2 = await addQuestion(0, round2);
    const team = await insertTeam('Team A', 'token-a');
    await scoreAnswer(state.question.id, team.id, 2);
    await scoreAnswer(question2.id, team.id, 3);

    const { leaderboard } = await standings.forSession(state.session.id);

    expect(leaderboard[0].roundPoints).toEqual([
      { roundTitle: 'Round 1', points: 2 },
      { roundTitle: 'Round 2', points: 3 },
    ]);
    expect(leaderboard[0].totalPoints).toBe(5);
  });

  it('does not fan out when a team has several answers and several bonus awards', async () => {
    const question2 = await addQuestion(1);
    const team = await insertTeam('Team A', 'token-a');
    await scoreAnswer(state.question.id, team.id, 2);
    await scoreAnswer(question2.id, team.id, 3);
    await awardBonus(team, 1);
    await awardBonus(team, 4);
    await awardBonus(team, -2);

    const { leaderboard } = await standings.forSession(state.session.id);

    expect(leaderboard[0]).toEqual(
      expect.objectContaining({
        totalPoints: 8,
        bonusPoints: 3,
        positiveBonusPoints: 5,
        negativeBonusPoints: -2,
        roundPoints: [{ roundTitle: 'Round 1', points: 5 }],
      }),
    );
  });

  async function removeFromRoster(
    team: Awaited<ReturnType<typeof insertTeam>>,
  ) {
    await state.em.nativeDelete(GameSessionTeam, {
      gameSession: state.session.id,
      team: team.id,
    });
  }

  it('lists a kicked team with graded answers as departed: unranked, counted, never the winner', async () => {
    const kicked = await insertTeam('Kicked High Scorer', 'token-k');
    const best = await insertTeam('Best Roster Team', 'token-b');
    await scoreAnswer(state.question.id, kicked.id, 9);
    await scoreAnswer(state.question.id, best.id, 2);
    await removeFromRoster(kicked);

    const standings_ = await standings.forSession(state.session.id);

    expect(standings_.leaderboard.map((e) => e.teamName)).toEqual([
      'Best Roster Team',
    ]);
    expect(standings_.winner?.teamName).toBe('Best Roster Team');
    expect(standings_.departed).toEqual([
      expect.objectContaining({
        teamId: kicked.id,
        totalPoints: 9,
        roundPoints: [{ roundTitle: 'Round 1', points: 9 }],
      }),
    ]);
    expect(standings_.departed[0]).not.toHaveProperty('rank');
    expect(standings_.participantCount).toBe(2);
  });

  it('counts a team that left with only a bonus, and a roster team with nothing, as participants', async () => {
    const leaver = await insertTeam('Leaver', 'token-l');
    await insertTeam('Quiet Team', 'token-q');
    await awardBonus(leaver, 3);
    await removeFromRoster(leaver);

    const result = await standings.forSession(state.session.id);

    expect(result.leaderboard.map((e) => [e.teamName, e.totalPoints])).toEqual([
      ['Quiet Team', 0],
    ]);
    expect(result.departed).toEqual([
      expect.objectContaining({
        teamName: 'Leaver',
        totalPoints: 3,
        bonusPoints: 3,
      }),
    ]);
    expect(result.participantCount).toBe(2);
  });

  it('orders departed teams by total, highest first', async () => {
    const low = await insertTeam('Low', 'token-1');
    const high = await insertTeam('High', 'token-2');
    await scoreAnswer(state.question.id, low.id, 1);
    await scoreAnswer(state.question.id, high.id, 4);
    await removeFromRoster(low);
    await removeFromRoster(high);

    const result = await standings.forSession(state.session.id);

    expect(result.departed.map((t) => t.teamName)).toEqual(['High', 'Low']);
    expect(result.winner).toBeUndefined();
  });

  it("returns each session's own standings when asked for several at once", async () => {
    const otherSession = state.em.create(GameSession, {
      quiz: state.round.quiz,
      joinCode: 'OTHER1',
    });
    await state.em.flush();
    const here = await insertTeam('Here Team', 'token-h');
    const there = state.em.create(Team, {
      name: 'There Team',
      token: 'token-t',
      code: 'code-token-t',
    });
    state.em.create(GameSessionTeam, {
      gameSession: otherSession,
      team: there,
    });
    await state.em.flush();
    await scoreAnswer(state.question.id, here.id, 2);
    await state.answerService.submit(
      otherSession.id,
      state.question.id,
      there.id,
      'guess',
    );

    const bySession = await standings.forSessions([
      state.session.id,
      otherSession.id,
    ]);

    expect(
      bySession.get(state.session.id)?.leaderboard.map((e) => e.teamName),
    ).toEqual(['Here Team']);
    expect(
      bySession.get(otherSession.id)?.leaderboard.map((e) => e.teamName),
    ).toEqual(['There Team']);
    expect(bySession.get(state.session.id)?.leaderboard[0].totalPoints).toBe(2);
  });
});
