import {
  type FeedbackField,
  getFeedbackField,
  type RateRoundPayload,
  type SendFeedbackPayload,
  type SessionState,
} from '@campus-pubquiz/types';
import { FEEDBACK_OFF_REASON } from '@/feedback/feedback-off-reason';
import { FeedbackService } from '@/feedback/feedback.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import { findTeamIdBySocketId } from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/** The outcome of an event that is only acknowledged to its sender: no emits, no broadcast. */
const NOTHING_TO_PUSH_OUTCOME: SessionOutcome = {
  ...BROADCAST_STATE_OUTCOME,
  shouldBroadcastState: false,
};

interface FeedbackRules {
  noTeamReason: string;
  closedReason: string;
  isOpen: (feedback: FeedbackField) => boolean;
  store: (gameSessionId: number, teamId: number) => Promise<void>;
}

/**
 * The team feedback change module: builds the changes for a team rating a
 * round and a team sending its comment and topic suggestions. Both share one
 * gate, checked in order against the session the write holds and always before
 * the feedback is stored: the socket belongs to a team, feedback is collected,
 * and the round (or the final form) is open. So a rating sent as the break
 * ends is either stored or refused, never stored late. Neither event changes
 * scores or pushes anything.
 */
export class TeamFeedbackChanges {
  constructor(private readonly feedbackService: FeedbackService) {}

  roundRated(
    session: SessionState,
    { roundId, stars }: RateRoundPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    return this.change(session, socketId, {
      noTeamReason: 'Join a team before rating a round',
      closedReason: "This round can't be rated right now",
      isOpen: (feedback) =>
        feedback?.rounds.some((round) => round.id === roundId) ?? false,
      store: (gameSessionId, teamId) =>
        this.feedbackService.rateRound(gameSessionId, teamId, roundId, stars),
    });
  }

  feedbackSent(
    session: SessionState,
    { comment, topics }: SendFeedbackPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    return this.change(session, socketId, {
      noTeamReason: 'Join a team before sending feedback',
      closedReason: "Feedback can't be sent right now",
      isOpen: (feedback) => feedback?.kind === 'final_form',
      store: (gameSessionId, teamId) =>
        this.feedbackService.sendFeedback(gameSessionId, teamId, {
          comment,
          topics,
        }),
    });
  }

  private async change(
    session: SessionState,
    socketId: string,
    rules: FeedbackRules,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = findTeamIdBySocketId(session, socketId);
    if (teamId === null) throw new SessionRefusal(rules.noTeamReason);
    if (!session.seededGame.settings.collectFeedback) {
      throw new SessionRefusal(FEEDBACK_OFF_REASON);
    }
    if (!rules.isOpen(getFeedbackField(session))) {
      throw new SessionRefusal(rules.closedReason);
    }
    await rules.store(session.seededGame.gameSessionId, teamId);
    return { session, outcome: NOTHING_TO_PUSH_OUTCOME };
  }
}
