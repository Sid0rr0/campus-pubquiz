import { BONUS_CATEGORIES, type BonusCategory } from './bonus';

/** Per-session configuration, set at creation and editable in the lobby before START_QUIZ. */
export interface SessionSettings {
  /** Replaces the hardcoded 60s post-block auto-lock grace period. */
  lockGraceSeconds: number;
  /** Subset of BONUS_CATEGORIES the admin may award during this session. */
  enabledBonusCategories: BonusCategory[];
  /** Controls <audio autoPlay> and YouTube's autoplay=1 on /display. */
  autoplayMedia: boolean;
  /** Plays a ~60s countdown track during the 'locking' phase on /display and /admin, timed to end exactly at questionLockAt regardless of lockGraceSeconds. */
  playLockCountdownSound: boolean;
  /** Whether ADVANCE from 'rules' shows a 'round_overview' screen (listing every round's title) before round 0's own 'round_intro' — lets an admin who doesn't want to spoil the round lineup turn it off. */
  showRoundOverview: boolean;
  /** One entry per rendered /rules bullet line — display text only, no enforcement. */
  rules: string[];
  /** Caps how many times a single team may be awarded a given bonus category this session (e.g. shot: 2, selfie: 1); a category absent from the map has no cap. */
  maxBonusAwardsPerCategory: Partial<Record<BonusCategory, number>>;
  /** Team size cap — display text only, no enforcement. Shown in the /display QR caption and the generated first /rules bullet. */
  maxPlayersPerTeam: number;
  /** Points deducted per player beyond maxPlayersPerTeam — display text only, no enforcement. Shown in the generated first /rules bullet. */
  extraPlayerPenaltyPoints: number;
  /** Seconds a kahootMode round's question stays open before auto-locking, or null for unlimited (no timer armed). */
  kahootQuestionTimerSeconds: number | null;
  /** Whether teams are asked for feedback — the break card and the final form on phones. Off means the server also refuses ratings and Send. */
  collectFeedback: boolean;
}

/** Default prefill for kahootQuestionTimerSeconds when the frontend detects the quiz being started contains a kahootMode round — see session-picker-panel.tsx. */
export const DEFAULT_KAHOOT_QUESTION_TIMER_SECONDS = 30;

// Frozen (including its array and map fields) so no code path can ever
// mutate this shared singleton in place: every session created with default
// settings (GameSession's entity default, SeedService.createSession's
// default param, resolveSessionSettings) holds this exact reference until
// something explicitly overrides it, so an accidental .push()/.splice()/
// key-assignment here would silently corrupt every other session's
// rules/categories/caps for the life of the process. Spreading/mapping/
// filtering — the only operations any call site actually performs — all
// still work unchanged.
export const DEFAULT_SESSION_SETTINGS: SessionSettings = Object.freeze({
  lockGraceSeconds: 60,
  enabledBonusCategories: Object.freeze([
    ...BONUS_CATEGORIES,
  ]) as BonusCategory[],
  autoplayMedia: true,
  playLockCountdownSound: true,
  showRoundOverview: false,
  maxBonusAwardsPerCategory: Object.freeze({
    shot: 2,
    selfie: 1,
  }) as Partial<Record<BonusCategory, number>>,
  maxPlayersPerTeam: 6,
  extraPlayerPenaltyPoints: 2,
  kahootQuestionTimerSeconds: null,
  collectFeedback: true,
  rules: Object.freeze([
    'No cheating.',
    'Please write your answers in English.',
    'In case of disagreements, the organizers have the final word.',
    'Want to contest something? Come with a credible source.',
    'In case of no correct answers, the moderator CAN award a bonus point to the team with the funniest answer.',
  ]) as string[],
});
