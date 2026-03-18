import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { League } from '../League/league.entity.js';

@Entity()
export class UltSeason extends BaseEntity {
  @Property({ nullable: false, fieldName: 'id_en_api' })
  idEnApi!: number;

  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade', fieldName: 'idLeague' })
  league!: Rel<League>;

  @Property({ nullable: false, fieldName: 'desc' })
  desc!: string;
}
