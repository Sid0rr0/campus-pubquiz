import {
  SESSION_COOKIE_NAME,
  extractSessionCookie,
  sessionCookieOptions,
} from '@/auth/session-cookie';
import { SESSION_IDLE_TIMEOUT_MS } from '@/auth/session.service';

describe('extractSessionCookie', () => {
  it('returns undefined without a header', () => {
    expect(extractSessionCookie(undefined)).toBeUndefined();
    expect(extractSessionCookie('')).toBeUndefined();
  });

  it('returns the session cookie value', () => {
    expect(extractSessionCookie(`${SESSION_COOKIE_NAME}=abc123`)).toBe(
      'abc123',
    );
  });

  it('finds it among other cookies, ignoring whitespace', () => {
    expect(
      extractSessionCookie(`a=1; ${SESSION_COOKIE_NAME} = tok ; b=2`),
    ).toBe('tok');
  });

  it('skips pairs without an equals sign', () => {
    expect(extractSessionCookie(`junk; ${SESSION_COOKIE_NAME}=tok`)).toBe(
      'tok',
    );
  });

  it('uses the campus_pubquiz_session cookie, and no other name', () => {
    expect(SESSION_COOKIE_NAME).toBe('campus_pubquiz_session');
    expect(extractSessionCookie('campus_pubquiz_session=abc')).toBe('abc');
    expect(extractSessionCookie('other=abc')).toBeUndefined();
  });

  it('skips a pair without an equals sign even when its text looks like the session name', () => {
    expect(
      extractSessionCookie('campus_pubquiz_sessionX; foo; other=1'),
    ).toBeUndefined();
    expect(extractSessionCookie('foo; campus_pubquiz_session=abc')).toBe('abc');
  });

  it('keeps equals signs inside the value', () => {
    expect(extractSessionCookie(`${SESSION_COOKIE_NAME}=a=b==`)).toBe('a=b==');
  });

  it('decodes percent-encoded values', () => {
    expect(extractSessionCookie(`${SESSION_COOKIE_NAME}=a%20b%3D`)).toBe(
      'a b=',
    );
  });

  it('returns undefined when only other cookies are present', () => {
    expect(extractSessionCookie('a=1; b=2')).toBeUndefined();
  });

  it('does not match a cookie whose name merely contains the session name', () => {
    expect(
      extractSessionCookie(
        `x${SESSION_COOKIE_NAME}=no; ${SESSION_COOKIE_NAME}x=no`,
      ),
    ).toBeUndefined();
  });
});

describe('sessionCookieOptions', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('is secure cross-site in production', () => {
    process.env.NODE_ENV = 'production';
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: SESSION_IDLE_TIMEOUT_MS,
      path: '/',
    });
  });

  it('is plain lax outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: SESSION_IDLE_TIMEOUT_MS,
      path: '/',
    });
  });
});
