import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { PlayerClause } from '../PlayerClause/playerClause.entity.js';
import { Participant } from '../Participant/participant.entity.js';

@Entity()
export class Shielding extends BaseEntity {
  @ManyToOne(() => PlayerClause, { nullable: false, deleteRule: 'cascade' })
  playerClause!: Rel<PlayerClause>;

  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @Property({ nullable: false })
  investedAmount!: number;

  @Property({ nullable: false })
  clauseIncrease!: number;

  @Property({ nullable: false })
  shieldingDate: Date = new Date();
}
