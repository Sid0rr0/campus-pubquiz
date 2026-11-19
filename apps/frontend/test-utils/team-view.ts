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
    jokerExtras: {},
    ...overrides,
  };
}

const IDENTITY_FIELDS = ['teamId', 'teamToken', 'teamCode', 'teamName'];

/** A partial join payload (as socket-level tests write them): identity fields stay, every other field goes into the team view. */
export function joinPayload(fields: object): object {
  const data = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !IDENTITY_FIELDS.includes(key)),
  );
  const identity = Object.fromEntries(
    Object.entries(fields).filter(([key]) => IDENTITY_FIELDS.includes(key)),
  );
  return { ...identity, teamView: teamView(data) };
}

/** A join payload from a team's identity plus any team view fields it cares about. */
export function joinAccepted(
  payload: Omit<JoinAcceptedPayload, 'teamView'> & Partial<OwnTeamView>,
): JoinAcceptedPayload {
  return joinPayload(payload) as JoinAcceptedPayload;
}
