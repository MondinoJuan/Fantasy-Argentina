import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { League } from '../League/league.entity.js';
import { MatchStatus } from '../../shared/domain-enums.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';

@Entity()
@Unique({ properties: ['externalApiId'] })
export class Match extends BaseEntity {
  @ManyToOne(() => Matchday, { nullable: false, deleteRule: 'cascade' })
  matchday!: Rel<Matchday>;

  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade' })
  league!: Rel<League>;

  @Property({ nullable: false })
  externalApiId!: string;

  @Property({ nullable: false })
  homeTeam!: string;

  @Property({ nullable: false })
  awayTeam!: string;

  @Property({ nullable: false })
  startDateTime!: Date;

  @Property({ nullable: false })
  status!: MatchStatus;


  @Property({ nullable: true })
  homeScore?: number | null;

  @Property({ nullable: true })
  awayScore?: number | null;

  @OneToMany(() => PlayerPerformance, (playerPerformance) => playerPerformance.match, {
    cascade: [Cascade.ALL],
  })
  performances = new Collection<PlayerPerformance>(this);
}
