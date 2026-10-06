import { Migration } from '@mikro-orm/migrations';

export class Migration20261006120000_AddOpenedQuestionIdsToGameSessions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" add column "opened_question_ids" jsonb null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" drop column "opened_question_ids";`,
    );
  }
}
