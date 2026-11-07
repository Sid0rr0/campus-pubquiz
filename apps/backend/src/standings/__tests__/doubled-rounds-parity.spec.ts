import { doubledRoundIds, type PowerUpId } from '@campus-pubquiz/types';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Purchase } from '@/db/entities/purchase.entity';
import { Round } from '@/db/entities/round.entity';
import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';
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
});
