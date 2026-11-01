import { Migration } from '@mikro-orm/migrations';

export class Migration20261030104307_AddCoinAwards extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "coin_awards" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "team_id" int not null, "coins" int not null, "reason" text null, "bonus_award_id" int null);`);
    this.addSql(`create index "coin_awards_game_session_id_team_id_index" on "coin_awards" ("game_session_id", "team_id");`);

    this.addSql(`alter table "coin_awards" add constraint "coin_awards_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "coin_awards" add constraint "coin_awards_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "coin_awards" add constraint "coin_awards_bonus_award_id_foreign" foreign key ("bonus_award_id") references "bonus_awards" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "coin_awards" cascade;`);
  }

}
