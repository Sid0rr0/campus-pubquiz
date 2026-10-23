import { isCurrentLeague, venueToday } from '@/league/venue-date';

describe('isCurrentLeague', () => {
  it('is current on its last day and before it', () => {
    expect(isCurrentLeague('2026-10-24', '2026-10-24')).toBe(true);
    expect(isCurrentLeague('2026-10-25', '2026-10-24')).toBe(true);
  });

  it('is over the day after it ends', () => {
    expect(isCurrentLeague('2026-10-23', '2026-10-24')).toBe(false);
  });
});

describe('venueToday', () => {
  it('is the calendar date in Prague, not UTC', () => {
    // 23:30 UTC on 24 Oct is already 25 Oct in Prague (UTC+2).
    expect(venueToday(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25');
    expect(venueToday(new Date('2026-10-24T12:00:00Z'))).toBe('2026-10-24');
  });

  it('is Prague time whatever time zone the server runs in', () => {
    // A server in Auckland: a format with no time zone of its own defaults to
    // it, and 12:00 UTC on 24 Oct is already 25 Oct there.
    const RealFormat = Intl.DateTimeFormat;
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      ((locale: string, options: Intl.DateTimeFormatOptions) =>
        new RealFormat(locale, {
          timeZone: 'Pacific/Auckland',
          ...options,
        })) as never,
    );
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fresh = require('@/league/venue-date') as {
          venueToday: (now: Date) => string;
        };
        expect(fresh.venueToday(new Date('2026-10-24T12:00:00Z'))).toBe(
          '2026-10-24',
        );
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('zero-pads the month and day', () => {
    expect(venueToday(new Date('2026-01-05T10:00:00Z'))).toBe('2026-01-05');
  });
});
