import { expect, type APIRequest } from '@playwright/test';
import { BACKEND_URL } from './env';

/** Sign-ups are limited like logins (5 per minute per IP), so a refused one is retried once the window moves. */
const RATE_LIMITED_STATUS = 429;
const MAX_ATTEMPTS = 8;
const RETRY_WAIT_MS = 10_000;

/** A password that passes the backend's minimum length. */
export const MODERATOR_PASSWORD = 'e2e-moderator-password';

/**
 * Signs `username` up the way `/register` does, which leaves the account
 * pending until an admin approves it. The register page is out of scope for the
 * E2E suite; the approval on the users page is what the journey drives.
 */
export async function registerPendingUser(
  playwrightRequest: APIRequest,
  username: string,
  password: string,
): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: BACKEND_URL });
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const response = await api.post('/auth/register', {
        headers: { 'x-requested-with': 'XMLHttpRequest' },
        data: { username, password },
      });
      if (response.status() !== RATE_LIMITED_STATUS) {
        expect(response.ok(), `register: ${response.status()}`).toBe(true);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
    }
    throw new Error('register stayed rate-limited');
  } finally {
    await api.dispose();
  }
}
