import { Entity, Index, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';
import { BaseEntity } from '../../shared/db/base.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { GameMatch } from '../GameMatch/gameMatch.entity.js';
import { SquadRevision } from '../SquadRevision/squadRevision.entity.js';
import type { FrozenSlot } from '../../shared/domain/lineup-history.js';

@Entity()
@Unique({ properties: ['scopeKey'] })
@Index({ properties: ['participant', 'matchday'] })
export class MatchdayLineup extends BaseEntity {
  @ManyToOne(() => Participant, { deleteRule: 'cascade' })
  participant!: Rel<Participant>;

  @ManyToOne(() => Matchday, { deleteRule: 'cascade' })
  matchday!: Rel<Matchday>;

  @ManyToOne(() => GameMatch, { nullable: true, deleteRule: 'restrict' })
  match?: Rel<GameMatch> | null;

  @ManyToOne(() => SquadRevision, { nullable: true, deleteRule: 'set null' })
  sourceRevision?: Rel<SquadRevision> | null;

  @Property()
  scopeKey!: string;

  @Property({ columnType: 'datetime(3)' })
  cutoffAt!: Date;

  @Property()
  allowChangesDuringMatchday = false;

  @Property()
  formation!: string;

  @Property({ type: 'json' })
  startingSlots: FrozenSlot[] = [];

  @Property({ type: 'json' })
  substitutesRealPlayersIds: number[] = [];

  @Property({ nullable: true })
  captainRealPlayerId?: number | null;
}
