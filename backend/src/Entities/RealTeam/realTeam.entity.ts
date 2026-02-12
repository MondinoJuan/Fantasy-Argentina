import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { League } from '../League/league.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';

@Entity()
export class RealTeam extends BaseEntity {
  @Property({ nullable: false })
  name!: string;

  @ManyToOne(() => League, { nullable: false })
  league!: League;

  @Property({ nullable: false })
  externalApiId!: string;

  @OneToMany(() => RealPlayer, (realPlayer) => realPlayer.realTeam, {
    cascade: [Cascade.ALL],
  })
  players = new Collection<RealPlayer>(this);
}
