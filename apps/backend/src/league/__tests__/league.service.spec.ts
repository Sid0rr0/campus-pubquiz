import type { EntityManager } from '@mikro-orm/postgresql';
import type { GameStatus } from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import type { GameSessionRepository } from '@/db/repositories/game-session.repository';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import {
  LeagueNotFoundError,
  LeagueService,
  SessionNotEndedError,
  SessionNotFoundError,
} from '@/league/league.service';
import { useTestDatabase } from '@/test-db/test-database';

describe('LeagueService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let service: LeagueService;
  let quiz: Quiz;
  let joinCounter = 0;

  beforeEach(async () => {
    em = db.orm.em.fork();
    joinCounter = 0;
    service = new LeagueService(
      em.getRepository<League, LeagueRepository>(League),
      em.getRepository<LeagueSession, LeagueSessionRepository>(LeagueSession),
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
    );
    quiz = em.create(Quiz, { title: 'Movie Night' });
    await em.flush();
  });

  async function createSession(
    status: GameStatus = 'ended',
    name: string | null = null,
  ): Promise<GameSession> {
    joinCounter += 1;
    const session = em.create(GameSession, {
      quiz,
      joinCode: `CODE${joinCounter}`,
      status,
      name,
    });
    await em.flush();
    return session;
  }

  const fields = {
    name: 'Autumn 2026',
    startsOn: '2026-09-01',
    endsOn: '2026-12-20',
  };

  it('creates a league, which lists with no sessions', async () => {
    const created = await service.create(fields);

    expect(created).toMatchObject({ ...fields, sessions: [] });
    const { items } = await service.list({});
    expect(items.map((league) => league.id)).toEqual([created.id]);
  });

  it('updates a league name and dates', async () => {
    const created = await service.create(fields);

    const updated = await service.update(created.id, {
      name: 'Autumn',
      startsOn: '2026-09-07',
      endsOn: '2026-12-21',
    });

    expect(updated).toMatchObject({
      name: 'Autumn',
      startsOn: '2026-09-07',
      endsOn: '2026-12-21',
    });
  });

  it('updating or deleting an unknown league is a not-found error', async () => {
    await expect(service.update(99, fields)).rejects.toThrow(
      LeagueNotFoundError,
    );
    await expect(service.remove(99)).rejects.toThrow(LeagueNotFoundError);
  });

  describe('sessions in a league', () => {
    it('adds an ended session, listed by its display name', async () => {
      const league = await service.create(fields);
      const named = await createSession('ended', 'Quiz Night 4');
      const unnamed = await createSession('ended');

      await service.addSession(league.id, named.id);
      await service.addSession(league.id, unnamed.id);

      const [listed] = (await service.list({})).items;
      expect(listed?.sessions.map((s) => s.name).sort()).toEqual([
        'Movie Night',
        'Quiz Night 4',
      ]);
      expect(listed?.sessions.map((s) => s.gameSessionId).sort()).toEqual(
        [named.id, unnamed.id].sort(),
      );
    });

    it('adding the same session twice leaves one membership', async () => {
      const league = await service.create(fields);
      const session = await createSession();

      await service.addSession(league.id, session.id);
      await service.addSession(league.id, session.id);

      const [listed] = (await service.list({})).items;
      expect(listed?.sessions).toHaveLength(1);
    });

    it('refuses a session that has not ended', async () => {
      const league = await service.create(fields);
      const live = await createSession('lobby');

      await expect(service.addSession(league.id, live.id)).rejects.toThrow(
        SessionNotEndedError,
      );
      expect((await service.list({})).items[0]?.sessions).toEqual([]);
    });

    it('refuses an unknown session or league', async () => {
      const league = await service.create(fields);
      const session = await createSession();

      await expect(service.addSession(league.id, 999)).rejects.toThrow(
        SessionNotFoundError,
      );
      await expect(service.addSession(999, session.id)).rejects.toThrow(
        LeagueNotFoundError,
      );
    });

    it('removes a session from the league only', async () => {
      const league = await service.create(fields);
      const session = await createSession();
      await service.addSession(league.id, session.id);

      await service.removeSession(league.id, session.id);

      expect((await service.list({})).items[0]?.sessions).toEqual([]);
      expect(await em.fork().findOne(GameSession, session.id)).not.toBeNull();
    });

    it('can add and remove sessions of a league whose dates have passed', async () => {
      const past = await service.create({
        name: 'Spring 2020',
        startsOn: '2020-02-01',
        endsOn: '2020-05-30',
      });
      const session = await createSession();

      await service.addSession(past.id, session.id);
      expect((await service.list({})).items[0]?.sessions).toHaveLength(1);
      await service.removeSession(past.id, session.id);
      expect((await service.list({})).items[0]?.sessions).toEqual([]);
    });
  });

  it('deleting a league removes its memberships but no session data', async () => {
    const league = await service.create(fields);
    const other = await service.create({ ...fields, name: 'Other' });
    const session = await createSession();
    await service.addSession(league.id, session.id);
    await service.addSession(other.id, session.id);

    await service.remove(league.id);

    const check = db.orm.em.fork();
    expect(await check.find(League, {})).toHaveLength(1);
    const memberships = await check.find(LeagueSession, {});
    expect(memberships.map((m) => m.league.id)).toEqual([other.id]);
    expect(await check.findOne(GameSession, session.id)).not.toBeNull();
    expect(await check.findOne(Quiz, quiz.id)).not.toBeNull();
  });

  describe('the current filter', () => {
    const now = new Date('2026-11-15T12:00:00Z');

    it('keeps leagues ending today or later and flags them current', async () => {
      await service.create({
        name: 'Ended',
        startsOn: '2026-01-01',
        endsOn: '2026-11-14',
      });
      await service.create({
        name: 'Ends today',
        startsOn: '2026-01-01',
        endsOn: '2026-11-15',
      });
      await service.create({
        name: 'Future',
        startsOn: '2026-12-01',
        endsOn: '2027-03-01',
      });

      const current = await service.list({ current: true, now });
      const all = await service.list({ now });

      expect(current.items.map((l) => l.name).sort()).toEqual([
        'Ends today',
        'Future',
      ]);
      expect(all.items.map((l) => [l.name, l.current]).sort()).toEqual([
        ['Ended', false],
        ['Ends today', true],
        ['Future', true],
      ]);
    });

    it('uses the venue date, not the UTC date', async () => {
      await service.create({
        name: 'Ended yesterday',
        startsOn: '2026-01-01',
        endsOn: '2026-11-15',
      });

      // 23:30 UTC on the 15th is already the 16th in Prague (UTC+1).
      const late = new Date('2026-11-15T23:30:00Z');

      expect((await service.list({ current: true, now: late })).items).toEqual(
        [],
      );
    });
  });
});
