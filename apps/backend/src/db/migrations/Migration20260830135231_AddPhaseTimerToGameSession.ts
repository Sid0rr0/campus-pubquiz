import { Migration } from '@mikro-orm/migrations';

export class Migration20260830135231_AddPhaseTimerToGameSession extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "game_sessions" add column "live_phase_key" text null, add column "phase_started_at" timestamptz null, add column "phase_elapsed_by_key" jsonb not null default '{}';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_sessions" drop column "live_phase_key", drop column "phase_started_at", drop column "phase_elapsed_by_key";`);
  }

}
