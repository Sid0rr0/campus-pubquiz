import { Migration } from '@mikro-orm/migrations';

export class Migration20260805120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "game_sessions" add column "furthest_open_index" int not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" drop column "furthest_open_index";`);
  }

}
