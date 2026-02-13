import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { PlayerClause } from '../PlayerClause/playerClause.entity.js';
import { Negotiation } from '../Negotiation/negotiation.entity.js';

@Entity()
export class RealPlayer extends BaseEntity {
  @Property({ nullable: false })
  externalApiId!: string;

  @Property({ nullable: false })
  name!: string;

  @Property({ nullable: false })
  position!: string;

  @ManyToOne(() => RealTeam, { nullable: false, deleteRule: 'cascade' })
  realTeam!: Rel<RealTeam>;

  @Property({ nullable: false })
  marketValue!: number;

  @Property({ nullable: false, default: true })
  active: boolean = true;

  @Property({ nullable: false })
  lastUpdate: Date = new Date();

  @OneToMany(() => ParticipantSquad, (participantSquad) => participantSquad.realPlayer, {
    cascade: [Cascade.ALL],
  })
  participantSquads = new Collection<ParticipantSquad>(this);

  @OneToMany(() => MatchdayMarket, (matchdayMarket) => matchdayMarket.realPlayer, {
    cascade: [Cascade.ALL],
  })
  markets = new Collection<MatchdayMarket>(this);

  @OneToMany(() => PlayerPerformance, (playerPerformance) => playerPerformance.realPlayer, {
    cascade: [Cascade.ALL],
  })
  performances = new Collection<PlayerPerformance>(this);

  @OneToMany(() => PlayerPointsBreakdown, (playerPointsBreakdown) => playerPointsBreakdown.realPlayer, {
    cascade: [Cascade.ALL],
  })
  pointsBreakdowns = new Collection<PlayerPointsBreakdown>(this);

  @OneToMany(() => PlayerClause, (playerClause) => playerClause.realPlayer, {
    cascade: [Cascade.ALL],
  })
  clauses = new Collection<PlayerClause>(this);

  @OneToMany(() => Negotiation, (negotiation) => negotiation.realPlayer, {
    cascade: [Cascade.ALL],
  })
  negotiations = new Collection<Negotiation>(this);
}
