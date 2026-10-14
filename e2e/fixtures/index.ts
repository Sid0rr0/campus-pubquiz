import {
  devices,
  test as base,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  createSession,
  importQuizNight,
  newAdminApi,
  type SeededSession,
  type SessionSettingsInput,
} from '../support/api';
import { ADMIN_STORAGE_STATE, E2E_LOCK_GRACE_SECONDS } from '../support/env';
import { ControlScreen } from '../support/screens/control-screen';
import { DisplayScreen } from '../support/screens/display-screen';
import { PhoneScreen } from '../support/screens/phone-screen';
import { ContextRecorder, type NewContext } from './context-recorder';

const LAPTOP_VIEWPORT = { width: 1280, height: 800 } as const;
const BIG_SCREEN_VIEWPORT = { width: 1280, height: 720 } as const;
const PHONE_DEVICE = devices['Pixel 7'];

/** Joins a new team on a fresh phone (its own context and localStorage) and resolves once the lobby shows. Team names get a random suffix, so tests never collide on a team name. */
export type JoinPhone = (teamLabel: string) => Promise<PhoneScreen>;

interface TestFixtures {
  /** Opens a browser context for this test; its video is kept only if the test fails. Every context below comes from it. */
  newContext: NewContext;
  /** HTTP client acting as the logged-in quiz master. */
  adminApi: APIRequestContext;
  /** A session of its own on its own copy of the quiz-night fixture. */
  session: SeededSession;
  /** Settings the session is created with; override with `test.use({ sessionSettings })`. */
  sessionSettings: SessionSettingsInput;
  /** The quiz master's laptop on `/control`, in the lobby. */
  control: ControlScreen;
  /** The big screen on `/display`, in the lobby. */
  display: DisplayScreen;
  /** Opens a phone context (mobile viewport, touch, mobile user agent, its own localStorage) without opening a page. */
  newPhoneContext: () => Promise<BrowserContext>;
  /** Opens phones on `/play` and joins them to the session. */
  joinPhone: JoinPhone;
}

function newUniqueSuffix(): string {
  return randomUUID().slice(0, 6);
}

export const test = base.extend<TestFixtures>({
  newContext: async ({ browser }, use, testInfo) => {
    const recorder = new ContextRecorder(browser, testInfo);
    await use(recorder.newContext);
    await recorder.finish();
  },

  sessionSettings: [
    { lockGraceSeconds: E2E_LOCK_GRACE_SECONDS },
    { option: true },
  ],

  adminApi: async ({ playwright }, use) => {
    const api = await newAdminApi(playwright.request);
    await use(api);
    await api.dispose();
  },

  session: async ({ adminApi, sessionSettings }, use) => {
    const quizTitle = `Quiz night ${newUniqueSuffix()}`;
    const quizId = await importQuizNight(adminApi, quizTitle);
    const joinCode = await createSession(
      adminApi,
      quizId,
      quizTitle,
      sessionSettings,
    );
    await use({ joinCode, quizId, quizTitle });
  },

  control: async ({ newContext, session }, use) => {
    const context = await newContext({
      storageState: ADMIN_STORAGE_STATE,
      viewport: LAPTOP_VIEWPORT,
    });
    const control = new ControlScreen(
      await context.newPage(),
      session.joinCode,
    );
    await control.open();
    await use(control);
  },

  display: async ({ newContext, session }, use) => {
    const context = await newContext({ viewport: BIG_SCREEN_VIEWPORT });
    const display = new DisplayScreen(
      await context.newPage(),
      session.joinCode,
    );
    await display.open();
    await use(display);
  },

  newPhoneContext: async ({ newContext }, use) => {
    await use(() => newContext(PHONE_DEVICE));
  },

  joinPhone: async ({ newPhoneContext, session }, use) => {
    await use(async (teamLabel) => {
      const context = await newPhoneContext();
      const phone = new PhoneScreen(
        await context.newPage(),
        `${teamLabel} ${newUniqueSuffix()}`,
        session.joinCode,
      );
      await phone.join();
      return phone;
    });
  },
});

export { expect } from '@playwright/test';
