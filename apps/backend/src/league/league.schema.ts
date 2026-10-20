import { z } from 'zod';

const MAX_LEAGUE_NAME_LENGTH = 200;

export const leagueFieldsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name is required')
      .max(MAX_LEAGUE_NAME_LENGTH),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
  })
  .refine(({ startsOn, endsOn }) => endsOn >= startsOn, {
    message: '"endsOn" must not be before "startsOn"',
    path: ['endsOn'],
  });

export const addLeagueSessionSchema = z.object({
  gameSessionId: z.number().int().positive(),
});

const MAX_LEAGUES_PER_SESSION = 100;

/** The leagues ticked for a session: a set of league ids, replacing what was there. */
export const leagueIdsSchema = z
  .array(z.number().int().positive())
  .max(MAX_LEAGUES_PER_SESSION);

export const leaguesQuerySchema = z.object({
  current: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
