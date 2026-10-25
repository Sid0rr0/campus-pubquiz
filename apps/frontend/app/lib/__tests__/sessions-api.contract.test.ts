import {
  BASE,
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  closeSession,
  createSession,
  fetchPublicSessions,
  fetchSessions,
  SessionApiError,
  updateSessionSettings,
} from '@/app/lib/sessions-api';

describeApiClient(
  'sessions-api',
  SessionApiError,
  'SessionApiError',
  [
    {
      name: 'fetchSessions',
      call: () => fetchSessions(),
      url: `${BASE}/sessions`,
      init: { credentials: 'include' },
      fallback: 'Session request failed',
      okBody: [],
    },
    {
      name: 'fetchPublicSessions',
      call: () => fetchPublicSessions(),
      url: `${BASE}/sessions/public`,
      fallback: 'Session request failed',
      okBody: [],
    },
    {
      name: 'createSession',
      call: () => createSession(6, undefined, 'Friday', [1, 2]),
      url: `${BASE}/sessions`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({
          quizId: 6,
          name: 'Friday',
          leagueIds: [1, 2],
        }),
      },
      fallback: 'Session request failed',
      okBody: { joinCode: 'ABCD' },
    },
    {
      name: 'updateSessionSettings',
      call: () => updateSessionSettings('ABCD', { leagueIds: [1] }),
      url: `${BASE}/sessions/ABCD/settings`,
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({ leagueIds: [1] }),
      },
      fallback: 'Could not update session settings',
      expected: undefined,
    },
    {
      name: 'closeSession',
      call: () => closeSession('ABCD'),
      url: `${BASE}/sessions/ABCD`,
      init: { method: 'DELETE', credentials: 'include', headers: CSRF },
      fallback: 'Could not close session',
      expected: undefined,
    },
  ],
  { toleratesBadJson: false },
);
