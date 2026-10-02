import { Migration } from '@mikro-orm/migrations';

export class Migration20261002120000_AddRoundRatings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "round_ratings" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "round_id" int not null, "team_id" int not null, "stars" smallint not null);`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint "round_ratings_stars_check" check ("stars" between 1 and 5);`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint "round_ratings_game_session_id_round_id_team_id_unique" unique ("game_session_id", "round_id", "team_id");`,
    );
    this.addSql(
      `create index "round_ratings_game_session_id_team_id_index" on "round_ratings" ("game_session_id", "team_id");`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint "round_ratings_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint "round_ratings_round_id_foreign" foreign key ("round_id") references "rounds" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "round_ratings" add constraint "round_ratings_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "round_ratings" cascade;`);
  }
}
