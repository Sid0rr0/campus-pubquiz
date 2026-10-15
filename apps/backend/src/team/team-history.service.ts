import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { TeamDetail, TeamSessionRow } from '@campus-pubquiz/types';
import { Team } from '@/db/entities/team.entity';
import { TeamRepository } from '@/db/repositories/team.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import {
  StandingsService,
  type SessionStandings,
} from '@/standings/standings.service';
import { summarizeTeamHistory } from '@/team/team-history.calc';

interface ParticipationRow {
  gameSessionId: number;
  teamId: number;
  quizId: number;
  name: string | null;
  quizTitle: string;
  playedAt: string | Date;
}

interface MaxPointsRow {
  quizId: number;
  total: string | number;
}

interface CorrectCountRow {
  gameSessionId: number;
  teamId: number;
  count: string | number;
}

/** A team's session results, with every placing read from the session's Standings. */
export interface TeamSessionResults {
  rows: TeamSessionRow[];
  /** Sessions where the team was the single Standings winner. */
  winningSessionIds: Set<number>;
}

/**
 * Owns a team's history across ended sessions. Placings and who left come
 * from {@link StandingsService} per session, never from SQL ranks, so a team's
 * page always agrees with each session's standings table. The teams directory's
 * average placing reuses {@link resultsForTeams} and `averagePlacingOf`.
 */
@Injectable()
export class TeamHistoryService {
  constructor(
    @InjectRepository(Team) private readonly teams: TeamRepository,
    private readonly standings: StandingsService,
    private readonly playerCountService: PlayerCountService,
  ) {}

  /** One team's header, summary and sessions; null for an unknown team. */
  async detail(teamId: number): Promise<TeamDetail | null> {
    const team = await this.teams.findOne({ id: teamId });
    if (!team) return null;
    const results = (await this.resultsForTeamsWithWins([teamId])).get(teamId)!;
    return {
      id: team.id,
      name: team.name,
      summary: summarizeTeamHistory(results.rows, results.winningSessionIds),
      sessions: results.rows,
    };
  }

  /** Every ended session each team took part in, newest first. A team with none maps to an empty list. */
  async resultsForTeams(
    teamIds: readonly number[],
  ): Promise<Map<number, TeamSessionRow[]>> {
    const results = await this.resultsForTeamsWithWins(teamIds);
    return new Map(
      [...results].map(([teamId, result]) => [teamId, result.rows]),
    );
  }

  private async resultsForTeamsWithWins(
    teamIds: readonly number[],
  ): Promise<Map<number, TeamSessionResults>> {
    const results = new Map<number, TeamSessionResults>(
      teamIds.map((teamId) => [
        teamId,
        { rows: [], winningSessionIds: new Set<number>() },
      ]),
    );
    if (teamIds.length === 0) return results;

    const participations = await this.loadParticipations(teamIds);
    if (participations.length === 0) return results;

    const sessionIds = [...new Set(participations.map((p) => p.gameSessionId))];
    const quizIds = [...new Set(participations.map((p) => p.quizId))];
    const [standings, maxPoints, correctCounts, playerCounts] =
      await Promise.all([
        this.standings.forSessions(sessionIds),
        this.loadMaxPoints(quizIds),
        this.loadCorrectCounts(sessionIds, teamIds),
        this.playerCountService.listForSessions(sessionIds, teamIds),
      ]);

    const keyOf = (gameSessionId: number, teamId: number) =>
      `${gameSessionId}:${teamId}`;
    const correctByTeamSession = new Map(
      correctCounts.map((row) => [
        keyOf(row.gameSessionId, row.teamId),
        Number(row.count),
      ]),
    );
    const maxPointsByQuiz = new Map(
      maxPoints.map((row) => [row.quizId, Number(row.total)]),
    );

    for (const participation of participations) {
      const sessionStandings = standings.get(participation.gameSessionId)!;
      const result = results.get(participation.teamId)!;
      const row = buildRow(
        participation,
        sessionStandings,
        maxPointsByQuiz.get(participation.quizId) ?? 0,
        correctByTeamSession.get(
          keyOf(participation.gameSessionId, participation.teamId),
        ) ?? 0,
        playerCounts
          .get(participation.gameSessionId)
          ?.get(participation.teamId) ?? null,
      );
      if (!row) continue;
      result.rows.push(row);
      if (sessionStandings.winner?.teamId === participation.teamId) {
        result.winningSessionIds.add(participation.gameSessionId);
      }
    }
    return results;
  }

  /** Ended sessions each team is on the roster of or left a mark on (answers, bonus awards), newest first. */
  private async loadParticipations(
    teamIds: readonly number[],
  ): Promise<ParticipationRow[]> {
    const knex = this.teams.getKnex();
    const ids = [...teamIds];
    const participants = knex('game_session_teams')
      .whereIn('team_id', ids)
      .select('game_session_id', 'team_id')
      .union([
        knex('answers')
          .whereIn('team_id', ids)
          .select('game_session_id', 'team_id'),
        knex('bonus_awards')
          .whereIn('team_id', ids)
          .select('game_session_id', 'team_id'),
      ]);

    return (await knex
      .from(participants.as('p'))
      .join('game_sessions as gs', 'gs.id', 'p.game_session_id')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .where('gs.status', 'ended')
      .orderBy('gs.created_at', 'desc')
      .orderBy('gs.id', 'desc')
      .select(
        'gs.id as gameSessionId',
        'p.team_id as teamId',
        'gs.quiz_id as quizId',
        'gs.name as name',
        'qz.title as quizTitle',
        'gs.created_at as playedAt',
      )) as ParticipationRow[];
  }

  private async loadMaxPoints(
    quizIds: readonly number[],
  ): Promise<MaxPointsRow[]> {
    const knex = this.teams.getKnex();
    return (await knex('rounds as r')
      .join('questions as q', 'q.round_id', 'r.id')
      .whereIn('r.quiz_id', [...quizIds])
      .groupBy('r.quiz_id')
      .select('r.quiz_id as quizId')
      .select(knex.raw('sum(q.points) as total'))) as MaxPointsRow[];
  }

  private async loadCorrectCounts(
    sessionIds: readonly number[],
    teamIds: readonly number[],
  ): Promise<CorrectCountRow[]> {
    const knex = this.teams.getKnex();
    return (await knex('answers')
      .whereIn('game_session_id', [...sessionIds])
      .whereIn('team_id', [...teamIds])
      .where('verdict', 'correct')
      .groupBy('game_session_id', 'team_id')
      .select('game_session_id as gameSessionId', 'team_id as teamId')
      .select(knex.raw('count(*) as count'))) as CorrectCountRow[];
  }
}

/** One team's row for one session, or undefined if the standings don't know the team. */
function buildRow(
  participation: ParticipationRow,
  standings: SessionStandings,
  maxPoints: number,
  correctCount: number,
  playerCount: number | null,
): TeamSessionRow | undefined {
  const ranked = standings.leaderboard.find(
    (entry) => entry.teamId === participation.teamId,
  );
  const departed = standings.departed.find(
    (entry) => entry.teamId === participation.teamId,
  );
  const entry = ranked ?? departed;
  if (!entry) return undefined;
  return {
    gameSessionId: participation.gameSessionId,
    name: participation.name ?? participation.quizTitle,
    playedAt: new Date(participation.playedAt).toISOString(),
    placing: ranked?.rank ?? null,
    placingTo: ranked?.rankTo ?? null,
    teamCount: standings.participantCount,
    hasLeft: !ranked,
    totalPoints: entry.totalPoints,
    maxPoints,
    correctCount,
    playerCount,
  };
}
