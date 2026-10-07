/** One round a team has rated: what a team's own ratings are restored from on join. */
export interface RoundRatingView {
  roundId: number;
  stars: number;
}

/** The longest "Anything else?" comment a team may send. */
export const MAX_FEEDBACK_COMMENT_LENGTH = 1000;
/** How many topic suggestion lines a team may send. */
export const MAX_FEEDBACK_TOPICS = 10;
/** The longest single topic suggestion a team may send. */
export const MAX_FEEDBACK_TOPIC_LENGTH = 60;

/** A team's own comment and topic suggestions: what the final form is restored from on join. */
export interface TeamFeedbackView {
  comment: string;
  topics: string[];
}

/** A team sending its comment and topic suggestions from the final form; the ack says whether they were saved. Replaces whatever the team sent before. */
export interface SendFeedbackPayload {
  comment: string;
  topics: string[];
}

/** A team rating one round of the break card; the ack says whether it was saved. */
export interface RateRoundPayload {
  roundId: number;
  /** An integer from 1 to 5. */
  stars: number;
}
