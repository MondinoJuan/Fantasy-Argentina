export const USER_TYPES = ['USER', 'SUPERADMIN'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const TOURNAMENT_STATUSES = ['active', 'inactive', 'finished', 'archived'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const MATCHDAY_STATUSES = ['scheduled', 'upcoming', 'in_progress', 'completed', 'postponed', 'cancelled'] as const;
export type MatchdayStatus = (typeof MATCHDAY_STATUSES)[number];

export const MATCH_STATUSES = ['scheduled', 'in_progress', 'finalizado', 'postponed', 'cancelled'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MARKET_ORIGINS = ['system_initial_market', 'system_matchday_refresh', 'participant_sale', 'admin_adjustment'] as const;
export type MarketOrigin = (typeof MARKET_ORIGINS)[number];

export const BID_STATUSES = ['active', 'won', 'lost', 'cancelled'] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const NEGOTIATION_STATUSES = ['active', 'accepted', 'rejected', 'countered', 'cancelled'] as const;
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];

export const TRANSACTION_TYPES = ['bid_purchase', 'negotiation_purchase', 'instant_sale', 'clause_execution', 'shielding_investment', 'refund', 'admin_adjustment'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PLAYER_POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'] as const;
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export const PARTICIPANT_FORMATIONS = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'] as const;
export type ParticipantFormation = (typeof PARTICIPANT_FORMATIONS)[number];

export const SQUAD_ACQUISITION_TYPES = ['initial_assignment', 'bid_purchase', 'negotiation_purchase', 'clause_execution', 'admin_assignment'] as const;
export type SquadAcquisitionType = (typeof SQUAD_ACQUISITION_TYPES)[number];

export function isEnumValue<T extends readonly string[]>(collection: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (collection as readonly string[]).includes(value);
}
