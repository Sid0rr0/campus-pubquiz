import { Migration } from '@mikro-orm/migrations';

export class Migration20261025203931_AddPacingAndFeltDifficultyToSessionFeedback extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "session_feedback" add column "pacing" text check ("pacing" in ('too_slow', 'just_right', 'too_fast')) null, add column "felt_difficulty" text check ("felt_difficulty" in ('too_easy', 'just_right', 'too_hard')) null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "session_feedback" drop column "pacing", drop column "felt_difficulty";`,
    );
  }
}
