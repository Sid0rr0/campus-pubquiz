import { Migration } from '@mikro-orm/migrations';

export class Migration20260928120000_AddNameToGameSessions extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "game_sessions" add column "name" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" drop column "name";`);
  }
}
