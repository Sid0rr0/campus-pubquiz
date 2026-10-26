import { Migration } from '@mikro-orm/migrations';

export class Migration20261026153740_AddRevealedKahootQuestionIdsToGameSessions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" add column "revealed_kahoot_question_ids" jsonb not null default '[]';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" drop column "revealed_kahoot_question_ids";`,
    );
  }
}
