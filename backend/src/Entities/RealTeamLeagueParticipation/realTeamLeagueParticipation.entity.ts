import { Entity, ManyToOne, Rel, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { League } from '../League/league.entity.js';

@Entity()
@Unique({ properties: ['realTeam', 'league'] })
export class RealTeamLeagueParticipation extends BaseEntity {
  @ManyToOne(() => RealTeam, { nullable: false, deleteRule: 'cascade' })
  realTeam!: Rel<RealTeam>;

  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade' })
  league!: Rel<League>;
}
