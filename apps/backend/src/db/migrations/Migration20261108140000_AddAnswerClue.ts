import { Migration } from '@mikro-orm/migrations';

export class Migration20261108140000_AddAnswerClue extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "answers" add column "clue" int null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "answers" drop column "clue";`);
  }
}
