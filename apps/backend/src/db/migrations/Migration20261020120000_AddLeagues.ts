import { Migration } from '@mikro-orm/migrations';

export class Migration20261020120000_AddLeagues extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "leagues" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" text not null, "starts_on" date not null, "ends_on" date not null, constraint leagues_ends_on_check check ("ends_on" >= "starts_on"));`,
    );
    this.addSql(
      `create table "league_sessions" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "league_id" int not null, "game_session_id" int not null);`,
    );
    this.addSql(
      `alter table "league_sessions" add constraint "league_sessions_league_id_game_session_id_unique" unique ("league_id", "game_session_id");`,
    );
    this.addSql(
      `alter table "league_sessions" add constraint "league_sessions_league_id_foreign" foreign key ("league_id") references "leagues" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "league_sessions" add constraint "league_sessions_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "league_sessions" cascade;`);
    this.addSql(`drop table if exists "leagues" cascade;`);
  }
}
