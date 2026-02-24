import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';

@Entity()
@Unique({ properties: ['participant', 'realPlayer', 'acquisitionDate'] })
export class ParticipantSquad extends BaseEntity {
  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @Property({ nullable: false })
  formation: string = '4-4-2';

  @Property({ nullable: false })
  acquisitionDate: Date = new Date();

  @Property({ nullable: true })
  releaseDate?: Date;

  @Property({ nullable: false })
  purchasePrice!: number;

  @Property({ nullable: false })
  acquisitionType!: string;
}
