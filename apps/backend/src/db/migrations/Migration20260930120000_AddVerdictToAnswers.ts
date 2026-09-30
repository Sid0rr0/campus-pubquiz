import { Migration } from '@mikro-orm/migrations';

export class Migration20260930120000_AddVerdictToAnswers extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "answers" add column "verdict" text null;`);
    // Backfill graded rows from their points, mirroring Scoring's
    // verdictForManualGrade: zero is incorrect, the question's points or more
    // is correct, anything between is partial. Historical kahoot answers were
    // speed-scaled, so they land on partial — accepted, the exact verdict
    // isn't recoverable.
    this.addSql(`
      update "answers" as a
      set "verdict" = case
        when a."points_awarded" <= 0 then 'incorrect'
        when a."points_awarded" >= q."points" then 'correct'
        else 'partial'
      end
      from "questions" as q
      where q."id" = a."question_id" and a."graded_at" is not null;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "answers" drop column "verdict";`);
  }
}
