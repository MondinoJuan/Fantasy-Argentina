import { Cascade, Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { UserType } from '../../shared/domain-enums.js';

@Entity()
export class User extends BaseEntity {
  @Property({ nullable: false })
  username!: string;

  @Property({ nullable: false, unique: true })
  mail!: string;

  @Property({ nullable: false })
  password!: string;

  @Property({ nullable: false, default: 'LOCAL' })
  authProvider: 'LOCAL' | 'GOOGLE' = 'LOCAL';

  @Property({ nullable: false, default: false })
  isEmailVerified = false;

  @Property({ nullable: true, length: 120 })
  emailVerificationToken: string | null = null;

  @Property({ nullable: true })
  emailVerificationSentAt: Date | null = null;

  @Property({ nullable: false })
  registrationDate: Date = new Date();

  @Property({ nullable: false, default: 'USER' })
  type: UserType = 'USER';

  @OneToMany(() => Participant, (participant) => participant.user, {
    cascade: [Cascade.ALL],
  })
  participants = new Collection<Participant>(this);
}
