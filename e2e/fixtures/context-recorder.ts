import fs from 'node:fs';
import path from 'node:path';
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  TestInfo,
} from '@playwright/test';
import { FRONTEND_URL } from '../support/env';

export type NewContext = (
  options?: BrowserContextOptions,
) => Promise<BrowserContext>;

/**
 * Opens the browser contexts of one test and keeps their videos only when the
 * test fails. Playwright applies `video: 'retain-on-failure'` to the contexts
 * it creates itself, not to those a test opens with `browser.newContext()`,
 * and a quiz night needs several (laptop, big screen, phones), so the
 * recording is done here.
 */
export class ContextRecorder {
  private readonly contexts: BrowserContext[] = [];
  private readonly videoDir: string;

  constructor(
    private readonly browser: Browser,
    private readonly testInfo: TestInfo,
  ) {
    this.videoDir = testInfo.outputPath('videos');
  }

  readonly newContext: NewContext = async (options = {}) => {
    const context = await this.browser.newContext({
      baseURL: FRONTEND_URL,
      recordVideo: { dir: this.videoDir },
      ...options,
    });
    this.contexts.push(context);
    return context;
  };

  /** Closes every context (which finishes their videos) and attaches the videos of a failed test. */
  async finish(): Promise<void> {
    await Promise.all(this.contexts.map((context) => context.close()));
    if (!fs.existsSync(this.videoDir)) return;
    if (this.testInfo.status === this.testInfo.expectedStatus) {
      fs.rmSync(this.videoDir, { recursive: true, force: true });
      return;
    }
    for (const file of fs.readdirSync(this.videoDir)) {
      await this.testInfo.attach(`video-${file}`, {
        path: path.join(this.videoDir, file),
        contentType: 'video/webm',
      });
    }
  }
}
