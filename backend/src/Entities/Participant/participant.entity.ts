import { Cascade, Collection, Entity, ManyToOne, OneToMany, Property, Unique, Rel } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { User } from '../User/user.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { Bid } from '../Bid/bid.entity.js';
import { ParticipantMatchdayPoints } from '../ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { PlayerClause } from '../PlayerClause/playerClause.entity.js';
import { Shielding } from '../Shielding/shielding.entity.js';
import { Transaction } from '../Transaction/transaction.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { Negotiation } from '../Negotiation/negotiation.entity.js';

@Entity()
@Unique({ properties: ['user', 'tournament'] })
export class Participant extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, deleteRule: 'cascade' })
  user!: Rel<User>;

  @ManyToOne(() => Tournament, { nullable: false, deleteRule: 'cascade' })
  tournament!: Rel<Tournament>;

  @Property({ nullable: false })
  bankBudget!: number;

  @Property({ nullable: false, default: 0 })
  reservedMoney: number = 0;

  @Property({ nullable: false, default: 0 })
  availableMoney: number = 0;

  @Property({ nullable: false, default: 0 })
  totalScore: number = 0;

  @Property({ nullable: false })
  joinDate: Date = new Date();

  @OneToMany(() => ParticipantSquad, (participantSquad) => participantSquad.participant, {
    cascade: [Cascade.ALL],
  })
  squad = new Collection<ParticipantSquad>(this);

  @OneToMany(() => Bid, (bid) => bid.participant, { cascade: [Cascade.ALL] })
  bids = new Collection<Bid>(this);

  @OneToMany(() => ParticipantMatchdayPoints, (participantMatchdayPoints) => participantMatchdayPoints.participant, {
    cascade: [Cascade.ALL],
  })
  matchdayPoints = new Collection<ParticipantMatchdayPoints>(this);

  @OneToMany(() => PlayerPointsBreakdown, (playerPointsBreakdown) => playerPointsBreakdown.participant, {
    cascade: [Cascade.ALL],
  })
  playerPointsBreakdowns = new Collection<PlayerPointsBreakdown>(this);

  @OneToMany(() => PlayerClause, (playerClause) => playerClause.ownerParticipant, {
    cascade: [Cascade.ALL],
  })
  ownedClauses = new Collection<PlayerClause>(this);

  @OneToMany(() => Shielding, (shielding) => shielding.participant, {
    cascade: [Cascade.ALL],
  })
  shieldings = new Collection<Shielding>(this);

  @OneToMany(() => Transaction, (transaction) => transaction.originParticipant)
  outgoingTransactions = new Collection<Transaction>(this);

  @OneToMany(() => Transaction, (transaction) => transaction.destinationParticipant)
  incomingTransactions = new Collection<Transaction>(this);

  @OneToMany(() => MatchdayMarket, (matchdayMarket) => matchdayMarket.sellerParticipant)
  marketSales = new Collection<MatchdayMarket>(this);

  @OneToMany(() => Negotiation, (negotiation) => negotiation.sellerParticipant)
  negotiationsAsSeller = new Collection<Negotiation>(this);

  @OneToMany(() => Negotiation, (negotiation) => negotiation.buyerParticipant)
  negotiationsAsBuyer = new Collection<Negotiation>(this);
}
