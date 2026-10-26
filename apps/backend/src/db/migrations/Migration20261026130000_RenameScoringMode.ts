import { Migration } from '@mikro-orm/migrations';

export class Migration20261026130000_RenameScoringMode extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `update "questions" set "payload" = ("payload" - 'matchScoringMode') || jsonb_build_object('scoringMode', case "payload"->>'matchScoringMode' when 'partial' then 'per_item' when 'all_or_nothing' then 'one_off' else "payload"->>'matchScoringMode' end) where jsonb_exists("payload", 'matchScoringMode');`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "questions" set "payload" = ("payload" - 'scoringMode') || jsonb_build_object('matchScoringMode', case "payload"->>'scoringMode' when 'per_item' then 'partial' when 'one_off' then 'all_or_nothing' else "payload"->>'scoringMode' end) where "type" = 'match' and jsonb_exists("payload", 'scoringMode');`,
    );
    this.addSql(
      `update "questions" set "payload" = "payload" - 'scoringMode' where "type" = 'sort' and jsonb_exists("payload", 'scoringMode');`,
    );
  }
}
