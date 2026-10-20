import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { LeagueTableService } from '@/league/league-table.service';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { Team } from '@/db/entities/team.entity';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { buildEndedSessionsRead } from '@/ended-sessions-read/__tests__/ended-sessions-read-test-utils';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import { TeamHistoryService } from '@/team/team-history.service';
import { TeamPageController } from '@/team/team-page.controller';
import { useTestDatabase } from '@/test-db/test-database';

describe('TeamPageController (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let history: TeamHistoryService;
  let controller: TeamPageController;
  let joinCounter = 0;

  beforeEach(() => {
    em = db.orm.em.fork();
    joinCounter = 0;
    history = new TeamHistoryService(
      em.getRepository<Team, TeamRepository>(Team),
      buildStandingsService(em),
      new PlayerCountService(
        em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
          SessionPlayerCount,
        ),
      ),
      buildEndedSessionsRead(em),
    );
    controller = new TeamPageController(
      history,
      new LeagueTableService(
        em.getRepository<League, LeagueRepository>(League),
        em.getRepository<LeagueSession, LeagueSessionRepository>(LeagueSession),
        buildStandingsService(em),
        buildEndedSessionsRead(em),
      ),
    );
  });

  /** An ended session where each team scores the given points on the quiz's one question. */
  async function playEndedSession(
    scores: Record<string, number>,
    leavers: string[] = [],
  ): Promise<Record<string, Team>> {
    const quiz = em.create(Quiz, { title: 'Quiz' });
    const round = em.create(Round, { quiz, title: 'Round 1', orderIndex: 0 });
    const question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Q',
      answer: 'answer',
      points: 10,
    });
    joinCounter += 1;
    const session = em.create(GameSession, {
      quiz,
      joinCode: `CODE${joinCounter}`,
      status: 'ended',
    });
    const teams: Record<string, Team> = {};
    for (const [name, points] of Object.entries(scores)) {
      teams[name] =
        (await em.findOne(Team, { name })) ??
        em.create(Team, {
          name,
          token: `${name}-token`,
          code: `${name.toUpperCase()}1`,
        });
      if (!leavers.includes(name)) {
        em.create(GameSessionTeam, { gameSession: session, team: teams[name] });
      }
      em.create(Answer, {
        gameSession: session,
        question,
        team: teams[name],
        value: 'value',
        pointsAwarded: points,
        gradedAt: new Date(),
        verdict: points > 0 ? 'correct' : 'incorrect',
      });
    }
    await em.flush();
    return teams;
  }

  it('gives a right code the same figures as the staff team page, minus staff-only fields', async () => {
    const teams = await playEndedSession({ Alpha: 10, Beta: 5, Kicked: 3 }, [
      'Kicked',
    ]);
    await playEndedSession({ Alpha: 4, Beta: 8, Kicked: 0 }, ['Kicked']);

    for (const [name, team] of Object.entries(teams)) {
      const page = await controller.history({ teamCode: team.code });
      const staff = await history.detail(team.id);

      expect(page).toEqual({
        name,
        summary: staff!.summary,
        sessions: staff!.sessions,
        leagues: [],
      });
      expect(page).not.toHaveProperty('id');
      expect(JSON.stringify(page)).not.toContain(team.code);
    }
    const kicked = await controller.history({ teamCode: teams.Kicked.code });
    expect(kicked.sessions.every((row) => row.hasLeft)).toBe(true);
  });

  it('adds the position in each current league the team has points in', async () => {
    const teams = await playEndedSession({ Alpha: 10, Beta: 5, Solo: 5 });
    const [session] = await em.find(GameSession, {});
    const current = em.create(League, {
      name: 'Autumn',
      startsOn: '2019-09-01',
      endsOn: '2999-12-31',
    });
    const past = em.create(League, {
      name: 'Past',
      startsOn: '2019-09-01',
      endsOn: '2020-01-31',
    });
    em.create(LeagueSession, { league: current, gameSession: session });
    em.create(LeagueSession, { league: past, gameSession: session });
    await em.flush();

    const alpha = await controller.history({ teamCode: teams.Alpha.code });
    const beta = await controller.history({ teamCode: teams.Beta.code });

    expect(alpha.leagues).toEqual([
      {
        leagueId: current.id,
        leagueName: 'Autumn',
        position: 1,
        shared: false,
        teamCount: 3,
        leaguePoints: 6,
      },
    ]);
    expect(beta.leagues[0]).toMatchObject({ position: 2, shared: true });
  });

  it('accepts the code in any case with surrounding spaces', async () => {
    const teams = await playEndedSession({ Alpha: 10 });

    const page = await controller.history({
      teamCode: ` ${teams.Alpha.code.toLowerCase()} `,
    });

    expect(page.name).toBe('Alpha');
  });

  it('answers an unknown code with a generic 404', async () => {
    await playEndedSession({ Alpha: 10 });

    await expect(controller.history({ teamCode: 'NOPE99' })).rejects.toThrow(
      new NotFoundException('No team with that code'),
    );
  });

  it('rejects a body without a usable team code', async () => {
    await expect(controller.history({})).rejects.toThrow(BadRequestException);
    await expect(controller.history({ teamCode: '  ' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.history({ teamCode: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('a night in detail', () => {
    /** A quiz of two rounds: a free-text question, then a sort and a match question. */
    async function createNight(status: 'ended' | 'question_open' = 'ended') {
      const quiz = em.create(Quiz, { title: 'Night quiz' });
      const round1 = em.create(Round, {
        quiz,
        title: 'Warm-up',
        orderIndex: 0,
      });
      const round2 = em.create(Round, { quiz, title: 'Finale', orderIndex: 1 });
      const text = em.create(Question, {
        round: round1,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
      });
      const sort = em.create(Question, {
        round: round2,
        orderIndex: 0,
        type: 'sort',
        prompt: 'Smallest first',
        answer: 'a|b|c',
        payload: { options: ['c', 'a', 'b'] },
        points: 6,
      });
      const match = em.create(Question, {
        round: round2,
        orderIndex: 1,
        type: 'match',
        prompt: 'Pair up',
        answer: 'x|y',
        payload: { options: ['one', 'two'], matchTargets: ['y', 'x'] },
        points: 4,
      });
      const session = em.create(GameSession, {
        quiz,
        joinCode: `NIGHT${(joinCounter += 1)}`,
        status,
      });
      await em.flush();
      return { session, text, sort, match };
    }

    async function joinTeam(
      name: string,
      session: GameSession,
      onRoster = true,
    ) {
      const team = em.create(Team, {
        name,
        token: `${name}-token`,
        code: `${name.toUpperCase()}1`,
      });
      if (onRoster) em.create(GameSessionTeam, { gameSession: session, team });
      await em.flush();
      return team;
    }

    it("returns every question in order with the team's own answers, verdicts and the right answers", async () => {
      const night = await createNight();
      const alpha = await joinTeam('Alpha', night.session);
      const beta = await joinTeam('Beta', night.session);
      const answer = (
        team: Team,
        question: Question,
        value: string,
        pointsAwarded: number,
        verdict: 'correct' | 'partial' | 'incorrect',
      ) =>
        em.create(Answer, {
          gameSession: night.session,
          question,
          team,
          value,
          pointsAwarded,
          gradedAt: new Date(),
          verdict,
        });
      answer(alpha, night.text, 'Paris', 10, 'correct');
      answer(alpha, night.sort, 'a|c|b', 0, 'incorrect');
      answer(beta, night.text, 'Lyon-secret-beta', 0, 'incorrect');
      answer(beta, night.match, 'x|y', 4, 'correct');
      await em.flush();

      const detail = await controller.night(night.session.id, {
        teamCode: alpha.code,
      });

      expect(detail.gameSessionId).toBe(night.session.id);
      expect(detail.questions).toEqual([
        {
          questionId: night.text.id,
          roundTitle: 'Warm-up',
          roundNumber: 1,
          questionNumber: 1,
          prompt: 'Capital of France?',
          type: 'free_text',
          answerKind: 'text',
          points: 10,
          teamAnswer: 'Paris',
          verdict: 'correct',
          pointsAwarded: 10,
          correctAnswer: 'Paris',
        },
        {
          questionId: night.sort.id,
          roundTitle: 'Finale',
          roundNumber: 2,
          questionNumber: 1,
          prompt: 'Smallest first',
          type: 'sort',
          answerKind: 'sort',
          points: 6,
          teamAnswer: 'a → c → b',
          verdict: 'incorrect',
          pointsAwarded: 0,
          correctAnswer: 'a → b → c',
        },
        {
          questionId: night.match.id,
          roundTitle: 'Finale',
          roundNumber: 2,
          questionNumber: 2,
          prompt: 'Pair up',
          type: 'match',
          answerKind: 'match',
          points: 4,
          teamAnswer: null,
          verdict: null,
          pointsAwarded: 0,
          correctAnswer: 'one → x, two → y',
        },
      ]);
      expect(JSON.stringify(detail)).not.toContain('Lyon-secret-beta');
    });

    it('answers a session that has not ended with a 404', async () => {
      const night = await createNight('question_open');
      const alpha = await joinTeam('Alpha', night.session);

      await expect(
        controller.night(night.session.id, { teamCode: alpha.code }),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers a session the team never joined, and an unknown session or code, with a 404', async () => {
      const night = await createNight();
      const outsider = await joinTeam('Outsider', night.session, false);
      const alpha = await joinTeam('Alpha', night.session);

      await expect(
        controller.night(night.session.id, { teamCode: outsider.code }),
      ).rejects.toThrow(new NotFoundException('No team with that code'));
      await expect(
        controller.night(night.session.id + 999, { teamCode: alpha.code }),
      ).rejects.toThrow(new NotFoundException('No team with that code'));
      await expect(
        controller.night(night.session.id, { teamCode: 'NOPE99' }),
      ).rejects.toThrow(new NotFoundException('No team with that code'));
    });

    it('still shows a kicked team its answers', async () => {
      const night = await createNight();
      const kicked = await joinTeam('Kicked', night.session, false);
      em.create(Answer, {
        gameSession: night.session,
        question: night.text,
        team: kicked,
        value: 'Paris',
        pointsAwarded: 10,
        gradedAt: new Date(),
        verdict: 'correct',
      });
      await em.flush();

      const detail = await controller.night(night.session.id, {
        teamCode: kicked.code,
      });

      expect(detail.questions[0].teamAnswer).toBe('Paris');
    });

    it('rejects a body without a usable team code', async () => {
      await expect(controller.night(1, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it('is throttled and open without a session cookie', () => {
    const guards = Reflect.getMetadata('__guards__', TeamPageController) as
      | unknown[]
      | undefined;
    expect(guards).toEqual([ThrottlerGuard]);
  });
});
