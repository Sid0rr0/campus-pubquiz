import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';

afterEach(() => {
  cleanup();
  // sonner's toast queue is a module-level singleton, not tied to any one
  // render — without this, a toast fired in one test leaks into the next
  // test in the same file that happens to mount a <Toaster />.
  toast.dismiss();
});
