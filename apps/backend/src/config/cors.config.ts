const LOCAL_ORIGINS = ['http://localhost:8888'];

const FRONTEND_PORT = '8888';

// Matches http://<host>:8888 where <host> is a private-network IP
// (192.168.x.x, 10.x.x.x, or 172.16-31.x.x) or any *.local mDNS hostname,
// so phones on the same venue Wi-Fi can reach the dev frontend regardless
// of which LAN address it was opened from.
const LAN_ORIGIN_PATTERN = new RegExp(
  `^http://(192\\.168\\.\\d{1,3}\\.\\d{1,3}|10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}|[a-z0-9-]+\\.local):${FRONTEND_PORT}$`,
);

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

export function corsOriginValidator(
  origin: string | undefined,
  callback: CorsOriginCallback,
): void {
  const envOrigin = process.env.FRONTEND_ORIGIN;
  const allowedOrigins = envOrigin
    ? [envOrigin, ...LOCAL_ORIGINS]
    : LOCAL_ORIGINS;

  if (
    !origin ||
    allowedOrigins.includes(origin) ||
    LAN_ORIGIN_PATTERN.test(origin)
  ) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} not allowed by CORS`));
}
