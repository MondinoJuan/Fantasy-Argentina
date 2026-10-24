import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { PlayerOwnership } from '../PlayerOwnership/playerOwnership.entity.js';
import { Participant } from '../Participant/participant.entity.js';

@Entity()
export class OwnershipMovement extends BaseEntity {
  @ManyToOne(() => PlayerOwnership, { deleteRule: 'cascade' }) ownership!: Rel<PlayerOwnership>;
  @ManyToOne(() => Participant, { nullable: true, deleteRule: 'set null' }) previousOwner?: Rel<Participant> | null;
  @ManyToOne(() => Participant, { nullable: true, deleteRule: 'set null' }) nextOwner?: Rel<Participant> | null;
  @Property() reason!: string;
  @Property() occurredAt: Date = new Date();
}
