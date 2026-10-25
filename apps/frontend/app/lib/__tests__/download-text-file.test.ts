import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '@/app/lib/download-text-file';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('downloadTextFile', () => {
  it('clicks a temporary link to an in-memory blob of the content, then frees the blob URL', async () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:fake-url';
    });
    const revokeObjectURL = vi.fn();
    // jsdom has no blob URLs, so these exist only for the length of this spec.
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
      // The blob must still be reachable at the moment of the click.
      expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    downloadTextFile('quiz.csv', 'a,b\n1,2', 'text/csv');

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.getAttribute('href')).toBe('blob:fake-url');
    expect(clicked[0]?.download).toBe('quiz.csv');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('text/csv');
    expect(await blob?.text()).toBe('a,b\n1,2');
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:fake-url');
  });
});
