import { Migration } from '@mikro-orm/migrations';

// A payload has choices when `options` is a JSON array with at least one
// non-blank string, the same test `resolveAnswerKind` used for the choice kind.
// `case` guarantees `jsonb_array_elements` only sees arrays (an `and` gives no
// evaluation-order promise), and `\\S` makes blank mean JS `.trim()` does
// (tabs and newlines included).
const HAS_CHOICES = `(
  case when jsonb_typeof("payload" -> 'options') = 'array' then exists (
    select 1
    from jsonb_array_elements("payload" -> 'options') as option
    where jsonb_typeof(option) = 'string' and (option #>> '{}') ~ '\\S'
  ) else false end
)`;

export class Migration20261018120000_RetypeMediaQuestions extends Migration {
  override async up(): Promise<void> {
    // `audio` and `youtube` are being removed as question types: media is
    // carried by any question and inferred from the URL. Rows with choices
    // become multiple_choice (options kept); the rest become free_text, and
    // their stale `options` key is dropped. Every other payload field (media
    // URLs, clip bounds, isVideoHidden) is kept. Order matters: the
    // multiple_choice update runs first, while the type still marks the row.
    this.addSql(
      `update "questions" set "type" = 'multiple_choice'
       where "type" in ('audio', 'youtube') and ${HAS_CHOICES};`,
    );
    this.addSql(
      `update "questions" set "type" = 'free_text', "payload" = "payload" - 'options'
       where "type" in ('audio', 'youtube');`,
    );
  }

  override async down(): Promise<void> {
    // Irreversible: the original audio/youtube rows can't be told apart
    // afterwards from questions that were always free_text/multiple_choice.
  }
}
