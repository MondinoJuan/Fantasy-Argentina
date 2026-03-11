import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { PlayerPosition } from '../../shared/domain-enums.js';

@Entity()
export class RealPlayer extends BaseEntity {
  @Property({ nullable: false })
  idEnApi!: number;

  @Property({ nullable: false })
  name!: string;

  @Property({ nullable: false })
  position!: PlayerPosition;

  @ManyToOne(() => RealTeam, { nullable: false, deleteRule: 'cascade' })
  realTeam!: Rel<RealTeam>;

  @Property({ nullable: false, default: true })
  active: boolean = true;

  @Property({ nullable: false })
  lastUpdate: Date = new Date();

  @OneToMany(() => PlayerPerformance, (playerPerformance) => playerPerformance.realPlayer, {
    cascade: [Cascade.ALL],
  })
  performances = new Collection<PlayerPerformance>(this);

  @OneToMany(() => PlayerPointsBreakdown, (playerPointsBreakdown) => playerPointsBreakdown.realPlayer, {
    cascade: [Cascade.ALL],
  })
  pointsBreakdowns = new Collection<PlayerPointsBreakdown>(this);

  @OneToMany(() => DependantPlayer, (dependantPlayer) => dependantPlayer.realPlayer, {
    cascade: [Cascade.ALL],
  })
  dependantPlayers = new Collection<DependantPlayer>(this);
}
