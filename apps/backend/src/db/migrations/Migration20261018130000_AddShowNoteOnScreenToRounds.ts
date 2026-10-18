import { Migration } from '@mikro-orm/migrations';

export class Migration20261018130000_AddShowNoteOnScreenToRounds extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "rounds" add column "show_note_on_screen" boolean not null default false;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "rounds" drop column "show_note_on_screen";`);
  }
}
