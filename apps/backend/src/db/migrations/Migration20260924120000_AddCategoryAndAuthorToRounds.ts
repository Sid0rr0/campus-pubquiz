import { Migration } from '@mikro-orm/migrations';

export class Migration20260924120000_AddCategoryAndAuthorToRounds extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "rounds" add column "category" text null, add column "author" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "rounds" drop column "category", drop column "author";`,
    );
  }
}
