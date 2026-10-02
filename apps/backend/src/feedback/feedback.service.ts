import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { RoundRatingView } from '@campus-pubquiz/types';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { RoundRatingRepository } from '@/db/repositories/round-rating.repository';

/** A team's feedback on a session: its own writes and reads only — nothing here reaches staff. */
@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(RoundRating)
    private readonly roundRatings: RoundRatingRepository,
  ) {}

  /** Saves the team's rating of a round, replacing any earlier one (last write wins). */
  async rateRound(
    gameSessionId: number,
    teamId: number,
    roundId: number,
    stars: number,
  ): Promise<void> {
    // An upsert skips the entity's timestamp hooks, so they are set here; a
    // rating given again keeps its createdAt.
    const now = new Date();
    await this.roundRatings.upsert(
      {
        gameSession: gameSessionId,
        round: roundId,
        team: teamId,
        stars,
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'round', 'team'],
        onConflictMergeFields: ['stars', 'updatedAt'],
      },
    );
  }

  async listRoundRatingsForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<RoundRatingView[]> {
    const ratings = await this.roundRatings.listForTeam(gameSessionId, teamId);
    return ratings.map((rating) => ({
      roundId: rating.round.id,
      stars: rating.stars,
    }));
  }
}
