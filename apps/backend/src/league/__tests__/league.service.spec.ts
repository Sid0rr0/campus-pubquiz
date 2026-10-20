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
  InvalidLeagueIdsError,
  LeagueNotFoundError,
  SessionEndedError,
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

  describe('the order of leagues', () => {
    const names = async () =>
      (await service.list({})).items.map((league) => league.name);

    async function three() {
      const a = await service.create({ ...fields, name: 'A' });
      const b = await service.create({ ...fields, name: 'B' });
      const c = await service.create({ ...fields, name: 'C' });
      return { a, b, c };
    }

    it('puts a new league at the top', async () => {
      await three();
      expect(await names()).toEqual(['C', 'B', 'A']);
    });

    it('moves a league up and down one place', async () => {
      const { a } = await three();

      await service.move(a.id, 'up');
      expect(await names()).toEqual(['C', 'A', 'B']);

      await service.move(a.id, 'up');
      expect(await names()).toEqual(['A', 'C', 'B']);

      await service.move(a.id, 'down');
      expect(await names()).toEqual(['C', 'A', 'B']);
    });

    it('leaves a league at either end where it is', async () => {
      const { a, c } = await three();

      await service.move(c.id, 'up');
      await service.move(a.id, 'down');

      expect(await names()).toEqual(['C', 'B', 'A']);
    });

    it('moves leagues that share a sort order (rows from before the order existed)', async () => {
      const { a, b, c } = await three();
      for (const league of [a, b, c]) {
        await em.nativeUpdate(League, { id: league.id }, { sortOrder: 0 });
      }
      em.clear();

      await service.move(a.id, 'up');

      expect(await names()).toEqual(['C', 'A', 'B']);
    });

    it('treats an unknown league as not found', async () => {
      await expect(service.move(9999, 'up')).rejects.toThrow(
        LeagueNotFoundError,
      );
    });
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

  describe('a session opting into leagues', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    const currentFields = {
      name: 'Current',
      startsOn: '2026-09-01',
      endsOn: '2026-12-20',
    };
    const pastFields = {
      name: 'Past',
      startsOn: '2026-01-01',
      endsOn: '2026-06-01',
    };

    async function leagueIdsOf(session: GameSession): Promise<number[]> {
      const { items } = await service.list({ now });
      return items
        .filter((l) => l.sessions.some((s) => s.gameSessionId === session.id))
        .map((l) => l.id)
        .sort();
    }

    it('ticks several current leagues for a live session', async () => {
      const a = await service.create(currentFields);
      const b = await service.create(currentFields);
      const session = await createSession('lobby');

      await service.setSessionLeagues(session.joinCode, [a.id, b.id], now);

      expect(await leagueIdsOf(session)).toEqual([a.id, b.id].sort());
    });

    it('replaces the set on each write, and an empty list clears it', async () => {
      const a = await service.create(currentFields);
      const b = await service.create(currentFields);
      const session = await createSession('lobby');
      await service.setSessionLeagues(session.joinCode, [a.id], now);

      await service.setSessionLeagues(session.joinCode, [b.id], now);
      expect(await leagueIdsOf(session)).toEqual([b.id]);

      await service.setSessionLeagues(session.joinCode, [], now);
      expect(await leagueIdsOf(session)).toEqual([]);
    });

    it('rejects an unknown league id and writes nothing', async () => {
      const a = await service.create(currentFields);
      const session = await createSession('lobby');

      await expect(
        service.setSessionLeagues(session.joinCode, [a.id, 9999], now),
      ).rejects.toThrow(InvalidLeagueIdsError);
      expect(await leagueIdsOf(session)).toEqual([]);
    });

    it('rejects a league that is no longer current', async () => {
      const past = await service.create(pastFields);
      const session = await createSession('lobby');

      await expect(
        service.setSessionLeagues(session.joinCode, [past.id], now),
      ).rejects.toThrow(InvalidLeagueIdsError);
    });

    it('lets a session stay in a league that has since stopped being current', async () => {
      const past = await service.create(pastFields);
      const session = await createSession('lobby');
      em.create(LeagueSession, {
        league: em.getReference(League, past.id),
        gameSession: session,
      });
      await em.flush();
      const current = await service.create(currentFields);

      await service.setSessionLeagues(
        session.joinCode,
        [past.id, current.id],
        now,
      );

      expect(await leagueIdsOf(session)).toEqual([past.id, current.id].sort());
    });

    it('refuses a write once the session has ended', async () => {
      const a = await service.create(currentFields);
      const session = await createSession('ended');

      await expect(
        service.setSessionLeagues(session.joinCode, [a.id], now),
      ).rejects.toThrow(SessionEndedError);
      expect(await leagueIdsOf(session)).toEqual([]);
    });

    it('rejects an unknown session', async () => {
      await expect(
        service.setSessionLeagues('NOPE12', [], now),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('checks ids before a session exists', async () => {
      const a = await service.create(currentFields);
      const past = await service.create(pastFields);

      await expect(
        service.assertAssignable([a.id], now),
      ).resolves.toBeUndefined();
      await expect(service.assertAssignable([past.id], now)).rejects.toThrow(
        InvalidLeagueIdsError,
      );
    });
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
