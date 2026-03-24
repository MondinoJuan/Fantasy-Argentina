import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { BidStatus } from '../../shared/domain-enums.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';

@Entity()
@Unique({ properties: ['tournament', 'participant', 'realPlayer'] })
export class Bid extends BaseEntity {
  @ManyToOne(() => MatchdayMarket, { nullable: false, deleteRule: 'cascade' })
  matchdayMarket!: Rel<MatchdayMarket>;

  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @Property({ nullable: false })
  offeredAmount!: number;

  @Property({ nullable: false })
  status!: BidStatus;

  @Property({ nullable: false })
  bidDate: Date = new Date();

  @Property({ nullable: true })
  cancellationDate?: Date;
}
