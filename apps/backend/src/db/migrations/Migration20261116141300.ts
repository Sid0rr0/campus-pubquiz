import { Migration } from '@mikro-orm/migrations';

export class Migration20261116141300 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "bonus_awards" add column "block_first_question_id" int null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "bonus_awards" drop column "block_first_question_id";`);
  }

}
