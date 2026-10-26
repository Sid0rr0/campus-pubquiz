import { Migration } from '@mikro-orm/migrations';

export class Migration20261026104534_AddClosedAtToGameSessions extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "game_sessions" add column "closed_at" timestamptz null;`);
    // Boot used to reload only the newest session, so every older one counts as closed.
    this.addSql(
      `update "game_sessions" set "closed_at" = now() where "id" <> (select "id" from "game_sessions" order by "created_at" desc, "id" desc limit 1);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" drop column "closed_at";`);
  }

}
