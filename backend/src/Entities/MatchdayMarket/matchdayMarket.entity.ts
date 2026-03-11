import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Bid } from '../Bid/bid.entity.js';
import { MarketOrigin } from '../../shared/domain-enums.js';

@Entity()
@Unique({ properties: ['tournament', 'matchday', 'creationDate'] })
export class MatchdayMarket extends BaseEntity {
  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @ManyToOne(() => Matchday, { nullable: false, deleteRule: 'cascade' })
  matchday!: Rel<Matchday>;

  @Property({ type: 'json', nullable: false })
  dependantPlayerIds: number[] = [];

  @Property({ nullable: false })
  minimumPrice!: number;

  @Property({ nullable: false })
  origin!: MarketOrigin;

  @ManyToOne(() => Participant, { nullable: true, deleteRule: 'cascade' })
  sellerParticipant?: Rel<Participant>;

  @Property({ nullable: false })
  creationDate: Date = new Date();

  @OneToMany(() => Bid, (bid) => bid.matchdayMarket, { cascade: [Cascade.ALL] })
  bids = new Collection<Bid>(this);
}
