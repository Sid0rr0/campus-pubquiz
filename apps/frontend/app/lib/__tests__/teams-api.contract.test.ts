import {
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  fetchMergeCandidates,
  fetchMergePair,
  fetchTeamCode,
  fetchTeamDetail,
  fetchTeamNight,
  fetchTeamPage,
  fetchTeams,
  mergeTeams,
  TeamsApiError,
} from '@/app/lib/teams-api';

const BASE = 'http://localhost:3000';
const get = { credentials: 'include' } as const;
const teamCodePost = {
  method: 'POST',
  headers: JSON_TYPE,
  body: JSON.stringify({ teamCode: 'ZEBRA1' }),
};

describeApiClient(
  'teams-api',
  TeamsApiError,
  'TeamsApiError',
  [
    {
      name: 'fetchTeams',
      call: () =>
        fetchTeams({
          page: 3,
          pageSize: 25,
          sortBy: 'joinedAt',
          sortOrder: 'asc',
        }),
      url: `${BASE}/teams?page=3&pageSize=25&sortBy=joinedAt&sortOrder=asc`,
      init: get,
      fallback: 'Could not load teams',
      okBody: { items: [] },
    },
    {
      name: 'fetchTeamDetail',
      call: () => fetchTeamDetail(4),
      url: `${BASE}/teams/4`,
      init: get,
      fallback: 'Could not load team',
      okBody: { id: 4 },
    },
    {
      name: 'fetchTeamPage',
      call: () => fetchTeamPage('ZEBRA1'),
      url: `${BASE}/team-page`,
      init: teamCodePost,
      fallback: 'Could not load team page',
      okBody: { nights: [] },
    },
    {
      name: 'fetchTeamNight',
      call: () => fetchTeamNight('ZEBRA1', 12),
      url: `${BASE}/team-page/sessions/12`,
      init: teamCodePost,
      fallback: 'Could not load this night',
      okBody: { id: 12 },
    },
    {
      name: 'fetchMergeCandidates',
      call: () => fetchMergeCandidates(4),
      url: `${BASE}/teams/4/merge-preview`,
      init: get,
      fallback: 'Could not load the other teams',
      okBody: { candidates: [] },
    },
    {
      name: 'fetchMergePair',
      call: () => fetchMergePair(4, 8),
      url: `${BASE}/teams/4/merge-preview?otherTeamId=8`,
      init: get,
      fallback: 'Could not preview the merge',
      okBody: { figures: 1 },
    },
    {
      name: 'mergeTeams',
      call: () => mergeTeams(4, { otherTeamId: 8, name: 'Quizzly Bears' }),
      url: `${BASE}/teams/4/merge`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { ...CSRF, ...JSON_TYPE },
        body: JSON.stringify({ otherTeamId: 8, name: 'Quizzly Bears' }),
      },
      fallback: 'Could not merge the teams',
      okBody: { keptTeamId: 8 },
    },
    {
      name: 'fetchTeamCode',
      call: () => fetchTeamCode(4),
      url: `${BASE}/teams/4/code`,
      init: get,
      fallback: 'Could not load team code',
      okBody: { code: 'ZEBRA1' },
    },
  ],
  { toleratesBadJson: true },
);
