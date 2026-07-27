const BACKEND_PORT = 3000;

/**
 * Falls back to the page's own hostname (not a hardcoded "localhost") so a
 * phone that loaded the app via LAN IP or mDNS hostname reaches the backend
 * on that same host instead of trying to hit itself.
 */
export function getBackendUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}
