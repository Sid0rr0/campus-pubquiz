import { Migration } from '@mikro-orm/migrations';

export class Migration20261001120000_RetypePictureQuestions extends Migration {
  override async up(): Promise<void> {
    // `picture` was removed as a question type (image vs. audio is inferred
    // from the mediaUrl), but rows saved before that still carry it and fail
    // to load. Its payload is media-only, which free_text reads unchanged.
    this.addSql(
      `update "questions" set "type" = 'free_text' where "type" = 'picture';`,
    );
  }

  override async down(): Promise<void> {
    // Irreversible: the original picture rows can't be told apart afterwards.
  }
}
