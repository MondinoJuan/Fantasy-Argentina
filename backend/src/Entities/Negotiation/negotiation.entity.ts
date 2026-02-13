import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';

@Entity()
export class Negotiation extends BaseEntity {
  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  sellerParticipant!: Rel<Participant>;

  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  buyerParticipant!: Rel<Participant>;

  @ManyToOne(() => RealPlayer, { nullable: false, deleteRule: 'cascade' })
  realPlayer!: Rel<RealPlayer>;

  @Property({ nullable: false })
  agreedAmount!: number;

  @Property({ nullable: false })
  status!: string;

  @Property({ nullable: false })
  creationDate: Date = new Date();

  @Property({ nullable: true })
  publicationDate?: Date;

  @Property({ nullable: true })
  effectiveDate?: Date;

  @Property({ nullable: true })
  rejectionDate?: Date;
}
