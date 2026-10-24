import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Participant } from '../Participant/participant.entity.js';

@Entity()
@Unique({ properties: ['tournament', 'realPlayer'] })
export class PlayerOwnership extends BaseEntity {
  @ManyToOne(() => Tournament, { deleteRule: 'cascade' }) tournament!: Rel<Tournament>;
  @ManyToOne(() => RealPlayer, { deleteRule: 'restrict' }) realPlayer!: Rel<RealPlayer>;
  @ManyToOne(() => Participant, { nullable: true, deleteRule: 'set null' }) owner?: Rel<Participant> | null;
  @Property() changedAt: Date = new Date();
}
