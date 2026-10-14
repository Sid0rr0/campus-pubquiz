import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import {
  installUnmockedFetchGuard,
  takeUnmockedRequests,
} from '@/test-utils/unmocked-fetch-guard';

installUnmockedFetchGuard();

afterEach(() => {
  // Take the requests first but throw last, so a failing spec still gets
  // cleaned up and doesn't cascade into the specs after it.
  const unmocked = takeUnmockedRequests();
  cleanup();
  // sonner's toast queue is a module-level singleton, not tied to any one
  // render — without this, a toast fired in one test leaks into the next
  // test in the same file that happens to mount a <Toaster />.
  toast.dismiss();
  if (unmocked.length > 0) {
    throw new Error(
      `Unmocked network request(s) during this test:\n${unmocked.join('\n')}`,
    );
  }
});
