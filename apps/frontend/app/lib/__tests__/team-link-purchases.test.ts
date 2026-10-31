import { describe, expect, it } from 'vitest';
import type { JoinAcceptedPayload, PurchaseView } from '@campus-pubquiz/types';
import { initialTeamLink, teamLink } from '@/app/lib/team-link';

const BOUGHT: PurchaseView = {
  powerUp: 'fifty_fifty',
  questionId: 5,
  roundId: null,
  effect: { kind: 'fifty_fifty', removedOptions: ['B', 'C'] },
};

const ACCEPTED: JoinAcceptedPayload = {
  teamId: 31,
  teamName: 'The Quizzards',
  teamToken: 'token-2',
  teamCode: 'CODE',
  answers: [],
  bonusAwards: [],
  roundRatings: [],
  feedback: { comment: '', topics: [] },
  sessionRatings: { pacing: null, feltDifficulty: null },
  playerCount: null,
  joker: null,
  coins: 2,
  hasCarriedCoin: false,
  purchases: [BOUGHT],
  roomReadyQuestionIds: [5],
};

const start = () =>
  initialTeamLink({
    url: {},
    stored: {
      teamName: 'The Quizzards',
      teamToken: 'token-1',
      gameCode: 'ABCDEF',
    },
  });

describe('the Team link — power-up purchases', () => {
  it('restores the purchases a join carries, so a reconnect keeps the removed options hidden', () => {
    const { state } = teamLink(start(), {
      type: 'joinAccepted',
      payload: ACCEPTED,
    });

    expect(state.myPurchases).toEqual([BOUGHT]);
  });

  it('takes the purchases and the coins left from a sync after a purchase', () => {
    const joined = teamLink(start(), {
      type: 'joinAccepted',
      payload: { ...ACCEPTED, purchases: [], coins: 2 },
    }).state;

    const { state } = teamLink(joined, {
      type: 'purchasesSynced',
      payload: { purchases: [BOUGHT], coins: 1 },
    });

    expect(state.myPurchases).toEqual([BOUGHT]);
    expect(state.team?.coins).toBe(1);
  });

  it('restores the ready flag from a join and follows each sync, per question', () => {
    const joined = teamLink(start(), {
      type: 'joinAccepted',
      payload: ACCEPTED,
    }).state;
    expect(joined.roomReadyQuestionIds).toEqual([5]);

    const second = teamLink(joined, {
      type: 'roomReadySynced',
      payload: { questionId: 6, isReady: true },
    }).state;
    expect(second.roomReadyQuestionIds).toEqual([5, 6]);

    const { state } = teamLink(second, {
      type: 'roomReadySynced',
      payload: { questionId: 5, isReady: false },
    });
    expect(state.roomReadyQuestionIds).toEqual([6]);
  });

  it('forgets the purchases with the rest of the team data', () => {
    const joined = teamLink(start(), {
      type: 'joinAccepted',
      payload: ACCEPTED,
    }).state;

    const { state } = teamLink(joined, { type: 'identityChanged' });

    expect(state.myPurchases).toEqual([]);
  });
});
