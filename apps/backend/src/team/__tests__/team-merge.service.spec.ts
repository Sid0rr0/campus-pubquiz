import type { EntityManager } from '@mikro-orm/postgresql';
import type { GameStatus } from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';
import { Team } from '@/db/entities/team.entity';
import type { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import type { GameSessionRepository } from '@/db/repositories/game-session.repository';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import type { RoundRatingRepository } from '@/db/repositories/round-rating.repository';
import type { SessionFeedbackRepository } from '@/db/repositories/session-feedback.repository';
import type { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import type { SessionTeamJokerRepository } from '@/db/repositories/session-team-joker.repository';
import type { TeamRepository } from '@/db/repositories/team.repository';
import { BonusService } from '@/bonus/bonus.service';
import { buildEndedSessionsRead } from '@/ended-sessions-read/__tests__/ended-sessions-read-test-utils';
import { FeedbackService } from '@/feedback/feedback.service';
import { JokerService } from '@/joker/joker.service';
import { LeagueTableService } from '@/league/league-table.service';
import { PlayerCountService } from '@/player-count/player-count.service';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import { TeamHistoryService } from '@/team/team-history.service';
import {
  TEAM_COLUMNS,
  TeamMergeNotFoundError,
  TeamMergeRefusedError,
  TeamMergeService,
} from '@/team/team-merge.service';
import { TeamCodeRequiredError, TeamService } from '@/team/team.service';
import { useTestDatabase } from '@/test-db/test-database';

// Every table that references a team, listed here independently of the service.
const TEAM_TABLES = [
  'teams',
  'game_session_teams',
  'answers',
  'bonus_awards',
  'round_ratings',
  'session_feedback',
  'session_team_jokers',
  'session_player_counts',
  'showdown_round_teams',
  'showdown_rounds',
];

describe('TeamMergeService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let merge: TeamMergeService;
  let history: TeamHistoryService;
  let leagueTable: LeagueTableService;
  let counter = 0;
  let quiz: Quiz;
  let round: Round;
  let questions: Question[];

  beforeEach(async () => {
    em = db.orm.em.fork();
    counter = 0;
    const teamRepo = em.getRepository<Team, TeamRepository>(Team);
    merge = new TeamMergeService(teamRepo);
    history = new TeamHistoryService(
      teamRepo,
      buildStandingsService(em),
      new PlayerCountService(
        em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
          SessionPlayerCount,
        ),
      ),
      buildEndedSessionsRead(em),
    );
    leagueTable = new LeagueTableService(
      em.getRepository<League, LeagueRepository>(League),
      em.getRepository<LeagueSession, LeagueSessionRepository>(LeagueSession),
      buildStandingsService(em),
      buildEndedSessionsRead(em),
    );
    quiz = em.create(Quiz, { title: 'Quiz' });
    round = em.create(Round, { quiz, orderIndex: 0, title: 'Round 1' });
    questions = [0, 1].map((orderIndex) =>
      em.create(Question, {
        round,
        orderIndex,
        type: 'free_text',
        prompt: `Q${orderIndex}`,
        answer: 'answer',
        points: 10,
      }),
    );
    await em.flush();
  });

  async function newSession(
    status: GameStatus = 'ended',
    name: string | null = null,
  ): Promise<GameSession> {
    counter += 1;
    const session = em.create(GameSession, {
      quiz,
      joinCode: `CODE${counter}`,
      status,
      name,
    });
    await em.flush();
    return session;
  }

  async function newTeam(name: string, createdAt?: Date): Promise<Team> {
    const team = em.create(Team, {
      name,
      token: `${name}-token`,
      code: `${name}-code`.toUpperCase(),
      ...(createdAt ? { createdAt } : {}),
    });
    await em.flush();
    return team;
  }

  async function seat(session: GameSession, team: Team): Promise<void> {
    em.create(GameSessionTeam, { gameSession: session, team });
    await em.flush();
  }

  async function answer(
    session: GameSession,
    team: Team,
    points: number,
    question = questions[0],
  ): Promise<void> {
    em.create(Answer, {
      gameSession: session,
      question,
      team,
      value: 'guess',
      pointsAwarded: points,
      gradedAt: new Date(),
      verdict: points > 0 ? 'correct' : 'incorrect',
    });
    await em.flush();
  }

  /** The team plays the session: seated and answering for `points`. */
  async function play(
    session: GameSession,
    team: Team,
    points: number,
  ): Promise<void> {
    await seat(session, team);
    await answer(session, team, points);
  }

  async function snapshot(): Promise<string> {
    const connection = em.getConnection();
    const rows: unknown[] = [];
    for (const table of TEAM_TABLES) {
      rows.push(
        await connection.execute(`select * from ${table} order by 1, 2, 3`),
      );
    }
    return JSON.stringify(rows);
  }

  async function expectRefusedUnchanged(
    teamId: number,
    otherId: number,
    name: string,
    message?: RegExp,
  ): Promise<void> {
    const before = await snapshot();
    const attempt = merge.merge(teamId, otherId, name);
    await expect(attempt).rejects.toBeInstanceOf(TeamMergeRefusedError);
    if (message) await expect(attempt).rejects.toThrow(message);
    expect(await snapshot()).toBe(before);
  }

  /** Old team (night 1, won) and new team (night 2), both against a rival, in one league. */
  async function scenario() {
    const old = await newTeam('Quizzly Bears', new Date('2026-01-01'));
    const newer = await newTeam('Quizzly Bearz', new Date('2026-02-01'));
    const rival = await newTeam('Rival', new Date('2026-01-01'));
    const night1 = await newSession('ended', 'Night 1');
    const night2 = await newSession('ended', 'Night 2');
    await play(night1, old, 10);
    await play(night1, rival, 5);
    await play(night2, newer, 3);
    await play(night2, rival, 8);
    const league = em.create(League, {
      name: 'Autumn',
      startsOn: '2019-09-01',
      endsOn: '2999-12-31',
    });
    em.create(LeagueSession, { league, gameSession: night1 });
    em.create(LeagueSession, { league, gameSession: night2 });
    await em.flush();
    return { old, newer, rival, night1, night2, league };
  }

  it('merges the history, league points and detail of both teams into the kept team', async () => {
    const { old, newer, night1, night2, league } = await scenario();

    const { keptTeamId } = await merge.merge(old.id, newer.id, 'Quizzly Bears');
    em.clear();

    expect(keptTeamId).toBe(newer.id);
    const detail = await history.detail(newer.id);
    expect(detail!.name).toBe('Quizzly Bears');
    expect(detail!.summary).toMatchObject({
      sessionsPlayed: 2,
      wins: 1,
      bestPlacing: 1,
    });
    expect(detail!.sessions.map((s) => [s.gameSessionId, s.placing])).toEqual([
      [night2.id, 2],
      [night1.id, 1],
    ]);
    await expect(history.detail(old.id)).resolves.toBeNull();

    const table = await leagueTable.table(league.id);
    const rows = table!.rows.filter((r) => r.teamName.startsWith('Quizzly'));
    expect(rows).toEqual([
      expect.objectContaining({
        teamId: newer.id,
        teamName: 'Quizzly Bears',
        leaguePoints: 11,
        nightsPlayed: 2,
      }),
    ]);
  });

  it('shows the kept team the old team’s answers, awards, joker, ratings, feedback and player count', async () => {
    const { old, newer, night1 } = await scenario();
    em.create(BonusAward, {
      gameSession: night1,
      team: old,
      category: 'shot',
      points: 2,
    });
    em.create(SessionTeamJoker, {
      gameSession: night1,
      team: old,
      round,
      source: 'chosen',
    });
    em.create(RoundRating, {
      gameSession: night1,
      round,
      team: old,
      stars: 4.5,
    });
    em.create(SessionFeedback, {
      gameSession: night1,
      team: old,
      comment: 'Great night',
      topics: ['Space'],
    });
    em.create(SessionPlayerCount, {
      gameSession: night1,
      team: old,
      playerCount: 4,
    });
    await em.flush();

    await merge.merge(old.id, newer.id, 'Quizzly Bearz');
    em.clear();

    const night = await history.nightByCode(newer.code, night1.id);
    expect(night!.questions[0]).toMatchObject({
      teamAnswer: 'guess',
      verdict: 'correct',
    });
    const standings = await buildStandingsService(em).forSession(night1.id);
    expect(
      standings.leaderboard.find((e) => e.teamId === newer.id),
    ).toMatchObject({ bonusPoints: 2, totalPoints: 22 });
    const detail = await history.detail(newer.id);
    expect(
      detail!.sessions.find((s) => s.gameSessionId === night1.id),
    ).toMatchObject({ playerCount: 4 });

    const bonuses = new BonusService(
      em.getRepository<BonusAward, BonusAwardRepository>(BonusAward),
      em.getRepository(GameSessionTeam),
    );
    await expect(bonuses.listForTeam(night1.id, newer.id)).resolves.toEqual([
      expect.objectContaining({ category: 'shot', points: 2 }),
    ]);
    const jokers = new JokerService(
      em.getRepository<SessionTeamJoker, SessionTeamJokerRepository>(
        SessionTeamJoker,
      ),
    );
    await expect(jokers.getForTeam(night1.id, newer.id)).resolves.toEqual({
      roundId: round.id,
      source: 'chosen',
    });
    const feedback = new FeedbackService(
      em.getRepository<RoundRating, RoundRatingRepository>(RoundRating),
      em.getRepository<SessionFeedback, SessionFeedbackRepository>(
        SessionFeedback,
      ),
    );
    await expect(
      feedback.listRoundRatingsForTeam(night1.id, newer.id),
    ).resolves.toEqual([{ roundId: round.id, stars: 4.5 }]);
    await expect(
      feedback.getFeedbackForTeam(night1.id, newer.id),
    ).resolves.toEqual({ comment: 'Great night', topics: ['Space'] });
  });

  it('repoints the showdown winner and showdown seat', async () => {
    const { old, newer, rival, night1 } = await scenario();
    const showdown = em.create(ShowdownRound, {
      gameSession: night1,
      orderIndex: 0,
      question: 'Q',
      answer: '1',
      points: 1,
      winnerTeam: old,
    });
    em.create(ShowdownRoundTeam, {
      showdownRound: showdown,
      team: old,
      seatIndex: 0,
    });
    em.create(ShowdownRoundTeam, {
      showdownRound: showdown,
      team: rival,
      seatIndex: 1,
    });
    await em.flush();

    await merge.merge(old.id, newer.id, 'Quizzly Bears');
    em.clear();

    const reloaded = await em.findOneOrFail(ShowdownRound, showdown.id);
    expect(reloaded.winnerTeam?.id).toBe(newer.id);
  });

  it('keeps the newer team’s token and code, either chosen name and the earlier joined date', async () => {
    const { old, newer } = await scenario();

    await merge.merge(newer.id, old.id, 'Quizzly Bearz');
    em.clear();

    const kept = await em.findOneOrFail(Team, newer.id);
    expect(kept).toMatchObject({
      name: 'Quizzly Bearz',
      token: 'Quizzly Bearz-token',
      code: 'QUIZZLY BEARZ-CODE',
    });
    expect(kept.createdAt).toEqual(new Date('2026-01-01'));
  });

  it('frees the duplicate’s name and lets the newer token join as the kept team', async () => {
    const { old, newer } = await scenario();
    const live = await newSession('lobby');
    await merge.merge(old.id, newer.id, 'Quizzly Bears');
    em.clear();

    await expect(em.findOne(Team, old.id)).resolves.toBeNull();
    const teams = new TeamService(
      em.getRepository<Team, TeamRepository>(Team),
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
      em.getRepository(GameSessionTeam),
      history,
      buildEndedSessionsRead(em),
    );
    const joined = await teams.join(live.id, 'whatever', {
      teamToken: newer.token,
      joinCode: live.joinCode,
    });
    expect(joined).toMatchObject({ id: newer.id, name: 'Quizzly Bears' });
    await expect(
      teams.join(live.id, 'Quizzly Bearz', { joinCode: live.joinCode }),
    ).resolves.toMatchObject({ name: 'Quizzly Bearz' });
  });

  it('falls back to name and code for a join with only the older team’s token', async () => {
    const { old, newer } = await scenario();
    const live = await newSession('lobby');
    await merge.merge(old.id, newer.id, 'Quizzly Bears');
    em.clear();
    const teams = new TeamService(
      em.getRepository<Team, TeamRepository>(Team),
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
      em.getRepository(GameSessionTeam),
      history,
      buildEndedSessionsRead(em),
    );

    await expect(
      teams.join(live.id, 'Quizzly Bears', {
        teamToken: old.token,
        joinCode: live.joinCode,
      }),
    ).rejects.toBeInstanceOf(TeamCodeRequiredError);
    await expect(
      teams.join(live.id, 'Quizzly Bears', {
        teamToken: old.token,
        joinCode: live.joinCode,
        teamCode: newer.code,
      }),
    ).resolves.toMatchObject({ id: newer.id, name: 'Quizzly Bears' });
  });

  it('repoints every column that references the teams table', async () => {
    const rows = (await em.getConnection().execute(
      `select cl.relname as table_name, att.attname as column_name
       from pg_constraint con
       join pg_class cl on cl.oid = con.conrelid
       join pg_class ref on ref.oid = con.confrelid
       join lateral unnest(con.conkey) as k(attnum) on true
       join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
       where con.contype = 'f' and ref.relname = 'teams'`,
    )) as { table_name: string; column_name: string }[];

    expect(rows.length).toBeGreaterThan(0);
    const listed = TEAM_COLUMNS.map(([table, column]) => `${table}.${column}`);
    const referencing = rows.map((r) => `${r.table_name}.${r.column_name}`);
    expect(listed).toEqual(expect.arrayContaining(referencing));
  });

  describe('refusals', () => {
    it('leaves every row unchanged when the merge is refused', async () => {
      const { old, rival } = await scenario();
      const before = await snapshot();
      await expect(
        merge.merge(old.id, rival.id, 'Rival'),
      ).rejects.toBeInstanceOf(TeamMergeRefusedError);
      expect(await snapshot()).toBe(before);
    });

    it('refuses teams that took part in the same session', async () => {
      const { old, newer, night1 } = await scenario();
      await play(night1, newer, 1);
      await expectRefusedUnchanged(
        old.id,
        newer.id,
        'Quizzly Bears',
        /Night 1/,
      );
    });

    it('refuses an overlap made only of a stray rating', async () => {
      const { old, newer, night2 } = await scenario();
      em.create(RoundRating, {
        gameSession: night2,
        round,
        team: old,
        stars: 3,
      });
      await em.flush();
      await expectRefusedUnchanged(
        old.id,
        newer.id,
        'Quizzly Bears',
        /Night 2/,
      );
    });

    it('refuses an overlap made only of stray feedback', async () => {
      const { old, newer, night2 } = await scenario();
      em.create(SessionFeedback, {
        gameSession: night2,
        team: old,
        comment: 'hi',
        topics: [],
      });
      await em.flush();
      await expectRefusedUnchanged(old.id, newer.id, 'Quizzly Bears');
    });

    it.each(['lobby', 'question_open'] as const)(
      'refuses when a team is in a %s session',
      async (status) => {
        const { old, newer } = await scenario();
        const live = await newSession(status);
        await seat(live, old);
        await expectRefusedUnchanged(
          newer.id,
          old.id,
          'Quizzly Bears',
          /hasn't ended/,
        );
      },
    );

    it('refuses a kicked team that left answers in a running session', async () => {
      const { old, newer } = await scenario();
      const live = await newSession('question_open');
      await answer(live, newer, 4);
      await expectRefusedUnchanged(old.id, newer.id, 'Quizzly Bears');
    });

    it('refuses the same team twice, a name that is neither, and an unknown team', async () => {
      const { old, newer } = await scenario();
      await expectRefusedUnchanged(old.id, old.id, 'Quizzly Bears');
      await expectRefusedUnchanged(old.id, newer.id, 'Something Else');
      await expect(merge.merge(old.id, 9999, 'Quizzly Bears')).rejects.toThrow(
        TeamMergeNotFoundError,
      );
      await expect(merge.merge(9999, old.id, 'Quizzly Bears')).rejects.toThrow(
        TeamMergeNotFoundError,
      );
    });
  });

  describe('previews', () => {
    it('lists every other team, mergeable or with the same reason the merge refuses with', async () => {
      const { old, newer, rival } = await scenario();
      const live = await newSession('lobby');
      const lobbyTeam = await newTeam('Lobby Lads');
      await seat(live, lobbyTeam);

      const candidates = await merge.candidates(old.id);

      expect(candidates.map((c) => [c.name, c.refusal?.kind ?? null])).toEqual([
        ['Lobby Lads', 'unended_session'],
        ['Quizzly Bearz', null],
        ['Rival', 'shared_session'],
      ]);
      expect(candidates.find((c) => c.id === rival.id)).toMatchObject({
        sessionsPlayed: 2,
        refusal: { kind: 'shared_session', sessionNames: ['Night 1'] },
      });
      expect(candidates.find((c) => c.id === newer.id)).toMatchObject({
        sessionsPlayed: 1,
      });
      await expect(
        merge.merge(old.id, rival.id, 'Rival'),
      ).rejects.toBeInstanceOf(TeamMergeRefusedError);
    });

    describe('gives the verdict and reason the merge refuses with', () => {
      async function expectPreviewMatchesMerge(
        teamId: number,
        otherId: number,
      ): Promise<void> {
        const refusal = await merge
          .merge(teamId, otherId, 'Quizzly Bears')
          .then(() => null)
          .catch((error: unknown) => {
            if (error instanceof TeamMergeRefusedError) return error.refusal;
            throw error;
          });
        expect(refusal).not.toBeNull();
        const candidate = (await merge.candidates(teamId)).find(
          (c) => c.id === otherId,
        );
        expect(candidate?.refusal).toEqual(refusal);
      }

      it('for a stray rating or stray feedback overlap', async () => {
        const { old, newer, night2 } = await scenario();
        em.create(RoundRating, {
          gameSession: night2,
          round,
          team: old,
          stars: 3,
        });
        await em.flush();
        await expectPreviewMatchesMerge(old.id, newer.id);

        const fresh = await newTeam('Fresh', new Date('2026-03-01'));
        const night3 = await newSession('ended', 'Night 3');
        await play(night3, fresh, 1);
        em.create(SessionFeedback, {
          gameSession: night3,
          team: old,
          comment: 'hi',
          topics: [],
        });
        await em.flush();
        await expectPreviewMatchesMerge(old.id, fresh.id);
      });

      it('naming every clashing session', async () => {
        const { old, newer, night1, night2 } = await scenario();
        await play(night1, newer, 1);
        await play(night2, old, 1);
        await expectPreviewMatchesMerge(old.id, newer.id);
        expect(
          (await merge.candidates(old.id)).find((c) => c.id === newer.id),
        ).toMatchObject({
          refusal: {
            kind: 'shared_session',
            sessionNames: ['Night 1', 'Night 2'],
          },
        });
      });

      it.each(['lobby', 'question_open'] as const)(
        'for a team in a %s session, naming that team',
        async (status) => {
          const { old, newer } = await scenario();
          const live = await newSession(status);
          await seat(live, old);
          await expectPreviewMatchesMerge(newer.id, old.id);
          await expectPreviewMatchesMerge(old.id, newer.id);
        },
      );

      it('for a kicked team that left answers in a running session', async () => {
        const { old, newer } = await scenario();
        const live = await newSession('question_open');
        await answer(live, newer, 4);
        await expectPreviewMatchesMerge(old.id, newer.id);
      });
    });

    it('previews a pair with the combined sessions played and the newer team’s code', async () => {
      const { old, newer } = await scenario();

      await expect(merge.pairPreview(old.id, newer.id)).resolves.toEqual({
        teams: [
          { id: old.id, name: 'Quizzly Bears', sessionsPlayed: 1 },
          { id: newer.id, name: 'Quizzly Bearz', sessionsPlayed: 1 },
        ],
        combinedSessionsPlayed: 2,
        newerTeamId: newer.id,
        newerTeamName: 'Quizzly Bearz',
        keptCode: 'QUIZZLY BEARZ-CODE',
      });
    });

    it('previews what the team history shows after the merge, with the team and code the merge keeps', async () => {
      const { old, newer } = await scenario();
      const preview = await merge.pairPreview(old.id, newer.id);

      const { keptTeamId } = await merge.merge(
        old.id,
        newer.id,
        'Quizzly Bears',
      );
      em.clear();

      const detail = await history.detail(keptTeamId);
      expect(preview.combinedSessionsPlayed).toBe(
        detail!.summary.sessionsPlayed,
      );
      expect(preview.newerTeamId).toBe(keptTeamId);
      expect(preview.keptCode).toBe(
        (await em.findOneOrFail(Team, keptTeamId)).code,
      );
    });

    it('refuses a pair preview the merge would refuse', async () => {
      const { old, rival } = await scenario();
      await expect(merge.pairPreview(old.id, rival.id)).rejects.toBeInstanceOf(
        TeamMergeRefusedError,
      );
    });
  });
});
