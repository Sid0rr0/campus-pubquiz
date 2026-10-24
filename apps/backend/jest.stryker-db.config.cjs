// The DB-free Stryker Jest config with every spec, for `mutate:db`. Still no
// global set-up: Stryker would start a container per mutant, so the
// `mutate:db` wrapper (src/test-db/mutate-db.ts) starts one for the whole run.
const base = require('./jest.stryker.config.cjs');
const { allSpecs } = require('./stryker.files.cjs');

module.exports = { ...base, testMatch: allSpecs() };
