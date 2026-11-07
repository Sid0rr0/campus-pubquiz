import { Migration } from '@mikro-orm/migrations';

export class Migration20261107130000_MoveQuickfireToQuizMode extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "quizzes" add column "mode" text not null default 'pub';`,
    );
    // A quiz with both kinds of round has no mode to become: stop rather than guess.
    this.addSql(
      `do $$ begin if exists (select 1 from "quizzes" q where exists (select 1 from "rounds" r where r.quiz_id = q.id and r.quickfire) and exists (select 1 from "rounds" r where r.quiz_id = q.id and not r.quickfire)) then raise exception 'A quiz mixes quickfire and pub rounds; split it before migrating'; end if; end $$;`,
    );
    this.addSql(
      `update "quizzes" q set "mode" = 'quickfire' where exists (select 1 from "rounds" r where r.quiz_id = q.id and r.quickfire);`,
    );
    this.addSql(`alter table "rounds" drop column "quickfire";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "rounds" add column "quickfire" boolean not null default false;`,
    );
    this.addSql(
      `update "rounds" r set "quickfire" = true from "quizzes" q where q.id = r.quiz_id and q."mode" = 'quickfire';`,
    );
    this.addSql(`alter table "quizzes" drop column "mode";`);
  }
}
