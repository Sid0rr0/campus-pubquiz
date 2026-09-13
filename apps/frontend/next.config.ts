import type { NextConfig } from 'next';
import os from 'node:os';
import { withSentryConfig } from '@sentry/nextjs/config';

// Auto-discovers this machine's current LAN IPs so phones on the venue/home
// Wi-Fi can load dev resources (HMR, JS chunks) without hardcoding an IP
// that changes every time the network changes.
function getLanAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [...getLanAddresses()],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
