import { Cascade, Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';

@Entity()
export class User extends BaseEntity {
  @Property({ nullable: false })
  username!: string;

  @Property({ nullable: false, unique: true })
  mail!: string;

  @Property({ nullable: false })
  password!: string;

  @Property({ nullable: false })
  registrationDate: Date = new Date();

  @OneToMany(() => Participant, (participant) => participant.user, {
    cascade: [Cascade.ALL],
  })
  participants = new Collection<Participant>(this);
}
