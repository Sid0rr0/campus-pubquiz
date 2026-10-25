import {
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  deleteSession,
  fetchFeedbackTrends,
  fetchPlayedSessions,
  fetchSessionBrief,
  fetchSessionDetail,
  renameSession,
  StatsApiError,
} from '@/app/lib/stats-api';

const BASE = 'http://localhost:3000';
const get = { credentials: 'include' } as const;

describeApiClient(
  'stats-api',
  StatsApiError,
  'StatsApiError',
  [
    {
      name: 'fetchPlayedSessions',
      call: () =>
        fetchPlayedSessions({
          page: 2,
          pageSize: 10,
          sortBy: 'playedAt',
          sortOrder: 'asc',
        }),
      url: `${BASE}/stats/sessions?page=2&pageSize=10&sortBy=playedAt&sortOrder=asc`,
      init: get,
      fallback: 'Could not load session stats',
      okBody: { items: [] },
    },
    {
      name: 'fetchSessionDetail',
      call: () => fetchSessionDetail(9),
      url: `${BASE}/stats/sessions/9`,
      init: get,
      fallback: 'Could not load session detail',
      okBody: { id: 9 },
    },
    {
      name: 'fetchSessionBrief',
      call: () => fetchSessionBrief(9, 'Europe/Berlin'),
      url: `${BASE}/stats/sessions/9/brief?timeZone=Europe%2FBerlin`,
      init: get,
      fallback: 'Could not load the Night brief',
      okText: '# The night',
      expected: '# The night',
    },
    {
      name: 'fetchFeedbackTrends (date range)',
      call: () => fetchFeedbackTrends({ from: '2026-01-01', to: '2026-02-01' }),
      url: `${BASE}/stats/feedback-trends?from=2026-01-01&to=2026-02-01`,
      init: get,
      fallback: 'Could not load feedback trends',
      okBody: { points: [] },
    },
    {
      name: 'fetchFeedbackTrends (open range)',
      call: () => fetchFeedbackTrends({ from: '', to: '' }),
      url: `${BASE}/stats/feedback-trends?`,
      init: get,
      fallback: 'Could not load feedback trends',
      okBody: { points: [] },
    },
    {
      name: 'fetchFeedbackTrends (league wins over the dates)',
      call: () =>
        fetchFeedbackTrends({
          from: '2026-01-01',
          to: '2026-02-01',
          leagueId: 3,
        }),
      url: `${BASE}/stats/feedback-trends?leagueId=3`,
      init: get,
      fallback: 'Could not load feedback trends',
      okBody: { points: [] },
    },
    {
      name: 'deleteSession',
      call: () => deleteSession(9),
      url: `${BASE}/stats/sessions/9`,
      init: { method: 'DELETE', credentials: 'include', headers: CSRF },
      fallback: 'Could not delete session',
      expected: undefined,
    },
    {
      name: 'renameSession',
      call: () => renameSession(9, 'Quiz night'),
      url: `${BASE}/stats/sessions/9`,
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({ name: 'Quiz night' }),
      },
      fallback: 'Could not rename session',
      expected: undefined,
    },
  ],
  { toleratesBadJson: true },
);
