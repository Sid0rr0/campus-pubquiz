import {
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  approveUser,
  AuthApiError,
  deactivateUser,
  denyUser,
  fetchMe,
  fetchUsers,
  login,
  logout,
  register,
} from '@/app/lib/auth-api';

const BASE = 'http://localhost:3000';
const credentials = { username: 'alice', password: 'hunter2' };

describeApiClient(
  'auth-api',
  AuthApiError,
  'AuthApiError',
  [
    {
      name: 'register',
      call: () => register('alice', 'hunter2'),
      url: `${BASE}/auth/register`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: JSON_TYPE,
        body: JSON.stringify(credentials),
      },
      fallback: 'Registration failed',
      okBody: { status: 'pending' },
    },
    {
      name: 'login',
      call: () => login('alice', 'hunter2'),
      url: `${BASE}/auth/login`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: JSON_TYPE,
        body: JSON.stringify(credentials),
      },
      fallback: 'Login failed',
      okBody: { user: { id: 1 } },
    },
    {
      name: 'logout',
      call: () => logout(),
      url: `${BASE}/auth/logout`,
      init: { method: 'POST', credentials: 'include', headers: CSRF },
      fallback: 'Logout failed',
      expected: undefined,
    },
    {
      name: 'fetchMe',
      call: () => fetchMe(),
      url: `${BASE}/auth/me`,
      init: { credentials: 'include' },
      fallback: 'Could not load account',
      okBody: { user: { id: 1 } },
    },
    {
      name: 'fetchUsers',
      call: () => fetchUsers(),
      url: `${BASE}/users`,
      init: { credentials: 'include' },
      fallback: 'Could not load users',
      okBody: { pending: [], active: [], deactivated: [] },
    },
    {
      name: 'approveUser',
      call: () => approveUser(5, 'moderator'),
      url: `${BASE}/users/5/approve`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({ role: 'moderator' }),
      },
      fallback: 'Could not approve user',
      expected: undefined,
    },
    {
      name: 'deactivateUser',
      call: () => deactivateUser(5),
      url: `${BASE}/users/5/deactivate`,
      init: { method: 'POST', credentials: 'include', headers: CSRF },
      fallback: 'Could not deactivate user',
      expected: undefined,
    },
    {
      name: 'denyUser',
      call: () => denyUser(5),
      url: `${BASE}/users/5/deny`,
      init: { method: 'POST', credentials: 'include', headers: CSRF },
      fallback: 'Could not deny user',
      expected: undefined,
    },
  ],
  { toleratesBadJson: true },
);
