import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { z } from 'zod';
import type { RoundRatingView, TeamFeedbackView } from '@campus-pubquiz/types';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { RoundRatingRepository } from '@/db/repositories/round-rating.repository';
import { SessionFeedbackRepository } from '@/db/repositories/session-feedback.repository';

const storedTopicsSchema = z.array(z.string());

/** A team's feedback on a session: its own writes and reads only — nothing here reaches staff. */
@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(RoundRating)
    private readonly roundRatings: RoundRatingRepository,
    @InjectRepository(SessionFeedback)
    private readonly sessionFeedback: SessionFeedbackRepository,
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

  /** Saves the team's comment and topics, replacing whatever it sent before (the whole row). */
  async sendFeedback(
    gameSessionId: number,
    teamId: number,
    feedback: TeamFeedbackView,
  ): Promise<void> {
    // Same as rateRound: an upsert skips the timestamp hooks.
    const now = new Date();
    await this.sessionFeedback.upsert(
      {
        gameSession: gameSessionId,
        team: teamId,
        comment: feedback.comment,
        topics: feedback.topics,
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'team'],
        onConflictMergeFields: ['comment', 'topics', 'updatedAt'],
      },
    );
  }

  /** What the team last sent this session, or an empty comment and no topics. */
  async getFeedbackForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamFeedbackView> {
    const row = await this.sessionFeedback.findForTeam(gameSessionId, teamId);
    if (row === null) return { comment: '', topics: [] };
    return {
      comment: row.comment,
      topics: storedTopicsSchema.parse(row.topics),
    };
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
