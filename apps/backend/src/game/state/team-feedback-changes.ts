import {
  getFeedbackField,
  isFinalFormOpen,
  type RateRoundPayload,
  type RateSessionPayload,
  type SendFeedbackPayload,
  type SessionState,
} from '@campus-pubquiz/types';
import { FEEDBACK_OFF_REASON } from '@/feedback/feedback-off-reason';
import { FeedbackService } from '@/feedback/feedback.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import { requireSeat } from '@/game/state/session-updates.util';
import {
  NOTHING_TO_PUSH_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';

interface FeedbackRules {
  noTeamReason: string;
  closedReason: string;
  isOpen: (session: SessionState) => boolean;
  store: (gameSessionId: number, teamId: number) => Promise<void>;
}

/** The comment, topics, pacing and felt difficulty: all accepted only while the final form is open. */
const FINAL_FORM_RULES: Omit<FeedbackRules, 'store'> = {
  noTeamReason: 'Join a team before sending feedback',
  closedReason: "Feedback can't be sent right now",
  isOpen: isFinalFormOpen,
};

/**
 * The team feedback change module: builds the changes for a team rating a
 * round, sending its comment and topic suggestions, and answering pacing or
 * felt difficulty. All share one gate, checked in order against the session
 * the write holds and always before the feedback is stored: the socket belongs
 * to a team, feedback is collected, and the round (or the final form) is open.
 * So a rating sent as the break ends is either stored or refused, never stored
 * late. None of them changes scores or pushes anything.
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
      isOpen: (current) =>
        getFeedbackField(current)?.rounds.some(
          (round) => round.id === roundId,
        ) ?? false,
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
      ...FINAL_FORM_RULES,
      store: (gameSessionId, teamId) =>
        this.feedbackService.sendFeedback(gameSessionId, teamId, {
          comment,
          topics,
        }),
    });
  }

  sessionRated(
    session: SessionState,
    payload: RateSessionPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    return this.change(session, socketId, {
      ...FINAL_FORM_RULES,
      store: (gameSessionId, teamId) =>
        this.feedbackService.rateSession(gameSessionId, teamId, payload),
    });
  }

  private async change(
    session: SessionState,
    socketId: string,
    rules: FeedbackRules,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = requireSeat(session, socketId, rules.noTeamReason);
    if (!session.seededGame.settings.collectFeedback) {
      throw new SessionRefusal(FEEDBACK_OFF_REASON);
    }
    if (!rules.isOpen(session)) {
      throw new SessionRefusal(rules.closedReason);
    }
    await rules.store(session.seededGame.gameSessionId, teamId);
    return {
      session,
      outcome: NOTHING_TO_PUSH_OUTCOME,
      touchedScores: false,
    };
  }
}
