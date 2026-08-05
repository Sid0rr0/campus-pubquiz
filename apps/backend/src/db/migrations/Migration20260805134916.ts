import { Migration } from '@mikro-orm/migrations';

export class Migration20260805134916 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create index "bonus_awards_game_session_id_team_id_index" on "bonus_awards" ("game_session_id", "team_id");`);

    this.addSql(`create index "answers_game_session_id_team_id_index" on "answers" ("game_session_id", "team_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "answers_game_session_id_team_id_index";`);

    this.addSql(`drop index "bonus_awards_game_session_id_team_id_index";`);
  }

}
