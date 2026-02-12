import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Bid } from '../Bid/bid.entity.js';

@Entity()
@Unique({ properties: ['tournament', 'matchday', 'realPlayer'] })
export class MatchdayMarket extends BaseEntity {
  @ManyToOne(() => Tournament, { nullable: false })
  tournament!: Rel<Tournament>;

  @ManyToOne(() => Matchday, { nullable: false })
  matchday!: Rel<Matchday>;

  @ManyToOne(() => RealPlayer, { nullable: false })
  realPlayer!: Rel<RealPlayer>;

  @Property({ nullable: false })
  minimumPrice!: number;

  @Property({ nullable: false })
  origin!: string;

  @ManyToOne(() => Participant, { nullable: true })
  sellerParticipant?: Rel<Participant>;

  @Property({ nullable: false })
  creationDate: Date = new Date();

  @OneToMany(() => Bid, (bid) => bid.matchdayMarket, { cascade: [Cascade.ALL] })
  bids = new Collection<Bid>(this);
}
