import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';

@Entity()
@Unique({ properties: ['participant', 'matchday'] })
export class ParticipantMatchdayPoints extends BaseEntity {
  @ManyToOne(() => Participant, { nullable: false })
  participant!: Participant;

  @ManyToOne(() => Matchday, { nullable: false })
  matchday!: Matchday;

  @Property({ nullable: false })
  matchdayPoints!: number;

  @Property({ nullable: true })
  accumulatedPoints?: number;

  @Property({ nullable: true })
  position?: number;

  @Property({ nullable: false })
  calculationDate: Date = new Date();
}
