import { Migration } from '@mikro-orm/migrations';

export class Migration20261008120000_AddIsJoinOverlayVisibleToGameSessions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" add column "is_join_overlay_visible" boolean not null default false;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" drop column "is_join_overlay_visible";`,
    );
  }
}
