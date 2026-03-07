export type UserType = 'USER' | 'SUPERADMIN';

export type TournamentStatus = 'active' | 'inactive' | 'finished' | 'archived';
export type MatchdayStatus = 'scheduled' | 'upcoming' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
export type MatchStatus = 'scheduled' | 'in_progress' | 'finalizado' | 'postponed' | 'cancelled';

export type MarketOrigin = 'system_initial_market' | 'system_matchday_refresh' | 'participant_sale' | 'admin_adjustment';

export type BidStatus = 'active' | 'won' | 'lost' | 'cancelled';
export type NegotiationStatus = 'active' | 'accepted' | 'rejected' | 'countered' | 'cancelled';
export type TransactionType = 'bid_purchase' | 'negotiation_purchase' | 'instant_sale' | 'clause_execution' | 'shielding_investment' | 'refund' | 'admin_adjustment';

export type PlayerPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export type ParticipantFormation = '4-4-2' | '4-3-3' | '3-4-3' | '5-4-1';
export type SquadAcquisitionType = 'initial_assignment' | 'bid_purchase' | 'negotiation_purchase' | 'clause_execution' | 'admin_assignment';
