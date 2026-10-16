import { Migration } from '@mikro-orm/migrations';

export class Migration20261016094243_AllowHalfStarRoundRatings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "round_ratings" drop constraint round_ratings_stars_check;`,
    );
    this.addSql(
      `alter table "round_ratings" alter column "stars" type real using ("stars"::real);`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint round_ratings_stars_check check(stars between 1 and 5 and stars * 2 = round(stars * 2));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "round_ratings" drop constraint round_ratings_stars_check;`,
    );
    // Half stars can't survive the integer column, so they round down.
    this.addSql(
      `alter table "round_ratings" alter column "stars" type int2 using (floor("stars")::int2);`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint round_ratings_stars_check check((stars >= 1) AND (stars <= 5));`,
    );
  }
}
