import { Migration } from '@mikro-orm/migrations';

export class Migration20261030104541 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "purchases" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "team_id" int not null, "power_up" text not null, "question_id" int null, "round_id" int null, "cost" int not null, "effect" jsonb not null);`);
    this.addSql(`create index "purchases_game_session_id_team_id_index" on "purchases" ("game_session_id", "team_id");`);

    this.addSql(`alter table "purchases" add constraint "purchases_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "purchases" add constraint "purchases_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "purchases" add constraint "purchases_question_id_foreign" foreign key ("question_id") references "questions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "purchases" add constraint "purchases_round_id_foreign" foreign key ("round_id") references "rounds" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "purchases" cascade;`);
  }

}
