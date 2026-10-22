import { Migration } from '@mikro-orm/migrations';

export class Migration20261022120000_AddSessionTeamJokers extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "session_team_jokers" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "team_id" int not null, "round_id" int not null, "source" text not null);`,
    );
    this.addSql(
      `alter table "session_team_jokers" add constraint "session_team_jokers_game_session_id_team_id_unique" unique ("game_session_id", "team_id");`,
    );
    this.addSql(
      `alter table "session_team_jokers" add constraint "session_team_jokers_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "session_team_jokers" add constraint "session_team_jokers_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "session_team_jokers" add constraint "session_team_jokers_round_id_foreign" foreign key ("round_id") references "rounds" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "session_team_jokers" cascade;`);
  }
}
