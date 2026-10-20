import { z } from 'zod';

const MAX_TEAM_CODE_LENGTH = 64;

/** The body of every team page request: the team code, which never goes in a URL. */
export const teamPageBodySchema = z.object({
  teamCode: z.string().trim().min(1).max(MAX_TEAM_CODE_LENGTH),
});
