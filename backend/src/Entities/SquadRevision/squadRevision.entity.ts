import { Entity, Index, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import type { SquadState } from '../../shared/domain/lineup-history.js';

/** Append-only record of every persisted squad change, including transfers and sales. */
@Entity()
@Index({ properties: ['participant', 'effectiveAt'] })
export class SquadRevision extends BaseEntity {
  @ManyToOne(() => Participant, { deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @Property()
  sourceKey!: string;

  @Property({ columnType: 'datetime(3)' })
  effectiveAt!: Date;

  @Property({ columnType: 'datetime(3)' })
  acquiredAt!: Date;

  @Property({ columnType: 'datetime(3)', nullable: true })
  releasedAt?: Date | null;

  @Property()
  deleted = false;

  @Property()
  legacyBaseline = false;

  @Property({ type: 'json' })
  state!: SquadState;
}
