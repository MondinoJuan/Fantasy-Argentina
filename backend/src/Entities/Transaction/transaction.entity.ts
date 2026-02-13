import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';

@Entity()
export class Transaction extends BaseEntity {
  @ManyToOne(() => Participant, { nullable: true, deleteRule: 'cascade' })
  originParticipant?: Rel<Participant>;

  @ManyToOne(() => Participant, { nullable: true, deleteRule: 'cascade' })
  destinationParticipant?: Rel<Participant>;

  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @Property({ nullable: false })
  type!: string;

  @Property({ nullable: false })
  amount!: number;

  @Property({ nullable: false })
  referenceTable!: string;

  @Property({ nullable: false })
  referenceId!: string;

  @Property({ nullable: false })
  creationDate: Date = new Date();

  @Property({ nullable: true })
  publicationDate?: Date;

  @Property({ nullable: true })
  effectiveDate?: Date;
}
