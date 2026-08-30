import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM } from '@mikro-orm/postgresql';
import { GameSession } from '@/db/entities/game-session.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { GameProgressRepository } from '@/game/state/game-progress.repository';

describe('GameProgressRepository (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let repository: GameProgressRepository;
  let sessionId: number;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    orm = await MikroORM.init({
      clientUrl: container.getConnectionUri(),
      entities: ['./dist/db/entities/*.entity.js'],
      entitiesTs: ['./src/db/entities/*.entity.ts'],
      migrations: {
        path: './dist/db/migrations',
        pathTs: './src/db/migrations',
      },
    });
    await orm.getMigrator().up();
  }, 60_000);

  afterAll(async () => {
    await orm.close(true);
    await container.stop();
  });

  beforeEach(async () => {
    const em = orm.em.fork();
    const quiz = em.create(Quiz, { title: 'Restart Resilience Quiz' });
    const session = em.create(GameSession, { quiz, joinCode: 'ABCDEF' });
    await em.flush();
    sessionId = session.id;
    repository = new GameProgressRepository(
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
    );
  });

  afterEach(async () => {
    await orm.em
      .getConnection()
      .execute(
        'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  it('returns the default lobby progress and an unset phase timer for a freshly seeded session', async () => {
    const saved = await repository.load(sessionId);

    expect(saved).toEqual({
      progress: {
        status: 'lobby',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
        revealIndex: 0,
        furthestOpenIndex: -1,
        previousStatus: null,
      },
      livePhaseKey: null,
      phaseStartedAt: null,
      phaseElapsedByKey: {},
    });
  });

  it('persists and reloads progress across a simulated restart', async () => {
    await repository.save(sessionId, {
      progress: {
        status: 'question_open',
        roundIndex: 1,
        questionIndex: 2,
        isLeaderboardVisible: true,
        revealIndex: 0,
        furthestOpenIndex: 2,
      },
      livePhaseKey: null,
      phaseStartedAt: null,
      phaseElapsedByKey: {},
    });

    const reloaded = await repository.load(sessionId);
    expect(reloaded?.progress).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 2,
      isLeaderboardVisible: true,
      revealIndex: 0,
      furthestOpenIndex: 2,
      previousStatus: null,
    });
  });

  it('persists and reloads the reveal paging position', async () => {
    await repository.save(sessionId, {
      progress: {
        status: 'reveal',
        roundIndex: 1,
        questionIndex: 2,
        isLeaderboardVisible: false,
        revealIndex: 3,
        furthestOpenIndex: 0,
      },
      livePhaseKey: null,
      phaseStartedAt: null,
      phaseElapsedByKey: {},
    });

    const reloaded = await repository.load(sessionId);
    expect(reloaded?.progress.revealIndex).toBe(3);
  });

  it('normalizes a legacy locked status to question_open on load', async () => {
    // Sessions persisted before block-based locking may still carry 'locked'.
    await orm.em
      .getConnection()
      .execute(
        'UPDATE game_sessions SET status = ?, current_round_index = ?, current_question_index = ? WHERE id = ?',
        ['locked', 0, 1, sessionId],
      );

    // A fresh fork, not the identity-mapped `em` from beforeEach, so the
    // raw SQL update above isn't masked by an in-memory cached entity —
    // mirrors how each production request gets its own EntityManager fork.
    const freshRepository = new GameProgressRepository(
      orm.em
        .fork()
        .getRepository<GameSession, GameSessionRepository>(GameSession),
    );
    const saved = await freshRepository.load(sessionId);

    expect(saved?.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
      previousStatus: null,
    });
  });

  it('returns null for a session that does not exist', async () => {
    const saved = await repository.load(999_999_999);
    expect(saved).toBeNull();
  });

  it('persists and reloads the phase timer’s live frontier exactly, epoch-ms precision included', async () => {
    const startedAt = Date.UTC(2026, 0, 1, 12, 0, 0, 123);
    await repository.save(sessionId, {
      progress: {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 1,
        isLeaderboardVisible: false,
        revealIndex: 0,
        furthestOpenIndex: 1,
      },
      livePhaseKey: 'q:0:1',
      phaseStartedAt: startedAt,
      phaseElapsedByKey: { 'q:0:0': 12_345 },
    });

    const reloaded = await repository.load(sessionId);

    expect(reloaded?.livePhaseKey).toBe('q:0:1');
    expect(reloaded?.phaseStartedAt).toBe(startedAt);
    expect(reloaded?.phaseElapsedByKey).toEqual({ 'q:0:0': 12_345 });
  });

  it('persists a null phase timer (no live frontier, e.g. lobby/rules) as null, not a stale value', async () => {
    await repository.save(sessionId, {
      progress: {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
        revealIndex: 0,
        furthestOpenIndex: 0,
      },
      livePhaseKey: 'q:0:0',
      phaseStartedAt: Date.now(),
      phaseElapsedByKey: {},
    });

    // A later save with no live frontier (e.g. the quiz moved to an untimed
    // status without ever closing q:0:0) must clear it back to null, not
    // silently keep the stale value from the previous save.
    await repository.save(sessionId, {
      progress: {
        status: 'round_intro',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
        revealIndex: 0,
        furthestOpenIndex: 0,
      },
      livePhaseKey: 'q:0:0',
      phaseStartedAt: null,
      phaseElapsedByKey: {},
    });

    const reloaded = await repository.load(sessionId);
    expect(reloaded?.phaseStartedAt).toBeNull();
  });
});
