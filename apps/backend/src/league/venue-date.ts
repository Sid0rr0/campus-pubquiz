/** The venue's time zone: no time-zone setting exists, so every "today" is Prague's. */
export const VENUE_TIME_ZONE = 'Europe/Prague';

const venueDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: VENUE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date (`YYYY-MM-DD`) it is at the venue at `now`. */
export function venueToday(now: Date): string {
  return venueDateFormat.format(now);
}
