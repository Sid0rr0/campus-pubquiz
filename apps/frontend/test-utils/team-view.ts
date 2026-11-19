import type { JoinAcceptedPayload, OwnTeamView } from '@campus-pubquiz/types';

/** An empty team view: no answers, no joker, no coins. Override what a test cares about. */
export function teamView(overrides: Partial<OwnTeamView> = {}): OwnTeamView {
  return {
    answers: [],
    bonusAwards: [],
    roundRatings: [],
    feedback: { comment: '', topics: [] },
    sessionRatings: { pacing: null, feltDifficulty: null },
    playerCount: null,
    joker: null,
    sideId: null,
    coins: 0,
    hasCarriedCoin: false,
    purchases: [],
    roomReadyQuestionIds: [],
    doubledRounds: [],
    ...overrides,
  };
}

const IDENTITY_FIELDS = ['teamId', 'teamToken', 'teamCode', 'teamName'];

/** A partial join payload (as socket-level tests write them) with a team view built from its team data fields. */
export function joinPayload(fields: object): object {
  const data = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !IDENTITY_FIELDS.includes(key)),
  );
  return { ...fields, teamView: teamView(data) };
}

/** A join payload whose embedded team view carries the same team data as its own fields, as the server builds it. */
export function joinAccepted(
  payload: Omit<JoinAcceptedPayload, 'teamView'>,
): JoinAcceptedPayload {
  return joinPayload(payload) as JoinAcceptedPayload;
}
