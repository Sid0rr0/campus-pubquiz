/** Env var the Jest global set-up fills with the container's admin connection URI. */
export const TEST_POSTGRES_URI_ENV = 'TEST_POSTGRES_URI';

export const TEMPLATE_DATABASE = 'pubquiz_test_template';

/** Same URI with the database swapped, so one container serves many databases. */
export function uriForDatabase(baseUri: string, database: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/${database}`;
  return uri.toString();
}
