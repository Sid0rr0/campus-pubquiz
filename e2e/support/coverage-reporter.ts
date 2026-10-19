import fs from 'node:fs';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { COVERAGE_ANNOTATION, REQUIRED_IDS } from './coverage';

const SPEC_FILE_SUFFIX = '.spec.ts';
const MATCH_ALL_GREP_SOURCE = '.*';

/**
 * Fails a full run that left a status × screen cell or a move unvisited.
 * A run narrowed by file, `--project`, `--grep`, `--shard` or `--repeat-each`
 * is not checked, and `E2E_COVERAGE=off` turns the check off while journeys
 * are still being written.
 */
export default class CoverageReporter implements Reporter {
  private readonly visited = new Set<string>();
  private skipReason: string | null = null;

  onBegin(config: FullConfig, suite: Suite): void {
    this.skipReason = findSkipReason(config, suite);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== test.expectedStatus) return;
    for (const annotation of test.annotations) {
      if (annotation.type === COVERAGE_ANNOTATION && annotation.description) {
        this.visited.add(annotation.description);
      }
    }
  }

  async onEnd(result: FullResult): Promise<{ status: 'failed' } | undefined> {
    if (this.skipReason !== null || result.status !== 'passed')
      return undefined;
    const missing = REQUIRED_IDS.filter((id) => !this.visited.has(id));
    if (missing.length === 0) return undefined;
    console.error(
      [
        `\nCoverage: ${missing.length} of ${REQUIRED_IDS.length} cells and moves were never visited by a passing test:`,
        ...missing.map((id) => `  - ${id}`),
        'Set E2E_COVERAGE=off to skip this check.\n',
      ].join('\n'),
    );
    return { status: 'failed' };
  }

  printsToStdio(): boolean {
    return false;
  }
}

function findSkipReason(config: FullConfig, suite: Suite): string | null {
  if (process.env.E2E_COVERAGE === 'off') return 'E2E_COVERAGE=off';
  if (config.shard) return '--shard';
  const hasCustomGrep = [config.grep]
    .flat()
    .some((pattern) => pattern.source !== MATCH_ALL_GREP_SOURCE);
  if (hasCustomGrep || config.grepInvert) return '--grep';
  const tests = suite.allTests();
  if (tests.some((test) => test.repeatEachIndex > 0)) return '--repeat-each';
  const projectNames = new Set(suite.suites.map((child) => child.title));
  if (config.projects.some((project) => !projectNames.has(project.name))) {
    return '--project';
  }
  const specFilesOnDisk = listSpecFiles(config.projects[0].testDir);
  const specFilesInRun = new Set(tests.map((test) => test.location.file));
  if (specFilesInRun.size < specFilesOnDisk.length) return 'file filter';
  return null;
}

function listSpecFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSpecFiles(entryPath);
    return entry.name.endsWith(SPEC_FILE_SUFFIX) ? [entryPath] : [];
  });
}
