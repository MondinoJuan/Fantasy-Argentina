import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';

@Entity()
export class Sport extends BaseEntity {
  @Property({ nullable: false })
  idEnApi!: number;

  @Property({ nullable: false })
  descripcion!: string;

  @Property({ nullable: false })
  cupoTitular!: number;

  @Property({ nullable: false })
  cupoSuplente!: number;
}
