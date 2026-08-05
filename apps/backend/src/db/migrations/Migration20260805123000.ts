import { Migration } from '@mikro-orm/migrations';

export class Migration20260805123000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "game_sessions" alter column "furthest_open_index" type int using ("furthest_open_index"::int);`);
    this.addSql(`alter table "game_sessions" alter column "furthest_open_index" set default -1;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" alter column "furthest_open_index" type int4 using ("furthest_open_index"::int4);`);
    this.addSql(`alter table "game_sessions" alter column "furthest_open_index" set default 0;`);
  }

}
