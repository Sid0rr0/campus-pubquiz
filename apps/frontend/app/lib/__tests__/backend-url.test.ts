import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBackendUrl } from '@/app/lib/backend-url';

describe('getBackendUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses NEXT_PUBLIC_BACKEND_URL when it is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.example.com');

    expect(getBackendUrl()).toBe('https://api.example.com');
  });

  it("falls back to the page's own hostname on port 3000", () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '');
    vi.stubGlobal('window', { location: { hostname: '192.168.1.20' } });

    expect(getBackendUrl()).toBe('http://192.168.1.20:3000');
  });

  it('falls back to localhost when there is no window', () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '');
    vi.stubGlobal('window', undefined);

    expect(getBackendUrl()).toBe('http://localhost:3000');
  });
});
