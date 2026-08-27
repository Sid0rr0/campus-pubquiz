import { Migration } from '@mikro-orm/migrations';

export class Migration20260827115504_AddShowdownTables extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "showdown_rounds" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "order_index" int not null, "question" text not null, "answer" text not null, "points" real not null, "winner_team_id" int null, "is_tie" boolean not null default false, "resolved_at" timestamptz null);`);
    this.addSql(`alter table "showdown_rounds" add constraint "showdown_rounds_game_session_id_order_index_unique" unique ("game_session_id", "order_index");`);

    this.addSql(`create table "showdown_round_teams" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "showdown_round_id" int not null, "team_id" int not null, "seat_index" int not null, "guess" text null);`);
    this.addSql(`alter table "showdown_round_teams" add constraint "showdown_round_teams_showdown_round_id_team_id_unique" unique ("showdown_round_id", "team_id");`);

    this.addSql(`alter table "showdown_rounds" add constraint "showdown_rounds_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "showdown_rounds" add constraint "showdown_rounds_winner_team_id_foreign" foreign key ("winner_team_id") references "teams" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "showdown_round_teams" add constraint "showdown_round_teams_showdown_round_id_foreign" foreign key ("showdown_round_id") references "showdown_rounds" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "showdown_round_teams" add constraint "showdown_round_teams_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "showdown_round_teams" drop constraint "showdown_round_teams_showdown_round_id_foreign";`);

    this.addSql(`drop table if exists "showdown_rounds" cascade;`);

    this.addSql(`drop table if exists "showdown_round_teams" cascade;`);
  }

}
