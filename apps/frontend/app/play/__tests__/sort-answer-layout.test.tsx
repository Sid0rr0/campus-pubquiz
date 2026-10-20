import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SortAnswer } from '@/app/play/sort-answer';

const LINE_HEIGHT = 28;
const LONG_OPTION = 'The Great Fire of London';

/** jsdom has no layout, so this stands in for a phone where a long option wraps in the inline row layout but fits on one line in the stacked layout, which gives the text more width. */
function stubPhoneLayout(rowWidth: { current: number }) {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  const originalGetComputedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
    element.tagName === 'SPAN' && element.closest('li')
      ? ({ lineHeight: `${LINE_HEIGHT}px` } as CSSStyleDeclaration)
      : originalGetComputedStyle(element, pseudo),
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === 'LI' ? rowWidth.current : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      const row = this.closest('li');
      const textWidth = row?.className.includes('items-start') ? 207 : 156;
      const fitsOnOneLine = rowWidth.current - 343 + textWidth >= 200;
      return fitsOnOneLine ? LINE_HEIGHT : LINE_HEIGHT * 2;
    },
  );

  /** Fires every row's ResizeObserver, as the browser does after each re-layout. */
  function resize() {
    act(() => {
      resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });
  }
  return resize;
}

function longOptionRow(): HTMLElement {
  return screen.getByText(LONG_OPTION).closest('li') as HTMLElement;
}

describe('SortAnswer — long option layout', () => {
  const rowWidth = { current: 343 };
  let resize: () => void;

  beforeEach(() => {
    rowWidth.current = 343;
    resize = stubPhoneLayout(rowWidth);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('settles on the stacked layout instead of flipping back and forth when the stacked layout un-wraps the text', () => {
    render(<SortAnswer options={[LONG_OPTION, 'Rome']} onSubmit={() => {}} />);

    const layouts: string[] = [];
    for (let tick = 0; tick < 6; tick++) {
      resize();
      layouts.push(longOptionRow().className);
    }

    expect(new Set(layouts.slice(1)).size).toBe(1);
    expect(longOptionRow().className).toContain('items-start');
  });

  it('returns to the inline layout once the row gets wider, e.g. the phone is rotated to landscape', () => {
    render(<SortAnswer options={[LONG_OPTION, 'Rome']} onSubmit={() => {}} />);
    resize();
    expect(longOptionRow().className).toContain('items-start');

    rowWidth.current = 700;
    resize();

    expect(longOptionRow().className).not.toContain('items-start');
  });
});
