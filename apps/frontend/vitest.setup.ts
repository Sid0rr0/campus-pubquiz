import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import {
  installUnmockedFetchGuard,
  takeUnmockedRequests,
} from '@/test-utils/unmocked-fetch-guard';

installUnmockedFetchGuard();

// happy-dom has no window.confirm, and vitest 4 won't spy on a missing
// property; a call no spec has spied on should still fail loudly.
window.confirm = () => {
  throw new Error('window.confirm called without vi.spyOn');
};

const STORAGE_METHODS = [
  'getItem',
  'setItem',
  'removeItem',
  'clear',
  'key',
] as const;

afterEach(() => {
  // vitest 4 restores a spy on localStorage.setItem etc. by deleting it, which
  // happy-dom's Storage proxy ignores, so put the real methods back by hand.
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const method of STORAGE_METHODS) {
      Object.defineProperty(storage, method, {
        value: Storage.prototype[method],
        configurable: true,
        writable: true,
      });
    }
  }
});

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
