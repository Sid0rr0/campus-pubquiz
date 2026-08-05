import type { CookieOptions } from 'express';
import { SESSION_IDLE_TIMEOUT_MS } from '@/auth/session.service';

export const SESSION_COOKIE_NAME = 'campus_pubquiz_session';

// Cross-site (SameSite=None) requires Secure, which requires HTTPS — fine in
// production (Railway/Fly terminate TLS), but local/LAN dev is plain HTTP.
// Dev/LAN frontend and backend only ever differ by port on the same host, so
// they're same-site, and Lax already sends the cookie on those requests.
// Minimal `Cookie:` header parser for the Socket.IO handshake, which isn't
// covered by the `cookie-parser` Express middleware. Avoids pulling in the
// `cookie` npm package purely for this — its v2 line ships ESM-only, which
// breaks under Jest's CommonJS transform.
export function extractSessionCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    return decodeURIComponent(pair.slice(separatorIndex + 1).trim());
  }
  return undefined;
}

export function sessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: SESSION_IDLE_TIMEOUT_MS,
    path: '/',
  };
}
