import { Migration } from '@mikro-orm/migrations';

export class Migration20260804165754 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "bonus_awards" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "team_id" int not null, "category" text check ("category" in ('shot', 'selfie', 'custom')) not null, "reason" text null, "points" real not null);`);

    this.addSql(`alter table "bonus_awards" add constraint "bonus_awards_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "bonus_awards" add constraint "bonus_awards_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bonus_awards" cascade;`);
  }

}
