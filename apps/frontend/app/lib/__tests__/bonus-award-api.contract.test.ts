import {
  BASE,
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  BonusAwardApiError,
  deleteBonusAward,
  fetchBonusAwards,
  updateBonusAward,
} from '@/app/lib/bonus-award-api';

describeApiClient(
  'bonus-award-api',
  BonusAwardApiError,
  'BonusAwardApiError',
  [
    {
      name: 'fetchBonusAwards',
      call: () => fetchBonusAwards('ABCD', 3),
      url: `${BASE}/sessions/ABCD/teams/3/bonus-awards`,
      init: { credentials: 'include' },
      fallback: 'Bonus award request failed',
      okBody: { awards: [] },
    },
    {
      name: 'updateBonusAward',
      call: () => updateBonusAward('ABCD', 5, 2, 'Best costume'),
      url: `${BASE}/sessions/ABCD/bonus-awards/5`,
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({ points: 2, reason: 'Best costume' }),
      },
      fallback: 'Bonus award request failed',
      okBody: { id: 5 },
    },
    {
      name: 'deleteBonusAward',
      call: () => deleteBonusAward('ABCD', 5),
      url: `${BASE}/sessions/ABCD/bonus-awards/5`,
      init: { method: 'DELETE', credentials: 'include', headers: CSRF },
      fallback: 'Could not delete bonus award',
      expected: undefined,
    },
  ],
  { toleratesBadJson: true },
);
