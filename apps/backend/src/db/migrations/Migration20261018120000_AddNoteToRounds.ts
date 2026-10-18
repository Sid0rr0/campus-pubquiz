import { Migration } from '@mikro-orm/migrations';

export class Migration20261018120000_AddNoteToRounds extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "rounds" add column "note" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "rounds" drop column "note";`);
  }
}
