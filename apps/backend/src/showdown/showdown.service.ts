import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { BonusService } from '@/bonus/bonus.service';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';
import { ShowdownRoundRepository } from '@/db/repositories/showdown-round.repository';
import { ShowdownRoundTeamRepository } from '@/db/repositories/showdown-round-team.repository';
import type { ActiveShowdownRoundState } from '@/game/state/session-state';

export class InvalidShowdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidShowdownError';
  }
}

export interface ShowdownParticipantInput {
  teamId: number;
  teamName: string;
}

export interface ShowdownResolution {
  winnerTeamId: number | null;
  isTie: boolean;
}

@Injectable()
export class ShowdownService {
  constructor(
    @InjectRepository(ShowdownRound)
    private readonly showdownRounds: ShowdownRoundRepository,
    @InjectRepository(ShowdownRoundTeam)
    private readonly showdownRoundTeams: ShowdownRoundTeamRepository,
    private readonly bonusService: BonusService,
  ) {}

  /**
   * Creates a new showdown round for the teams currently tied for 1st —
   * guarded against a second concurrent round for the same session (double
   * click) and reused as-is for sudden death (the previous round is already
   * resolved by then, so this guard doesn't block it).
   */
  async createRound(
    gameSessionId: number,
    participants: ShowdownParticipantInput[],
    question: string,
    answer: string,
    points: number,
  ): Promise<ActiveShowdownRoundState> {
    if (participants.length < 2) {
      throw new InvalidShowdownError(
        'A showdown needs at least two tied teams',
      );
    }
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      throw new InvalidShowdownError('A showdown needs a question');
    }
    const trimmedAnswer = answer.trim();
    if (!Number.isFinite(Number(trimmedAnswer)) || trimmedAnswer === '') {
      throw new InvalidShowdownError('A showdown answer must be numeric');
    }
    if (!Number.isFinite(points) || points <= 0) {
      throw new InvalidShowdownError(
        'Showdown points must be a positive number',
      );
    }

    const existingUnresolved = await this.showdownRounds.findOne({
      gameSession: gameSessionId,
      resolvedAt: null,
    });
    if (existingUnresolved) {
      throw new InvalidShowdownError(
        'A showdown round is already in progress for this session',
      );
    }

    const orderIndex = await this.showdownRounds.count({
      gameSession: gameSessionId,
    });
    const round = this.showdownRounds.create({
      gameSession: gameSessionId,
      orderIndex,
      question: trimmedQuestion,
      answer: trimmedAnswer,
      points,
    });
    await this.showdownRounds.getEntityManager().persistAndFlush(round);

    const teamRows = participants.map((participant, index) =>
      this.showdownRoundTeams.create({
        showdownRound: round.id,
        team: participant.teamId,
        seatIndex: index,
      }),
    );
    await this.showdownRoundTeams.getEntityManager().persistAndFlush(teamRows);

    return {
      id: round.id,
      question: trimmedQuestion,
      answer: trimmedAnswer,
      winnerTeamId: null,
      isTie: false,
      resolved: false,
      participants: participants.map((participant, index) => ({
        teamId: participant.teamId,
        teamName: participant.teamName,
        seatIndex: index,
        guess: null,
      })),
    };
  }

  /** Last-write-wins, same semantics as SUBMIT_ANSWER — resubmitting before reveal overwrites the previous guess. */
  async submitGuess(
    roundId: number,
    teamId: number,
    value: string,
  ): Promise<void> {
    const round = await this.showdownRounds.findOneOrFail(roundId);
    if (round.resolvedAt != null) {
      throw new InvalidShowdownError(
        'This showdown round is no longer accepting guesses',
      );
    }
    const row = await this.showdownRoundTeams.findOne({
      showdownRound: roundId,
      team: teamId,
    });
    if (!row) {
      throw new InvalidShowdownError(
        'Your team is not part of this showdown round',
      );
    }
    row.guess = value;
    await this.showdownRoundTeams.getEntityManager().flush();
  }

  /**
   * Idempotent — guarded by resolvedAt, so PREVIOUS/ADVANCE bouncing across
   * the final-step boundary never double-awards. Every team tied for the
   * smallest |guess - answer| wins; exactly one closest guess sets
   * winnerTeam and awards round.points as a 'custom' bonus (bypassing the
   * session's enabledBonusCategories/maxAwardsPerCategory — a tiebreaker
   * resolution can never be blocked by those settings); two or more tied at
   * the minimum sets isTie instead, awarding nothing (sudden death).
   */
  async resolve(roundId: number): Promise<ShowdownResolution> {
    const round = await this.showdownRounds.findOneOrFail(roundId, {
      populate: ['winnerTeam'],
    });
    if (round.resolvedAt != null) {
      return { winnerTeamId: round.winnerTeam?.id ?? null, isTie: round.isTie };
    }

    const rows = await this.showdownRoundTeams.find(
      { showdownRound: roundId },
      { populate: ['team'] },
    );
    const target = Number(round.answer);
    const distances = rows.map((row) => {
      const parsed = row.guess !== null ? Number(row.guess) : NaN;
      return {
        row,
        distance: Number.isFinite(parsed)
          ? Math.abs(parsed - target)
          : Infinity,
      };
    });
    const minDistance = Math.min(...distances.map((d) => d.distance));
    const closest = distances.filter(
      (d) => Number.isFinite(d.distance) && d.distance === minDistance,
    );

    let winnerTeamId: number | null = null;
    const isTie = closest.length !== 1;
    if (!isTie) {
      round.winnerTeam = closest[0].row.team;
      winnerTeamId = closest[0].row.team.id;
    }
    round.isTie = isTie;
    round.resolvedAt = new Date();
    await this.showdownRounds.getEntityManager().flush();

    if (winnerTeamId !== null) {
      await this.bonusService.award(
        round.gameSession.id,
        winnerTeamId,
        'custom',
        round.points,
        `Showdown: "${round.question}"`,
        ['custom'],
        {},
      );
    }

    return { winnerTeamId, isTie };
  }
}
