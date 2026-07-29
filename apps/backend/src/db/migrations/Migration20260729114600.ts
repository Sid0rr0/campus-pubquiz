import { Migration } from '@mikro-orm/migrations';

export class Migration20260729114600 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "quizzes" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "title" text not null);`);

    this.addSql(`create table "game_sessions" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "quiz_id" int not null, "join_code" text not null, "status" text not null default 'lobby', "current_round_index" int not null default 0, "current_question_index" int not null default 0, "reveal_index" int not null default 0, "is_leaderboard_visible" boolean not null default false);`);
    this.addSql(`alter table "game_sessions" add constraint "game_sessions_join_code_unique" unique ("join_code");`);

    this.addSql(`create table "rounds" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "quiz_id" int not null, "title" text not null, "order_index" int not null, "break_after" boolean not null default false);`);
    this.addSql(`alter table "rounds" add constraint "rounds_quiz_id_order_index_unique" unique ("quiz_id", "order_index");`);

    this.addSql(`create table "questions" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "round_id" int not null, "order_index" int not null, "type" text not null, "prompt" text not null, "answer" text not null, "notes" text null, "payload" jsonb not null, "points" int not null default 1);`);
    this.addSql(`alter table "questions" add constraint "questions_round_id_order_index_unique" unique ("round_id", "order_index");`);

    this.addSql(`create table "teams" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" text not null, "token" text not null, "code" text not null);`);
    this.addSql(`alter table "teams" add constraint "teams_name_unique" unique ("name");`);
    this.addSql(`alter table "teams" add constraint "teams_token_unique" unique ("token");`);

    this.addSql(`create table "game_session_teams" ("game_session_id" int not null, "team_id" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "game_session_teams_pkey" primary key ("game_session_id", "team_id"));`);

    this.addSql(`create table "answers" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "game_session_id" int not null, "question_id" int not null, "team_id" int not null, "value" text not null, "points_awarded" real not null default 0, "graded_at" timestamptz null);`);
    this.addSql(`alter table "answers" add constraint "answers_game_session_id_question_id_team_id_unique" unique ("game_session_id", "question_id", "team_id");`);

    this.addSql(`alter table "game_sessions" add constraint "game_sessions_quiz_id_foreign" foreign key ("quiz_id") references "quizzes" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "rounds" add constraint "rounds_quiz_id_foreign" foreign key ("quiz_id") references "quizzes" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "questions" add constraint "questions_round_id_foreign" foreign key ("round_id") references "rounds" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "game_session_teams" add constraint "game_session_teams_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "game_session_teams" add constraint "game_session_teams_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "answers" add constraint "answers_game_session_id_foreign" foreign key ("game_session_id") references "game_sessions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "answers" add constraint "answers_question_id_foreign" foreign key ("question_id") references "questions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "answers" add constraint "answers_team_id_foreign" foreign key ("team_id") references "teams" ("id") on update cascade on delete cascade;`);
  }

}
