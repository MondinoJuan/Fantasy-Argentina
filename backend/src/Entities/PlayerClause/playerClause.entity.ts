import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Shielding } from '../Shielding/shielding.entity.js';

@Entity()
@Unique({ properties: ['tournament', 'dependantPlayer'] })
export class PlayerClause extends BaseEntity {
  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @ManyToOne(() => DependantPlayer, { nullable: false, deleteRule: 'cascade' })
  dependantPlayer!: Rel<DependantPlayer>;

  @ManyToOne(() => Participant, { nullable: false, deleteRule: 'cascade' })
  ownerParticipant!: Rel<Participant>;

  @Property({ nullable: false })
  baseClause!: number;

  @Property({ nullable: false, default: 0 })
  additionalShieldingClause: number = 0;

  @Property({ nullable: false })
  totalClause!: number;

  @Property({ nullable: false })
  updateDate: Date = new Date();

  @OneToMany(() => Shielding, (shielding) => shielding.playerClause, {
    cascade: [Cascade.ALL],
  })
  shieldings = new Collection<Shielding>(this);
}
