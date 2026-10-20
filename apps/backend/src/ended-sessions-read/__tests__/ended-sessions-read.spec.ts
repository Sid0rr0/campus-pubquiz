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
});
