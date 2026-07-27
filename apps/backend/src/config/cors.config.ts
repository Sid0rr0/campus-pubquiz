const LOCAL_ORIGINS = [
  'http://localhost:8888',
  'http://thanhs-macbook-pro.local:8888',
];

export function getCorsOrigins(): string[] {
  const envOrigin = process.env.FRONTEND_ORIGIN;
  return envOrigin ? [envOrigin, ...LOCAL_ORIGINS] : LOCAL_ORIGINS;
}
