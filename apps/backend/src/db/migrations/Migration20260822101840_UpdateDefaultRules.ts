import { Migration } from '@mikro-orm/migrations';

const OLD_DEFAULT_RULES = JSON.stringify([
  'Max 6 players per team — every additional player costs the team −2 points.',
  'No cheating.',
  'Please write your answers in English (Czech and Slovak also accepted if necessary).',
  'In case of disagreements, the organizers have the final word.',
  'Want to contest something? Come with a credible source.',
]);

const NEW_DEFAULT_RULES = JSON.stringify([
  'Max 6 players per team, every additional player costs the team −2 points.',
  'No cheating.',
  'Please write your answers in English.',
  'In case of disagreements, the organizers have the final word.',
  'Want to contest something? Come with a credible source.',
  'In case of no correct answers, the moderator CAN award a bonus point to the team with the funniest answer.',
]);

/**
 * Backfills game_sessions.settings.rules from the old DEFAULT_SESSION_SETTINGS
 * text to the new one, but only for rows that still hold the literal old
 * default array — sessions where an admin customized rules via the lobby
 * settings panel keep whatever they set, since their rules no longer equal
 * OLD_DEFAULT_RULES.
 */
export class Migration20260822101840_UpdateDefaultRules extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `update "game_sessions" set "settings" = jsonb_set("settings", '{rules}', '${NEW_DEFAULT_RULES}'::jsonb) where "settings" -> 'rules' = '${OLD_DEFAULT_RULES}'::jsonb;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "game_sessions" set "settings" = jsonb_set("settings", '{rules}', '${OLD_DEFAULT_RULES}'::jsonb) where "settings" -> 'rules' = '${NEW_DEFAULT_RULES}'::jsonb;`,
    );
  }
}
