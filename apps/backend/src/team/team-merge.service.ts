import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { EntityManager } from '@mikro-orm/postgresql';
import type {
  TeamMergeCandidate,
  TeamMergePairPreview,
  TeamMergeRefusal,
  TeamMergedPayload,
} from '@campus-pubquiz/types';
import { Team } from '@/db/entities/team.entity';
import { TeamRepository } from '@/db/repositories/team.repository';

export class TeamMergeNotFoundError extends Error {
  constructor(teamId: number) {
    super(`Team ${teamId} not found`);
    this.name = 'TeamMergeNotFoundError';
  }
}

export class TeamMergeRefusedError extends Error {
  constructor(
    message: string,
    readonly refusal: TeamMergeRefusal | null = null,
  ) {
    super(message);
    this.name = 'TeamMergeRefusedError';
  }
}

/** Runs one SQL statement with `?` placeholders, inside the merge's transaction when there is one. */
type Run = (sql: string, params?: unknown[]) => Promise<unknown[]>;

interface TeamRow {
  id: number;
  name: string;
  code: string;
  created_at: string | Date;
}

/**
 * Every (session, team) pair that has a row for the team in any table that
 * references a team. A merge repoints all of them, so two teams that share a
 * session in any of them can't be merged (a unique constraint would fail
 * partway through).
 */
const REFERENCES_SQL = `
  select game_session_id, team_id from game_session_teams
  union select game_session_id, team_id from answers
  union select game_session_id, team_id from bonus_awards
  union select game_session_id, team_id from round_ratings
  union select game_session_id, team_id from session_feedback
  union select game_session_id, team_id from session_team_jokers
  union select game_session_id, team_id from session_player_counts
  union select sr.game_session_id, srt.team_id
    from showdown_round_teams srt join showdown_rounds sr on sr.id = srt.showdown_round_id
  union select game_session_id, winner_team_id from showdown_rounds where winner_team_id is not null
`;

/** The definition of "took part" (see GLOSSARY): on the roster, or left an answer or bonus award behind. */
const TOOK_PART_SQL = `
  select game_session_id, team_id from game_session_teams
  union select game_session_id, team_id from answers
  union select game_session_id, team_id from bonus_awards
`;

/** Every table column that holds a team id and is repointed to the kept team. */
const TEAM_COLUMNS: readonly [table: string, column: string][] = [
  ['game_session_teams', 'team_id'],
  ['answers', 'team_id'],
  ['bonus_awards', 'team_id'],
  ['round_ratings', 'team_id'],
  ['session_feedback', 'team_id'],
  ['session_team_jokers', 'team_id'],
  ['session_player_counts', 'team_id'],
  ['showdown_round_teams', 'team_id'],
  ['showdown_rounds', 'winner_team_id'],
];

export function refusalMessage(refusal: TeamMergeRefusal): string {
  return refusal.kind === 'shared_session'
    ? `Both teams took part in ${refusal.sessionNames.join(', ')}, so they can't be merged`
    : `${refusal.teamName} is in a session that hasn't ended`;
}

/**
 * Merging two teams that are the same real team. The newer team's row is
 * kept (its id, token and code), takes the chosen name and the earlier joined
 * date; every reference to the older team moves to it and the older team is
 * deleted. One eligibility rule serves the previews and the merge, which
 * re-checks it inside its transaction. Nothing about a merge is stored.
 */
@Injectable()
export class TeamMergeService {
  constructor(@InjectRepository(Team) private readonly teams: TeamRepository) {}

  private get em(): EntityManager {
    return this.teams.getEntityManager();
  }

  private runOn(em: EntityManager, transacting: boolean): Run {
    const connection = em.getConnection();
    return (sql, params = []) =>
      connection.execute(
        sql,
        params,
        'all',
        transacting ? em.getTransactionContext() : undefined,
      );
  }

  /** Every other team with its sessions played and, if it can't be merged with this one, why. */
  async candidates(teamId: number): Promise<TeamMergeCandidate[]> {
    const run = this.runOn(this.em, false);
    const team = await this.findTeam(run, teamId);
    const others = (await run(
      'select id, name from teams where id <> ? order by name asc, id asc',
      [teamId],
    )) as { id: number; name: string }[];
    const [played, refusals] = await Promise.all([
      this.sessionsPlayed(run),
      this.refusalsAgainst(run, team, others),
    ]);
    return others.map((other) => ({
      id: other.id,
      name: other.name,
      sessionsPlayed: played.get(other.id) ?? 0,
      refusal: refusals.get(other.id) ?? null,
    }));
  }

  /** The confirm step for one pair; refused exactly when the merge would be. */
  async pairPreview(
    teamId: number,
    otherTeamId: number,
  ): Promise<TeamMergePairPreview> {
    const run = this.runOn(this.em, false);
    const [team, other] = await this.loadPair(run, teamId, otherTeamId);
    await this.assertEligible(run, team, other);
    const played = await this.sessionsPlayed(run);
    const newer = newerOf(team, other);
    const sessionsOf = (row: TeamRow) => played.get(row.id) ?? 0;
    return {
      teams: [team, other].map((row) => ({
        id: row.id,
        name: row.name,
        sessionsPlayed: sessionsOf(row),
      })),
      combinedSessionsPlayed: sessionsOf(team) + sessionsOf(other),
      newerTeamId: newer.id,
      newerTeamName: newer.name,
      keptCode: newer.code,
    };
  }

  /** Merges the two teams under `name` (either team's current name) and returns the kept team's id. */
  async merge(
    teamId: number,
    otherTeamId: number,
    name: string,
  ): Promise<TeamMergedPayload> {
    return this.em.transactional(async (tem) => {
      const run = this.runOn(tem, true);
      // Lock both rows (lowest id first, so two merges can't deadlock) so the
      // checks below hold until commit.
      if (teamId !== otherTeamId) {
        await run(
          'select id from teams where id in (?, ?) order by id for update',
          [teamId, otherTeamId],
        );
      }
      const [team, other] = await this.loadPair(run, teamId, otherTeamId);
      if (name !== team.name && name !== other.name) {
        throw new TeamMergeRefusedError(
          'The name must be one of the two teams’ current names',
        );
      }
      await this.assertEligible(run, team, other);

      const kept = newerOf(team, other);
      const duplicate = kept.id === team.id ? other : team;
      const joined = [team, other]
        .map((row) => new Date(row.created_at))
        .reduce((a, b) => (a <= b ? a : b));

      for (const [table, column] of TEAM_COLUMNS) {
        await run(`update ${table} set ${column} = ? where ${column} = ?`, [
          kept.id,
          duplicate.id,
        ]);
      }
      // Names are unique: the duplicate must be gone before the kept team can take its name.
      await run('delete from teams where id = ?', [duplicate.id]);
      await run(
        'update teams set name = ?, created_at = ?, updated_at = now() where id = ?',
        [name, joined, kept.id],
      );
      return { keptTeamId: kept.id };
    });
  }

  private async findTeam(run: Run, teamId: number): Promise<TeamRow> {
    const [row] = (await run(
      'select id, name, code, created_at from teams where id = ?',
      [teamId],
    )) as TeamRow[];
    if (!row) throw new TeamMergeNotFoundError(teamId);
    return row;
  }

  private async loadPair(
    run: Run,
    teamId: number,
    otherTeamId: number,
  ): Promise<[TeamRow, TeamRow]> {
    const team = await this.findTeam(run, teamId);
    if (teamId === otherTeamId) {
      throw new TeamMergeRefusedError('A team can’t be merged with itself');
    }
    return [team, await this.findTeam(run, otherTeamId)];
  }

  private async assertEligible(
    run: Run,
    team: TeamRow,
    other: TeamRow,
  ): Promise<void> {
    const refusal = (await this.refusalsAgainst(run, team, [other])).get(
      other.id,
    );
    if (refusal) {
      throw new TeamMergeRefusedError(refusalMessage(refusal), refusal);
    }
  }

  /** The one eligibility rule: why `team` can't be merged with each of `others`, or null when it can. */
  private async refusalsAgainst(
    run: Run,
    team: { id: number; name: string },
    others: readonly { id: number; name: string }[],
  ): Promise<Map<number, TeamMergeRefusal | null>> {
    const refusals = new Map<number, TeamMergeRefusal | null>(
      others.map((other) => [other.id, null]),
    );
    if (others.length === 0) return refusals;

    const shared = (await run(
      `with refs as (${REFERENCES_SQL})
       select o.team_id, coalesce(gs.name, qz.title) as session_name
       from refs o
       join refs t on t.game_session_id = o.game_session_id and t.team_id = ?
       join game_sessions gs on gs.id = o.game_session_id
       join quizzes qz on qz.id = gs.quiz_id
       where o.team_id <> ?
       order by gs.created_at, gs.id`,
      [team.id, team.id],
    )) as { team_id: number; session_name: string }[];
    const sharedNames = new Map<number, string[]>();
    for (const row of shared) {
      sharedNames.set(row.team_id, [
        ...(sharedNames.get(row.team_id) ?? []),
        row.session_name,
      ]);
    }

    const unended = new Set(
      (
        (await run(
          `select distinct tp.team_id
           from (${TOOK_PART_SQL}) tp
           join game_sessions gs on gs.id = tp.game_session_id
           where gs.status <> 'ended'`,
        )) as { team_id: number }[]
      ).map((row) => row.team_id),
    );

    for (const other of others) {
      const names = sharedNames.get(other.id);
      if (names) {
        refusals.set(other.id, {
          kind: 'shared_session',
          sessionNames: names,
        });
      } else if (unended.has(team.id)) {
        refusals.set(other.id, {
          kind: 'unended_session',
          teamId: team.id,
          teamName: team.name,
        });
      } else if (unended.has(other.id)) {
        refusals.set(other.id, {
          kind: 'unended_session',
          teamId: other.id,
          teamName: other.name,
        });
      }
    }
    return refusals;
  }

  private async sessionsPlayed(run: Run): Promise<Map<number, number>> {
    const rows = (await run(
      `select tp.team_id, count(*) as played
       from (${TOOK_PART_SQL}) tp
       join game_sessions gs on gs.id = tp.game_session_id
       where gs.status = 'ended'
       group by tp.team_id`,
    )) as { team_id: number; played: string | number }[];
    return new Map(rows.map((row) => [row.team_id, Number(row.played)]));
  }
}

/** The team created later (its id breaking a tie): its row, token and code carry on. */
function newerOf(a: TeamRow, b: TeamRow): TeamRow {
  const timeA = new Date(a.created_at).getTime();
  const timeB = new Date(b.created_at).getTime();
  if (timeA !== timeB) return timeA > timeB ? a : b;
  return a.id > b.id ? a : b;
}
