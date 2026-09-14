import { Migration } from '@mikro-orm/migrations';

export class Migration20260913120000_AddKahootModeToRounds extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "rounds" add column "kahoot_mode" boolean not null default false;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "rounds" drop column "kahoot_mode";`);
  }
}
