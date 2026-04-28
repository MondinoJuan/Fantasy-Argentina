import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { League } from '../League/league.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { PlayerClause } from '../PlayerClause/playerClause.entity.js';
import { Transaction } from '../Transaction/transaction.entity.js';
import { Negotiation } from '../Negotiation/negotiation.entity.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { TournamentStatus } from '../../shared/domain-enums.js';

@Entity()
export class Tournament extends BaseEntity {
  @Property({ nullable: false })
  name!: string;

  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade' })
  league!: Rel<League>;

  @Property({ nullable: false })
  sport!: string;

  @Property({ nullable: false })
  creationDate: Date = new Date();

  @Property({ nullable: false })
  initialBudget!: number;

  @Property({ nullable: false })
  squadSize!: number;

  @Property({ nullable: false })
  status!: TournamentStatus;

  @Property({ nullable: false, unique: true })
  publicCode!: string;

  @Property({ nullable: true })
  clauseEnableDate?: Date;


  @Property({ nullable: false, default: false })
  allowSquadChangesDuringMatchday: boolean = false;

  @Property({ nullable: false, default: false })
  allowClauseExecutionDuringMatchday: boolean = false;

  @OneToMany(() => Participant, (participant) => participant.tournament, {
    cascade: [Cascade.ALL],
  })
  participants = new Collection<Participant>(this);

  @OneToMany(() => MatchdayMarket, (matchdayMarket) => matchdayMarket.tournament, {
    cascade: [Cascade.ALL],
  })
  markets = new Collection<MatchdayMarket>(this);

  @OneToMany(() => PlayerClause, (playerClause) => playerClause.tournament, {
    cascade: [Cascade.ALL],
  })
  playerClauses = new Collection<PlayerClause>(this);

  @OneToMany(() => Transaction, (transaction) => transaction.tournament, {
    cascade: [Cascade.ALL],
  })
  transactions = new Collection<Transaction>(this);

  @OneToMany(() => Negotiation, (negotiation) => negotiation.tournament, {
    cascade: [Cascade.ALL],
  })
  negotiations = new Collection<Negotiation>(this);

  @OneToMany(() => DependantPlayer, (dependantPlayer) => dependantPlayer.tournament, {
    cascade: [Cascade.ALL],
  })
  dependantPlayers = new Collection<DependantPlayer>(this);
}
