import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
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
      new StandingsService(
        em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
          GameSessionTeam,
        ),
      ),
      new PlayerCountService(
        em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
          SessionPlayerCount,
        ),
      ),
    );
    controller = new TeamPageController(history);
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
      });
      expect(page).not.toHaveProperty('id');
      expect(JSON.stringify(page)).not.toContain(team.code);
    }
    const kicked = await controller.history({ teamCode: teams.Kicked.code });
    expect(kicked.sessions.every((row) => row.hasLeft)).toBe(true);
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

  it('is throttled and open without a session cookie', () => {
    const guards = Reflect.getMetadata('__guards__', TeamPageController) as
      | unknown[]
      | undefined;
    expect(guards).toEqual([ThrottlerGuard]);
  });
});
