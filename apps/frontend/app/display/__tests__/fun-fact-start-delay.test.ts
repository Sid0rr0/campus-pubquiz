import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_NAME = 'NEXT_PUBLIC_FUN_FACT_START_DELAY_MS';

async function loadStartDelay(): Promise<number> {
  vi.resetModules();
  const rotator = await import('@/app/display/fun-fact-rotator');
  return rotator.FUN_FACT_START_DELAY_MS;
}

describe('FUN_FACT_START_DELAY_MS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('waits 30 seconds when no build override is set', async () => {
    vi.stubEnv(ENV_NAME, '');

    expect(await loadStartDelay()).toBe(30_000);
  });

  it('uses a positive whole-number build override', async () => {
    vi.stubEnv(ENV_NAME, '1000');

    expect(await loadStartDelay()).toBe(1000);
  });

  it.each(['abc', '0', '-5', '1.5'])(
    'keeps the default for the invalid override %s',
    async (value) => {
      vi.stubEnv(ENV_NAME, value);

      expect(await loadStartDelay()).toBe(30_000);
    },
  );
});
