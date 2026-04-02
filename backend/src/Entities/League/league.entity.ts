import { Cascade, Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { GameMatch } from '../GameMatch/gameMatch.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { UltSeason } from '../UltSeason/ultSeason.entity.js';

@Entity()
export class League extends BaseEntity {
  @Property({ nullable: false, default: 'league_only' })
  competitionFormat: 'league_only' | 'knockout_only' | 'mixed' = 'league_only';

  @Property({ nullable: false, default: false })
  hasGroups = false;

  @Property({ nullable: false, default: false })
  hasTwoLegKnockout = false;

  @Property({ nullable: false })
  name!: string;

  @Property({ nullable: false })
  country!: string;

  @Property({ nullable: false })
  sport!: string;

  @Property({ nullable: false })
  idEnApi!: number;

  @Property({ nullable: false, default: false })
  knockoutStage = false;

  @Property({ type: 'float', nullable: true })
  limiteMin?: number | null;

  @Property({ type: 'float', nullable: true })
  limiteMax?: number | null;

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

  @OneToMany(() => GameMatch, (match) => match.league, {
    cascade: [Cascade.ALL],
  })
  matches = new Collection<GameMatch>(this);

  @OneToMany(() => PlayerPerformance, (playerPerformance) => playerPerformance.league, {
    cascade: [Cascade.ALL],
  })
  performances = new Collection<PlayerPerformance>(this);

  @OneToMany(() => UltSeason, (ultSeason) => ultSeason.league, {
    cascade: [Cascade.ALL],
  })
  ultSeasons = new Collection<UltSeason>(this);
}
