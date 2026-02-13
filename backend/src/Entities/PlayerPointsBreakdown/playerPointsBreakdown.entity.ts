import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';

@Entity()
@Unique({ properties: ['participant', 'matchday', 'realPlayer'] })
export class PlayerPointsBreakdown extends BaseEntity {
  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @ManyToOne(() => Matchday, { nullable: false, deleteRule: 'cascade' })
  matchday!: Rel<Matchday>;

  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @Property({ nullable: false })
  contributedPoints!: number;

  @ManyToOne(() => PlayerPerformance, { nullable: false, deleteRule: 'cascade' })
  playerPerformance!: Rel<PlayerPerformance>;
}
