import { Migration } from '@mikro-orm/migrations';

export class Migration20261103113530 extends Migration {

  override async up(): Promise<void> {
    // A repeated code would fail the constraint: the newer team keeps its code with its id appended.
    this.addSql(`update "teams" set "code" = "code" || '-' || "id" where "id" not in (select min("id") from "teams" group by "code");`);
    this.addSql(`alter table "teams" add constraint "teams_code_unique" unique ("code");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "teams" drop constraint "teams_code_unique";`);
  }

}
