import { Migration } from '@mikro-orm/migrations';

export class Migration20260820083818_AddSessionSettings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" add column "settings" jsonb not null default '{"lockGraceSeconds":60,"enabledBonusCategories":["shot","selfie","custom"],"autoplayMedia":true,"rules":["Max 6 players per team — every additional player costs the team −2 points.","No cheating.","Please write your answers in English (Czech and Slovak also accepted if necessary).","In case of disagreements, the organizers have the final word.","Want to contest something? Come with a credible source."]}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" drop column "settings";`);
  }
}
