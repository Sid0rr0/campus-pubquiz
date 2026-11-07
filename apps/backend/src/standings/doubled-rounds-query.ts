import type { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

type Knex = ReturnType<GameSessionTeamRepository['getKnex']>;

/**
 * SQL form of the Doubled rounds rule (`doubledRoundIds`,
 * `shared/types/src/doubled-rounds.ts`; a parity spec keeps them equal): rows
 * of `game_session_id`, `team_id`, `round_id` for every session joker round
 * and every extra joker bought for a round, each once (`union` drops a round
 * that is both). Alias it and join on all three columns.
 */
export function doubledRoundsQuery(
  knex: Knex,
  {
    gameSessionIds,
    teamId,
  }: { gameSessionIds?: readonly number[]; teamId?: number } = {},
) {
  const narrow = <
    Q extends {
      whereIn(column: string, ids: number[]): Q;
      where(column: string, value: number): Q;
    },
  >(
    query: Q,
  ): Q => {
    const bySession = gameSessionIds
      ? query.whereIn('game_session_id', [...gameSessionIds])
      : query;
    return teamId === undefined
      ? bySession
      : bySession.where('team_id', teamId);
  };
  const columns = ['game_session_id', 'team_id', 'round_id'];
  return narrow(knex('session_team_jokers'))
    .select(columns)
    .union(
      narrow(knex('purchases'))
        .where('power_up', 'extra_joker')
        .whereNotNull('round_id')
        .select(columns),
    );
}
