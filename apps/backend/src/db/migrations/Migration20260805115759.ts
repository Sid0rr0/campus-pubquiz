import { Migration } from '@mikro-orm/migrations';

export class Migration20260805115759 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "users" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "username" text not null, "password_hash" text not null, "role" text check ("role" in ('admin', 'moderator')) not null default 'moderator', "status" text check ("status" in ('pending', 'active', 'deactivated')) not null default 'pending');`);
    this.addSql(`alter table "users" add constraint "users_username_unique" unique ("username");`);

    this.addSql(`create table "sessions" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" int not null, "token_hash" text not null, "expires_at" timestamptz not null);`);
    this.addSql(`alter table "sessions" add constraint "sessions_token_hash_unique" unique ("token_hash");`);

    this.addSql(`alter table "sessions" add constraint "sessions_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "sessions" drop constraint "sessions_user_id_foreign";`);

    this.addSql(`drop table if exists "users" cascade;`);

    this.addSql(`drop table if exists "sessions" cascade;`);
  }

}
