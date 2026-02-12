import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';

@Entity()
@Unique({ properties: ['participant', 'matchday', 'realPlayer'] })
export class PlayerPointsBreakdown extends BaseEntity {
  @ManyToOne(() => Participant, { nullable: false })
  participant!: Participant;

  @ManyToOne(() => Matchday, { nullable: false })
  matchday!: Matchday;

  @ManyToOne(() => RealPlayer, { nullable: false })
  realPlayer!: RealPlayer;

  @Property({ nullable: false })
  contributedPoints!: number;

  @ManyToOne(() => PlayerPerformance, { nullable: false })
  playerPerformance!: PlayerPerformance;
}
