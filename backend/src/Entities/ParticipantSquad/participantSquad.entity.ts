import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { ParticipantFormation, SquadAcquisitionType } from '../../shared/domain-enums.js';

@Entity()
@Unique({ properties: ['participant', 'acquisitionDate'] })
export class ParticipantSquad extends BaseEntity {
  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @Property({ type: 'json', nullable: false })
  startingRealPlayersIds: number[] = [];

  @Property({ type: 'json', nullable: false })
  substitutesRealPlayersIds: number[] = [];

  @Property({ nullable: false })
  formation: ParticipantFormation = '4-4-2';

  @Property({ nullable: false })
  acquisitionDate: Date = new Date();

  @Property({ nullable: true })
  releaseDate?: Date;

  @Property({ nullable: false })
  purchasePrice!: number;

  @Property({ nullable: false })
  acquisitionType!: SquadAcquisitionType;
}
