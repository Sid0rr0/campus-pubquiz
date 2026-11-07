import { Migration } from '@mikro-orm/migrations';

export class Migration20261107120000_RenameKahootToQuickfire extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "rounds" rename column "kahoot_mode" to "quickfire";`,
    );
    this.addSql(
      `alter table "game_sessions" rename column "revealed_kahoot_question_ids" to "revealed_quickfire_question_ids";`,
    );
    this.addSql(
      `update "game_sessions" set "settings" = ("settings" - 'kahootQuestionTimerSeconds') || jsonb_build_object('quickfireQuestionTimerSeconds', "settings"->'kahootQuestionTimerSeconds') where "settings" ? 'kahootQuestionTimerSeconds';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "game_sessions" set "settings" = ("settings" - 'quickfireQuestionTimerSeconds') || jsonb_build_object('kahootQuestionTimerSeconds', "settings"->'quickfireQuestionTimerSeconds') where "settings" ? 'quickfireQuestionTimerSeconds';`,
    );
    this.addSql(
      `alter table "game_sessions" rename column "revealed_quickfire_question_ids" to "revealed_kahoot_question_ids";`,
    );
    this.addSql(
      `alter table "rounds" rename column "quickfire" to "kahoot_mode";`,
    );
  }
}
