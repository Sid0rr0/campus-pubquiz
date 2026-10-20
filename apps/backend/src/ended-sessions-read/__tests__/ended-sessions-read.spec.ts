import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import {
  gradable,
  setupAnswerServiceTest,
} from '@/answer/__tests__/answer-service-test-utils';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';

describe('EndedSessionsRead (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();
  let read: EndedSessionsRead;

  beforeEach(() => {
    read = new EndedSessionsRead(
      state.em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
    );
  });

  async function answer(team: Team) {
    await state.answerService.submit(
      state.session.id,
      gradable(state.question),
      team.id,
      'guess',
    );
  }

  async function bonus(team: Team) {
    state.em.create(BonusAward, {
      gameSession: state.session,
      team,
      category: 'custom',
      reason: 'Because',
      points: 2,
    });
    await state.em.flush();
  }

  async function leave(team: Team) {
    await state.em.nativeDelete(GameSessionTeam, {
      gameSession: state.session.id,
      team: team.id,
    });
  }

  const inThisSession = () => ({ gameSessionIds: [state.session.id] });

  it('counts a roster team that answered nothing as having taken part', async () => {
    const team = await insertTeam('Quiet', 'token-q');

    expect(await read.participants(inThisSession())).toEqual([
      { gameSessionId: state.session.id, teamId: team.id, isOnRoster: true },
    ]);
  });

  it('counts a kicked team with answers as having taken part, off the roster', async () => {
    const team = await insertTeam('Kicked', 'token-k');
    await answer(team);
    await leave(team);

    expect(await read.participants(inThisSession())).toEqual([
      { gameSessionId: state.session.id, teamId: team.id, isOnRoster: false },
    ]);
  });

  it('counts a departed team with only a bonus award as having taken part', async () => {
    const team = await insertTeam('Leaver', 'token-l');
    await bonus(team);
    await leave(team);

    expect(await read.participants(inThisSession())).toEqual([
      { gameSessionId: state.session.id, teamId: team.id, isOnRoster: false },
    ]);
  });

  it('does not count a team kicked before it left any mark', async () => {
    const team = await insertTeam('Ghost', 'token-g');
    await leave(team);

    expect(await read.participants(inThisSession())).toEqual([]);
    expect(await read.participants({ teamIds: [team.id] })).toEqual([]);
  });

  it('returns a team in a running session, found by session or by team', async () => {
    const team = await insertTeam('Live', 'token-live');
    await state.em.nativeUpdate(
      GameSession,
      { id: state.session.id },
      { status: 'question_open' },
    );
    const expected = [
      { gameSessionId: state.session.id, teamId: team.id, isOnRoster: true },
    ];

    expect(await read.participants(inThisSession())).toEqual(expected);
    expect(await read.participants({ teamIds: [team.id] })).toEqual(expected);
  });

  describe('sessions played per team', () => {
    const endSession = () =>
      state.em.nativeUpdate(
        GameSession,
        { id: state.session.id },
        { status: 'ended' },
      );

    const playedBy = async (team: Team) => {
      const rows = (await read
        .sessionsPlayedQuery()
        .where('p.team_id', team.id)) as {
        team_id: number;
        sessions_played: string | number;
      }[];
      return rows.length === 0 ? 0 : Number(rows[0].sessions_played);
    };

    it('counts ended nights a team was kicked from or departed from after leaving a mark', async () => {
      const kicked = await insertTeam('Kicked', 'token-k');
      const departed = await insertTeam('Departed', 'token-d');
      await answer(kicked);
      await bonus(departed);
      await leave(kicked);
      await leave(departed);
      await endSession();

      expect(await playedBy(kicked)).toBe(1);
      expect(await playedBy(departed)).toBe(1);
    });

    it('leaves out lobby and running sessions', async () => {
      const team = await insertTeam('Waiting', 'token-w');
      expect(await playedBy(team)).toBe(0);

      await state.em.nativeUpdate(
        GameSession,
        { id: state.session.id },
        { status: 'question_open' },
      );
      expect(await playedBy(team)).toBe(0);

      await endSession();
      expect(await playedBy(team)).toBe(1);
    });

    it('gives 0 to a team with no ended nights', async () => {
      const team = await insertTeam('Fresh', 'token-f');
      await endSession();
      await leave(team);

      expect(await playedBy(team)).toBe(0);
    });
  });

  describe('ended sessions, participations and the one-ended-session read', () => {
    async function setStatus(
      gameSessionId: number,
      status: GameSession['status'],
    ) {
      await state.em.nativeUpdate(
        GameSession,
        { id: gameSessionId },
        { status },
      );
    }

    async function otherSession(
      joinCode: string,
      fields: { name?: string; playedAt?: Date } = {},
    ) {
      const session = state.em.create(GameSession, {
        quiz: state.session.quiz,
        joinCode,
        status: 'ended',
        ...(fields.name ? { name: fields.name } : {}),
      });
      await state.em.flush();
      if (fields.playedAt) {
        await state.em.nativeUpdate(
          GameSession,
          { id: session.id },
          { createdAt: fields.playedAt },
        );
      }
      return session;
    }

    async function endedIds() {
      const rows = (await read.endedSessionsQuery()) as {
        game_session_id: number;
      }[];
      return rows.map((row) => row.game_session_id).sort((a, b) => a - b);
    }

    it('leaves lobby and running sessions out of the ended sessions and participations', async () => {
      const team = await insertTeam('Early', 'token-e');
      const running = await otherSession('RUNNIN');
      await setStatus(running.id, 'question_open');
      state.em.create(GameSessionTeam, { gameSession: running, team });
      await state.em.flush();

      expect(await endedIds()).toEqual([]);
      expect(await read.participations([team.id])).toEqual([]);

      await setStatus(state.session.id, 'ended');
      expect(await endedIds()).toEqual([state.session.id]);
      expect(
        (await read.participations([team.id])).map((p) => p.gameSessionId),
      ).toEqual([state.session.id]);
    });

    it('names a session by its custom name when set, else its quiz title, in the header and as the sort column', async () => {
      const named = await otherSession('NAMEDX', { name: 'Zebra night' });
      await setStatus(state.session.id, 'ended');

      expect(await read.endedSession(named.id)).toMatchObject({
        displayName: 'Zebra night',
        customName: 'Zebra night',
        quizTitle: 'Answer Test Quiz',
      });
      expect(await read.endedSession(state.session.id)).toMatchObject({
        displayName: 'Answer Test Quiz',
        customName: null,
      });
      const sorted = (await read
        .endedSessionsQuery()
        .orderBy('display_name', 'desc')) as { game_session_id: number }[];
      expect(sorted.map((row) => row.game_session_id)).toEqual([
        named.id,
        state.session.id,
      ]);
    });

    it('lists participations newest first, session id breaking a tie on date', async () => {
      const team = await insertTeam('Regular', 'token-r');
      const played = new Date('2026-03-01T20:00:00Z');
      const older = await otherSession('OLDERX', {
        playedAt: new Date('2026-01-01T20:00:00Z'),
      });
      const tieA = await otherSession('TIEAAA', { playedAt: played });
      const tieB = await otherSession('TIEBBB', { playedAt: played });
      for (const session of [older, tieA, tieB]) {
        state.em.create(GameSessionTeam, { gameSession: session, team });
      }
      await state.em.flush();
      await setStatus(state.session.id, 'ended');
      await state.em.nativeUpdate(
        GameSession,
        { id: state.session.id },
        { createdAt: new Date('2026-02-01T20:00:00Z') },
      );

      const rows = await read.participations([team.id]);
      expect(rows.map((row) => row.gameSessionId)).toEqual([
        tieB.id,
        tieA.id,
        state.session.id,
        older.id,
      ]);
      expect(rows[0]).toMatchObject({
        teamId: team.id,
        joinCode: 'TIEBBB',
        playedAt: played,
      });
    });

    it('returns nothing for an unknown session and for one that has not ended', async () => {
      expect(await read.endedSession(state.session.id)).toBeNull();
      expect(await read.endedSession(999_999)).toBeNull();
    });
  });
});
