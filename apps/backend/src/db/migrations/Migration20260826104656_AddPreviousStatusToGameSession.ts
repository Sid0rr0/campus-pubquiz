import { Migration } from '@mikro-orm/migrations';

export class Migration20260826104656_AddPreviousStatusToGameSession extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" add column "previous_status" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" drop column "previous_status";`);
  }
}
