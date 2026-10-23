// The package.json Jest config minus the testcontainer: Stryker runs the DB-free specs only.
const fs = require('node:fs');
const path = require('node:path');
const { globalSetup, globalTeardown, testRegex, ...base } =
  require('./package.json').jest;
const { dbFreeSpecs } = require('./stryker.files.cjs');

// Stryker runs from a sandbox copy under .stryker-tmp/, where the relative path
// to shared/types breaks; the workspace symlink still leads there.
const sharedTypesSrc = path.join(
  fs.realpathSync(path.dirname(require.resolve('@campus-pubquiz/types'))),
  '../src/index.ts',
);

module.exports = {
  ...base,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@campus-pubquiz/types$': sharedTypesSrc,
  },
  testMatch: dbFreeSpecs(),
};
