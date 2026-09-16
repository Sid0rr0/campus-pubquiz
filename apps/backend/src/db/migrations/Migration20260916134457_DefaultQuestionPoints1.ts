import { Migration } from '@mikro-orm/migrations';

export class Migration20260916134457_DefaultQuestionPoints1 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "questions" alter column "points" set default 1;`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "questions" alter column "points" set default 1000;`,
    );
  }
}
