import { Cascade, Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';

@Entity()
export class League extends BaseEntity {
  @Property({ nullable: false })
  name!: string;

  @Property({ nullable: false })
  country!: string;

  @Property({ nullable: false })
  externalApiId!: string;

  @OneToMany(() => Tournament, (tournament) => tournament.league, {
    cascade: [Cascade.ALL],
  })
  tournaments = new Collection<Tournament>(this);

  @OneToMany(() => RealTeam, (realTeam) => realTeam.league, {
    cascade: [Cascade.ALL],
  })
  realTeams = new Collection<RealTeam>(this);

  @OneToMany(() => Matchday, (matchday) => matchday.league, {
    cascade: [Cascade.ALL],
  })
  matchdays = new Collection<Matchday>(this);
}
