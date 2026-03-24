import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { GameMatch } from '../GameMatch/gameMatch.entity.js';
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { League } from '../League/league.entity.js';

@Entity()
@Unique({ properties: ['realPlayer', 'matchday', 'league', 'match'] })
export class PlayerPerformance extends BaseEntity {
  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @ManyToOne(() => Matchday, { nullable: false, deleteRule: 'cascade' })
  matchday!: Rel<Matchday>;

  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade' })
  league!: Rel<League>;

  @ManyToOne(() => GameMatch, { nullable: true, deleteRule: 'cascade' })
  match?: Rel<GameMatch> | null;

  @Property({ nullable: false, columnType: 'float' })
  pointsObtained!: number;

  @Property({ nullable: false })
  updateDate: Date = new Date();

  @OneToMany(() => PlayerPointsBreakdown, (playerPointsBreakdown) => playerPointsBreakdown.playerPerformance, {
    cascade: [Cascade.ALL],
  })
  pointsBreakdown = new Collection<PlayerPointsBreakdown>(this);
}
