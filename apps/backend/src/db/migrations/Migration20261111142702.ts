import { Migration } from '@mikro-orm/migrations';

export class Migration20261111142702 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "game_session_teams" add column "side_id" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "game_session_teams" drop column "side_id";`);
  }

}
