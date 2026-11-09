import { Migration } from '@mikro-orm/migrations';

export class Migration20261108130000_AddHighestClueShown extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" add column "highest_clue_shown" jsonb not null default '{}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" drop column "highest_clue_shown";`,
    );
  }
}
