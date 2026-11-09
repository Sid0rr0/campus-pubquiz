import { Migration } from '@mikro-orm/migrations';

export class Migration20261108120000_AllowHalfQuestionPoints extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "questions" alter column "points" type real using ("points"::real);`,
    );
  }

  override async down(): Promise<void> {
    // Half points (a Clue question's) can't survive the integer column, so they round up.
    this.addSql(
      `alter table "questions" alter column "points" type int using (ceil("points")::int);`,
    );
  }
}
