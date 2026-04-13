import { Entity, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { League } from '../League/league.entity.js';

@Entity()
@Unique({ properties: ['realPlayer', 'league'] })
export class RealPlayerLeagueValue extends BaseEntity {
  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade' })
  league!: Rel<League>;

  @Property({ type: 'float', nullable: true })
  translatedValue?: number | null = null;
}
