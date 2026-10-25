import { describe, expect, it } from 'vitest';
import { formatResponseMs } from '@/app/stats/[id]/format-response-ms';

describe('formatResponseMs', () => {
  it('says "Not recorded" when the session has no response time', () => {
    expect(formatResponseMs(null)).toBe('Not recorded');
  });

  it('shows milliseconds as seconds with one decimal', () => {
    expect(formatResponseMs(4321)).toBe('4.3s');
    expect(formatResponseMs(12000)).toBe('12.0s');
  });

  it('shows a zero response time as 0.0s rather than not recorded', () => {
    expect(formatResponseMs(0)).toBe('0.0s');
  });
});
