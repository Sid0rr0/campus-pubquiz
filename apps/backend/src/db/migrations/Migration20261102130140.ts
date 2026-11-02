import { Migration } from '@mikro-orm/migrations';

export class Migration20261102130140 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "questions" add column "show_notes_at_reveal" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "questions" drop column "show_notes_at_reveal";`);
  }

}
