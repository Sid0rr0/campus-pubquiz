import { doubledRoundIds, type PowerUpId } from '@campus-pubquiz/types';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Purchase } from '@/db/entities/purchase.entity';
import { Round } from '@/db/entities/round.entity';
import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import {
  gradable,
  setupAnswerServiceTest,
} from '@/answer/__tests__/answer-service-test-utils';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import type { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

/** The in-memory rule's table cases: joker round index, then purchases as [power-up, round index | null]. */
const CASES: [string, number | undefined, [PowerUpId, number | null][]][] = [
  ['no joker and no purchases', undefined, []],
  ['joker only', 0, []],
  ['extra joker only', undefined, [['extra_joker', 1]]],
  ['joker and extra joker on different rounds', 0, [['extra_joker', 1]]],
  ['joker and extra joker on the same round', 0, [['extra_joker', 0]]],
  [
    'several extra jokers',
    undefined,
    [
      ['extra_joker', 1],
      ['extra_joker', 2],
    ],
  ],
  ['question power-ups ignored', undefined, [['fifty_fifty', 1]]],
  ['an extra joker with no round ignored', 0, [['extra_joker', null]]],
];

describe('Doubled rounds: SQL fragment and in-memory rule agree (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  it.each(CASES)('%s', async (_name, jokerIndex, purchases) => {
    const rounds = [state.round];
    for (const orderIndex of [1, 2]) {
      rounds.push(
        state.em.create(Round, {
          quiz: state.round.quiz,
          title: `Round ${orderIndex + 1}`,
          orderIndex,
        }),
      );
    }
    const team = await insertTeam('Case', 'token-case');
    if (jokerIndex !== undefined) {
      state.em.create(SessionTeamJoker, {
        gameSession: state.session,
        team,
        round: rounds[jokerIndex],
        source: 'chosen',
      });
    }
    for (const [powerUp, roundIndex] of purchases) {
      state.em.create(Purchase, {
        gameSession: state.session,
        team,
        powerUp,
        round: roundIndex === null ? undefined : rounds[roundIndex],
        cost: 1,
        effect: {},
      });
    }
    await state.em.flush();

    const read = new EndedSessionsRead(
      state.em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
    );
    const fromSql = (await read.doubledRounds([state.session.id])).map(
      (row) => row.roundId,
    );
    const fromRule = doubledRoundIds(
      jokerIndex === undefined ? undefined : rounds[jokerIndex].id,
      purchases.map(([powerUp, roundIndex]) => ({
        powerUp,
        roundId: roundIndex === null ? null : rounds[roundIndex].id,
      })),
    );

    expect(new Set(fromSql)).toEqual(new Set(fromRule));
    expect(fromSql).toHaveLength(fromRule.length);
  });

  it('doubles only the team holding a joker and an extra joker on one round, in the standings round points', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    state.em.create(SessionTeamJoker, {
      gameSession: state.session,
      team: teamA,
      round: state.round,
      source: 'chosen',
    });
    state.em.create(Purchase, {
      gameSession: state.session,
      team: teamA,
      powerUp: 'extra_joker',
      round: state.round,
      cost: 1,
      effect: {},
    });
    await state.em.flush();
    for (const team of [teamA, teamB]) {
      const { answerId } = await state.answerService.submit(
        state.session.id,
        gradable(state.question),
        team.id,
        'guess',
      );
      await state.answerService.grade(
        state.session.id,
        answerId,
        gradable(state.question),
        3,
      );
    }

    const { leaderboard } = await buildStandingsService(state.em).forSession(
      state.session.id,
    );
    const roundPoints = (name: string) =>
      leaderboard.find((row) => row.teamName === name)?.roundPoints[0].points;

    expect(roundPoints('Team A')).toBe(6);
    expect(roundPoints('Team B')).toBe(3);
  });
});
