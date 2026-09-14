import { Migration } from '@mikro-orm/migrations';

export class Migration20260914145701_DefaultQuestionPoints1000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" alter column "settings" type jsonb using ("settings"::jsonb);`,
    );
    this.addSql(
      `alter table "game_sessions" alter column "settings" set default '{"lockGraceSeconds": 60, "enabledBonusCategories": ["shot", "selfie", "custom"], "autoplayMedia": true, "playLockCountdownSound": true, "showRoundOverview": false, "maxBonusAwardsPerCategory": {"shot": 2, "selfie": 1}, "maxPlayersPerTeam": 6, "extraPlayerPenaltyPoints": 2, "kahootQuestionTimerSeconds": null, "rules": ["No cheating.", "Please write your answers in English.", "In case of disagreements, the organizers have the final word.", "Want to contest something? Come with a credible source.", "In case of no correct answers, the moderator CAN award a bonus point to the team with the funniest answer."]}';`,
    );

    this.addSql(
      `alter table "questions" alter column "points" type int using ("points"::int);`,
    );
    this.addSql(
      `alter table "questions" alter column "points" set default 1000;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "game_sessions" alter column "settings" type jsonb using ("settings"::jsonb);`,
    );
    this.addSql(
      `alter table "game_sessions" alter column "settings" set default '{"rules": ["Max 6 players per team — every additional player costs the team −2 points.", "No cheating.", "Please write your answers in English (Czech and Slovak also accepted if necessary).", "In case of disagreements, the organizers have the final word.", "Want to contest something? Come with a credible source."], "autoplayMedia": true, "lockGraceSeconds": 60, "enabledBonusCategories": ["shot", "selfie", "custom"]}';`,
    );

    this.addSql(
      `alter table "questions" alter column "points" type int4 using ("points"::int4);`,
    );
    this.addSql(`alter table "questions" alter column "points" set default 1;`);
  }
}
