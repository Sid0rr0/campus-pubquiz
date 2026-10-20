import { Check, Entity, OptionalProps, Property } from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { LeagueRepository } from '@/db/repositories/league.repository';

/** A named competition (a semester's) that ended sessions are added to; the dates are a label and decide which leagues are current. */
@Entity({ tableName: 'leagues', repository: () => LeagueRepository })
@Check({
  name: 'leagues_ends_on_check',
  expression: '"ends_on" >= "starts_on"',
})
export class League extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'sortOrder';

  @Property({ type: 'text' })
  name!: string;

  /** Calendar date, `YYYY-MM-DD`. */
  @Property({ type: 'date' })
  startsOn!: string;

  /** Calendar date, `YYYY-MM-DD`. */
  @Property({ type: 'date' })
  endsOn!: string;

  /** Admin-chosen order: higher shows first (within current / ended) on the public page and in the staff list. */
  @Property({ type: 'integer', default: 0 })
  sortOrder: number = 0;
}
