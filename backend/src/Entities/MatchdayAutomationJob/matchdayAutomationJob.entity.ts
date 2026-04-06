import { Entity, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { League } from '../League/league.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { GameMatch } from '../GameMatch/gameMatch.entity.js';

export type MatchdayAutomationJobStep =
  | 'matchday_closure'
  | 'postponed_recheck'
  | 'postponed_match_sum';

export type MatchdayAutomationJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

@Entity()
@Unique({ properties: ['idempotencyKey'] })
export class MatchdayAutomationJob extends BaseEntity {
  @ManyToOne(() => League, { nullable: false, deleteRule: 'cascade' })
  league!: Rel<League>;

  @ManyToOne(() => Matchday, { nullable: true, deleteRule: 'cascade' })
  matchday?: Rel<Matchday> | null;

  @ManyToOne(() => GameMatch, { nullable: true, deleteRule: 'cascade' })
  gameMatch?: Rel<GameMatch> | null;

  @Property({ nullable: false })
  step!: MatchdayAutomationJobStep;

  @Property({ nullable: false })
  status: MatchdayAutomationJobStatus = 'pending';

  @Property({ nullable: false })
  runAt!: Date;

  @Property({ nullable: false })
  attempts = 0;

  @Property({ nullable: true, length: 4096 })
  lastError?: string | null;

  @Property({ nullable: false, length: 255 })
  idempotencyKey!: string;

  @Property({ type: 'json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Property({ nullable: true })
  startedAt?: Date | null;

  @Property({ nullable: true })
  finishedAt?: Date | null;
}
