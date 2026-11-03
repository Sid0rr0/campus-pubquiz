const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/;
const BRACKETED_IPV6_WITH_PORT = /^\[(.+)\]:\d+$/;

/**
 * The client address the rate limiter counts. Some proxies write `ip:port` into
 * `X-Forwarded-For`, and the source port changes with every connection, so the
 * port is dropped: otherwise a script gets a fresh limit by reconnecting.
 */
export function clientIpOf(req: { ip?: string }): string {
  const ip = req.ip ?? '';
  return (
    IPV4_WITH_PORT.exec(ip)?.[1] ?? BRACKETED_IPV6_WITH_PORT.exec(ip)?.[1] ?? ip
  );
}
