import { Entity, ManyToOne, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { MatchStatus } from '../../shared/domain-enums.js';

@Entity()
@Unique({ properties: ['externalApiId'] })
export class Match extends BaseEntity {
  @ManyToOne(() => Matchday, { nullable: false, deleteRule: 'cascade' })
  matchday!: Rel<Matchday>;

  @Property({ nullable: false })
  externalApiId!: string;

  @Property({ nullable: false })
  homeTeam!: string;

  @Property({ nullable: false })
  awayTeam!: string;

  @Property({ nullable: false })
  startDateTime!: Date;

  @Property({ nullable: false })
  status!: MatchStatus;


  @Property({ nullable: true })
  homeScore?: number | null;

  @Property({ nullable: true })
  awayScore?: number | null;
}
