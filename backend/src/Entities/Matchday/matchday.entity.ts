import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { League } from '../League/league.entity.js';
import { Match } from '../Match/match.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { ParticipantMatchdayPoints } from '../ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';

@Entity()
@Unique({ properties: ['league', 'season', 'matchdayNumber'] })
export class Matchday extends BaseEntity {
  @ManyToOne(() => League, { nullable: false })
  league!: Rel<League>;

  @Property({ nullable: false })
  season!: string;

  @Property({ nullable: false })
  matchdayNumber!: number;

  @Property({ nullable: false })
  startDate!: Date;

  @Property({ nullable: false })
  endDate!: Date;

  @Property({ nullable: false })
  status!: string;

  @OneToMany(() => Match, (match) => match.matchday, { cascade: [Cascade.ALL] })
  matches = new Collection<Match>(this);

  @OneToMany(() => MatchdayMarket, (matchdayMarket) => matchdayMarket.matchday, {
    cascade: [Cascade.ALL],
  })
  markets = new Collection<MatchdayMarket>(this);

  @OneToMany(() => PlayerPerformance, (playerPerformance) => playerPerformance.matchday, {
    cascade: [Cascade.ALL],
  })
  performances = new Collection<PlayerPerformance>(this);

  @OneToMany(() => ParticipantMatchdayPoints, (participantMatchdayPoints) => participantMatchdayPoints.matchday, {
    cascade: [Cascade.ALL],
  })
  participantMatchdayPoints = new Collection<ParticipantMatchdayPoints>(this);

  @OneToMany(() => PlayerPointsBreakdown, (playerPointsBreakdown) => playerPointsBreakdown.matchday, {
    cascade: [Cascade.ALL],
  })
  pointsBreakdown = new Collection<PlayerPointsBreakdown>(this);
}
