import { Migration } from '@mikro-orm/migrations';

export class Migration20260926195828_AddResponseMsToAnswers extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "answers" add column "response_ms" int null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "answers" drop column "response_ms";`);
  }
}
