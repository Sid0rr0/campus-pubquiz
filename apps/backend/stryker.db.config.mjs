// `mutate:db`: game/state/ plus the services and logic modules against every spec, DB-backed ones included. Run it
// through the wrapper (src/test-db/mutate-db.ts), which provides the database.
import base from './stryker.config.mjs';
import strykerFiles from './stryker.files.cjs';

export default {
  ...base,
  jest: { ...base.jest, configFile: 'jest.stryker-db.config.cjs' },
  mutate: strykerFiles.dbSources(),
  // Kept apart from the DB-free run's results, so neither run invalidates the other's.
  incrementalFile: 'reports/stryker-db-incremental.json',
  htmlReporter: { fileName: 'reports/mutation-db/mutation.html' },
  // The initial run is the whole backend suite in band in one process.
  dryRunTimeoutMinutes: 20,
};
