import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';

@Entity()
export class Season extends BaseEntity {
  @Property({ nullable: false })
  leagueId!: number;

  @Property({ nullable: false })
  temporada!: string;

  @Property({ nullable: false })
  idEnAPI!: number;
}
