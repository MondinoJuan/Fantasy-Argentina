import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { Participant } from '../Participant/participant.entity.js';

@Entity()
@Unique({ properties: ['matchdayMarket', 'participant', 'status'] })
export class Bid extends BaseEntity {
  @ManyToOne(() => MatchdayMarket, { nullable: false, deleteRule: 'cascade' })
  matchdayMarket!: Rel<MatchdayMarket>;

  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @Property({ nullable: false })
  offeredAmount!: number;

  @Property({ nullable: false })
  status!: string;

  @Property({ nullable: false })
  bidDate: Date = new Date();

  @Property({ nullable: true })
  cancellationDate?: Date;
}
