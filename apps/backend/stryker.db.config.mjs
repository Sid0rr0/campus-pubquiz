// `mutate:db`: game/state/ plus the services and logic modules against every spec, DB-backed ones included. Run it
// through the wrapper (src/test-db/mutate-db.ts), which provides the database.
import base from './stryker.config.mjs';
import strykerFiles from './stryker.files.cjs';

export default {
  ...base,
  jest: { ...base.jest, configFile: 'jest.stryker-db.config.cjs' },
  mutate: strykerFiles.dbSources(),
  // Kept apart from the DB-free run's results, so neither run invalidates the other's.
  // `-v2`: the first file recorded results under the default timeout, which marked
  // slow-but-passing mutants as timeouts and hid their survivors (see the
  // timeouts note in .scratch/mutation-testing-services/spec.md).
  incrementalFile: 'reports/stryker-db-incremental-v2.json',
  // The default limit (1.5 x the covered tests' net time + 5 s) ignores the per-file
  // set-up (Nest app, database clone), so under 8 workers a mutant that passes every
  // test still overruns it and is counted as a timeout. A higher limit finds those
  // survivors but costs run time: a mutant that fails many slow tests runs until the
  // limit, so 5x / 120 s was too slow for the heavily covered files.
  timeoutFactor: 3,
  timeoutMS: 30_000,
  htmlReporter: { fileName: 'reports/mutation-db/mutation.html' },
  // The initial run is the whole backend suite in band in one process.
  dryRunTimeoutMinutes: 20,
};
