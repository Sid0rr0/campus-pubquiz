import { Migration } from '@mikro-orm/migrations';

export class Migration20261020140000_AddLeagueSortOrder extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "leagues" add column "sort_order" int not null default 0;`,
    );
    // Keep today's order (newest start date first): the newest gets the highest value.
    this.addSql(
      `update "leagues" set "sort_order" = ranked.rank from (select "id", row_number() over (order by "starts_on" asc, "id" asc) as rank from "leagues") as ranked where "leagues"."id" = ranked."id";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "leagues" drop column "sort_order";`);
  }
}
