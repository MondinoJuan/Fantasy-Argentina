import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Rel, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { PlayerClause } from '../PlayerClause/playerClause.entity.js';
import { Negotiation } from '../Negotiation/negotiation.entity.js';

@Entity()
@Unique({ properties: ['tournament', 'realPlayer'] })
export class DependantPlayer extends BaseEntity {
  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @Property({ nullable: true })
  marketValue?: number | null;

  @OneToMany(() => MatchdayMarket, (matchdayMarket) => matchdayMarket.dependantPlayer, {
    cascade: [Cascade.ALL],
  })
  markets = new Collection<MatchdayMarket>(this);

  @OneToMany(() => PlayerClause, (playerClause) => playerClause.dependantPlayer, {
    cascade: [Cascade.ALL],
  })
  clauses = new Collection<PlayerClause>(this);

  @OneToMany(() => Negotiation, (negotiation) => negotiation.dependantPlayer, {
    cascade: [Cascade.ALL],
  })
  negotiations = new Collection<Negotiation>(this);
}
