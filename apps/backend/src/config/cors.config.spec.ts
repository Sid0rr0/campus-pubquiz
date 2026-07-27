import { corsOriginValidator } from '@/config/cors.config';

function validate(origin: string | undefined): Promise<boolean> {
  return new Promise((resolve, reject) => {
    corsOriginValidator(origin, (err, allow) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(allow ?? false);
    });
  });
}

describe('corsOriginValidator', () => {
  const originalFrontendOrigin = process.env.FRONTEND_ORIGIN;

  afterEach(() => {
    process.env.FRONTEND_ORIGIN = originalFrontendOrigin;
  });

  it('allows requests with no origin (e.g. curl, server-to-server)', async () => {
    await expect(validate(undefined)).resolves.toBe(true);
  });

  it('allows the localhost dev origin', async () => {
    await expect(validate('http://localhost:8888')).resolves.toBe(true);
  });

  it('allows the mDNS hostname origin', async () => {
    await expect(
      validate('http://thanhs-macbook-pro.local:8888'),
    ).resolves.toBe(true);
  });

  it('allows a LAN IP origin so phones on the venue Wi-Fi can connect', async () => {
    await expect(validate('http://192.168.0.165:8888')).resolves.toBe(true);
  });

  it('allows a 10.x LAN IP origin', async () => {
    await expect(validate('http://10.0.0.42:8888')).resolves.toBe(true);
  });

  it('rejects a LAN IP origin on the wrong port', async () => {
    await expect(validate('http://192.168.0.165:9999')).rejects.toThrow();
  });

  it('rejects an unrelated public origin', async () => {
    await expect(validate('http://evil.example.com:8888')).rejects.toThrow();
  });

  it('allows FRONTEND_ORIGIN from the environment', async () => {
    process.env.FRONTEND_ORIGIN = 'https://campus-pubquiz-frontend.vercel.app';
    await expect(
      validate('https://campus-pubquiz-frontend.vercel.app'),
    ).resolves.toBe(true);
  });
});
