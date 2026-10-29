import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { sessionResult } from '@/standings/session-result';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import {
  gradable,
  setupAnswerServiceTest,
} from '@/answer/__tests__/answer-service-test-utils';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { sessionDisplayName } from '@/ended-sessions-read/session-display-name';

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

  it('does not count a roster team with no answer or bonus once the session has ended', async () => {
    const quiet = await insertTeam('Quiet', 'token-q');
    const active = await insertTeam('Active', 'token-a');
    await answer(active);
    await state.em.nativeUpdate(
      GameSession,
      { id: state.session.id },
      { status: 'ended' },
    );

    expect(await read.participants(inThisSession())).toEqual([
      { gameSessionId: state.session.id, teamId: active.id, isOnRoster: true },
    ]);
    expect(await read.participants({ teamIds: [quiet.id] })).toEqual([]);
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

  it('narrows by session and team together', async () => {
    const mine = await insertTeam('Mine', 'token-m');
    await insertTeam('Other', 'token-o');

    expect(
      await read.participants({
        gameSessionIds: [state.session.id],
        teamIds: [mine.id],
      }),
    ).toEqual([
      { gameSessionId: state.session.id, teamId: mine.id, isOnRoster: true },
    ]);
    expect(
      await read.participants({
        gameSessionIds: [state.session.id],
        teamIds: [999_999],
      }),
    ).toEqual([]);
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
      await answer(team);
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
      await answer(team);

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

    it('keeps the SQL display name and the in-memory display name rule in agreement', async () => {
      const named = await otherSession('AGREED', { name: 'Zebra night' });
      await setStatus(state.session.id, 'ended');

      const rows = (await read.endedSessionsQuery()) as {
        display_name: string;
        custom_name: string | null;
        quiz_title: string;
      }[];
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.custom_name).sort()).toEqual([
        'Zebra night',
        null,
      ]);
      for (const row of rows) {
        expect(row.display_name).toBe(
          sessionDisplayName(row.custom_name, row.quiz_title),
        );
      }
      expect(named.name).toBe('Zebra night');
    });

    it('only works out max points when asked', async () => {
      await setStatus(state.session.id, 'ended');

      const [without] = (await read.endedSessionsQuery()) as object[];
      const [withPoints] = (await read.endedSessionsQuery({
        withMaxPoints: true,
      })) as object[];

      expect(without).not.toHaveProperty('max_points');
      expect(withPoints).toHaveProperty('max_points');
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
        state.em.create(BonusAward, {
          gameSession: session,
          team,
          category: 'custom',
          reason: 'Because',
          points: 1,
        });
      }
      await state.em.flush();
      await answer(team);
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

    it('sums the points of the session quiz questions, and is 0 for a quiz with none', async () => {
      state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'free_text',
        prompt: 'Name a vegetable',
        answer: 'Leek',
        points: 4,
      });
      const emptyRound = state.em.create(Round, {
        quiz: state.session.quiz,
        title: 'Round 2',
        orderIndex: 1,
      });
      state.em.create(Question, {
        round: emptyRound,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Name a nut',
        answer: 'Pecan',
        points: 2,
      });
      const emptyQuiz = state.em.create(Quiz, { title: 'Empty quiz' });
      const emptySession = state.em.create(GameSession, {
        quiz: emptyQuiz,
        joinCode: 'EMPTYQ',
        status: 'ended',
      });
      await state.em.flush();
      await setStatus(state.session.id, 'ended');

      expect((await read.endedSession(state.session.id))?.maxPoints).toBe(7);
      expect((await read.endedSession(emptySession.id))?.maxPoints).toBe(0);
    });

    it('agrees with the Session result module on max points for the same session', async () => {
      state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'free_text',
        prompt: 'Name a vegetable',
        answer: 'Leek',
        points: 4,
      });
      await state.em.flush();
      await setStatus(state.session.id, 'ended');
      const questions = await state.em.find(Question, {
        round: { quiz: state.session.quiz.id },
      });

      const result = sessionResult({
        standings: {
          leaderboard: [],
          departed: [],
          participantCount: 0,
          winner: undefined,
        },
        questions: questions.map((q) => ({
          id: q.id,
          roundId: state.round.id,
          type: q.type,
          points: q.points,
        })),
        answers: [],
      });

      expect((await read.endedSession(state.session.id))?.maxPoints).toBe(
        result.maxPoints,
      );
    });

    it('returns nothing for an unknown session and for one that has not ended', async () => {
      expect(await read.endedSession(state.session.id)).toBeNull();
      expect(await read.endedSession(999_999)).toBeNull();
    });
  });

  describe('night', () => {
    async function endSession() {
      await state.em.nativeUpdate(
        GameSession,
        { id: state.session.id },
        { status: 'ended' },
      );
    }

    function addQuestion(
      round: Round,
      orderIndex: number,
      fields: Partial<Question> = {},
    ) {
      return state.em.create(Question, {
        round,
        orderIndex,
        type: 'free_text',
        prompt: `Q ${round.title} ${orderIndex}`,
        answer: 'Key',
        points: 1,
        ...fields,
      });
    }

    function addAnswer(
      team: Team,
      question: Question,
      fields: Partial<Answer> = {},
    ) {
      return state.em.create(Answer, {
        gameSession: state.session,
        question,
        team,
        value: 'guess',
        pointsAwarded: 0,
        gradedAt: new Date('2026-03-01T20:00:00Z'),
        verdict: 'incorrect',
        ...fields,
      });
    }

    it('returns questions in round order then question order, numbered from 1 per round', async () => {
      // Round order differs from id order: the first-created round plays last.
      state.round.orderIndex = 2;
      state.round.title = 'Late';
      state.em.remove(state.question);
      const late1 = addQuestion(state.round, 1, { prompt: 'late 1' });
      const late0 = addQuestion(state.round, 0, { prompt: 'late 0' });
      const early = state.em.create(Round, {
        quiz: state.session.quiz,
        title: 'Early',
        orderIndex: 1,
      });
      const early1 = addQuestion(early, 1, { prompt: 'early 1' });
      const early0 = addQuestion(early, 0, { prompt: 'early 0' });
      await state.em.flush();
      await endSession();

      const { questions } = await read.night(state.session.id);

      expect(
        questions.map((q) => ({
          questionId: q.questionId,
          roundId: q.roundId,
          roundTitle: q.roundTitle,
          roundNumber: q.roundNumber,
          questionNumber: q.questionNumber,
          orderIndex: q.orderIndex,
          prompt: q.prompt,
        })),
      ).toEqual([
        {
          questionId: early0.id,
          roundId: early.id,
          roundTitle: 'Early',
          roundNumber: 1,
          questionNumber: 1,
          orderIndex: 0,
          prompt: 'early 0',
        },
        {
          questionId: early1.id,
          roundId: early.id,
          roundTitle: 'Early',
          roundNumber: 1,
          questionNumber: 2,
          orderIndex: 1,
          prompt: 'early 1',
        },
        {
          questionId: late0.id,
          roundId: state.round.id,
          roundTitle: 'Late',
          roundNumber: 2,
          questionNumber: 1,
          orderIndex: 0,
          prompt: 'late 0',
        },
        {
          questionId: late1.id,
          roundId: state.round.id,
          roundTitle: 'Late',
          roundNumber: 2,
          questionNumber: 2,
          orderIndex: 1,
          prompt: 'late 1',
        },
      ]);
    });

    it('words a question key and its answers with the question options, and gives the answer kind and points as a number', async () => {
      const match = addQuestion(state.round, 1, {
        type: 'match',
        prompt: 'Pair them',
        answer: 'Paris|Rome',
        payload: { options: ['France', 'Italy'] },
        points: 3,
      });
      const team = await insertTeam('Pairs', 'token-p');
      addAnswer(team, match, { value: 'Rome|Paris' });
      await state.em.flush();
      await endSession();

      const night = await read.night(state.session.id);

      const key = night.questions.find((q) => q.questionId === match.id)!;
      expect(key).toMatchObject({
        type: 'match',
        answerKind: 'match',
        points: 3,
        answer: 'France → Paris, Italy → Rome',
      });
      expect(night.answers).toEqual([
        expect.objectContaining({
          questionId: match.id,
          answer: 'France → Rome, Italy → Paris',
        }),
      ]);
    });

    it('returns every team answer with team names when unnarrowed, and only one team when narrowed', async () => {
      const mine = await insertTeam('Mine', 'token-m');
      const other = await insertTeam('Other', 'token-o');
      addAnswer(mine, state.question, { value: 'mine' });
      addAnswer(other, state.question, { value: 'other' });
      await state.em.flush();
      await endSession();

      const all = await read.night(state.session.id);
      expect(
        all.answers
          .map((a) => [a.teamId, a.teamName, a.answer])
          .sort((a, b) => Number(a[0]) - Number(b[0])),
      ).toEqual([
        [mine.id, 'Mine', 'mine'],
        [other.id, 'Other', 'other'],
      ]);

      const narrowed = await read.night(state.session.id, {
        teamId: mine.id,
      });
      expect(narrowed.answers).toEqual([
        expect.objectContaining({ teamId: mine.id, answer: 'mine' }),
      ]);
      expect(narrowed.questions).toEqual(all.questions);
    });

    it('still returns an unanswered question, with no answer for it', async () => {
      const team = await insertTeam('Quiet', 'token-q');
      await endSession();

      const night = await read.night(state.session.id, { teamId: team.id });

      expect(night.questions.map((q) => q.questionId)).toEqual([
        state.question.id,
      ]);
      expect(night.answers).toEqual([]);
    });

    it("returns a kicked team's answers when narrowed to it", async () => {
      const team = await insertTeam('Kicked', 'token-k');
      addAnswer(team, state.question, { value: 'before the boot' });
      await state.em.flush();
      await state.em.nativeDelete(GameSessionTeam, {
        gameSession: state.session.id,
        team: team.id,
      });
      await endSession();

      const night = await read.night(state.session.id, { teamId: team.id });

      expect(night.answers).toEqual([
        expect.objectContaining({
          teamId: team.id,
          teamName: 'Kicked',
          answer: 'before the boot',
        }),
      ]);
    });

    it('returns points, points awarded and response time as numbers, and a missing response time as null', async () => {
      const fast = await insertTeam('Fast', 'token-f');
      const slow = await insertTeam('Slow', 'token-s');
      const gradedAt = new Date('2026-03-01T20:05:00Z');
      addAnswer(fast, state.question, {
        pointsAwarded: 1.5,
        responseMs: 1234,
        verdict: 'correct',
        gradedAt,
      });
      addAnswer(slow, state.question, { responseMs: null });
      await state.em.flush();
      await endSession();

      const { questions, answers } = await read.night(state.session.id);

      expect(questions[0].points).toBe(1);
      const fastRow = answers.find((a) => a.teamId === fast.id)!;
      expect(fastRow.pointsAwarded).toBe(1.5);
      expect(fastRow.responseMs).toBe(1234);
      expect(fastRow.verdict).toBe('correct');
      expect(new Date(fastRow.gradedAt!)).toEqual(gradedAt);
      const slowRow = answers.find((a) => a.teamId === slow.id)!;
      expect(slowRow.pointsAwarded).toBe(0);
      expect(slowRow.responseMs).toBeNull();
    });
  });
});
