USE fantasy_argentina;
START TRANSACTION;

-- 1) User
INSERT INTO `User` (id, username, mail, password, registration_date, created_at, updated_at) VALUES
  (6, 'User 1', 'user1@example.com', '$2b$10$dummyhash1', NOW(), NOW(), NOW()),
  (2, 'User 2', 'user2@example.com', '$2b$10$dummyhash2', NOW(), NOW(), NOW()),
  (3, 'User 3', 'user3@example.com', '$2b$10$dummyhash3', NOW(), NOW(), NOW()),
  (4, 'User 4', 'user4@example.com', '$2b$10$dummyhash4', NOW(), NOW(), NOW()),
  (5, 'User 5', 'user5@example.com', '$2b$10$dummyhash5', NOW(), NOW(), NOW());

-- 2) League
INSERT INTO League (id, name, country, external_api_id, created_at, updated_at) VALUES
  (1, 'Liga Profesional', 'Argentina', 'AR-L1', NOW(), NOW()),
  (2, 'Primera Nacional', 'Argentina', 'AR-L2', NOW(), NOW()),
  (3, 'Primera B', 'Argentina', 'AR-L3', NOW(), NOW()),
  (4, 'Federal A', 'Argentina', 'AR-L4', NOW(), NOW()),
  (5, 'Copa Argentina', 'Argentina', 'AR-L5', NOW(), NOW());

-- 3) Tournament
INSERT INTO Tournament (id, name, league_id, creation_date, initial_budget, squad_size, status, clause_enable_date, created_at, updated_at) VALUES
  (1, 'Torneo Apertura', 1, NOW(), 100000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW()),
  (2, 'Torneo Clausura', 2, NOW(), 100000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW()),
  (3, 'Torneo Invierno', 3, NOW(), 80000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW()),
  (4, 'Torneo Verano', 4, NOW(), 80000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW()),
  (5, 'Copa Fantasy', 5, NOW(), 120000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), NOW());

-- 4) Participant (5 users dentro del Tournament 1)
INSERT INTO Participant (id, user_id, tournament_id, bank_budget, reserved_money, total_score, join_date, created_at, updated_at) VALUES
  (1, 1, 1, 100000000.00, 6000000.00, 12, NOW(), NOW(), NOW()),
  (2, 2, 1, 100000000.00, 11000000.00, 10, NOW(), NOW(), NOW()),
  (3, 3, 1, 100000000.00, 0.00, 15, NOW(), NOW(), NOW()),
  (4, 4, 1, 100000000.00, 9000000.00, 8, NOW(), NOW(), NOW()),
  (5, 5, 1, 100000000.00, 0.00, 14, NOW(), NOW(), NOW());

-- 5) RealTeam
INSERT INTO Real_Team (id, name, league_id, external_api_id, created_at, updated_at) VALUES
  (1, 'River Plate', 1, 'TEAM-1001', NOW(), NOW()),
  (2, 'Boca Juniors', 1, 'TEAM-1002', NOW(), NOW()),
  (3, 'Racing Club', 1, 'TEAM-1003', NOW(), NOW()),
  (4, 'Independiente', 1, 'TEAM-1004', NOW(), NOW()),
  (5, 'San Lorenzo', 1, 'TEAM-1005', NOW(), NOW());

-- 6) RealPlayer
INSERT INTO Real_Player (id, external_api_id, name, position, real_team_id, market_value, active, last_update, created_at, updated_at) VALUES
  (1, 'PLAYER-2001', 'Arquero 1', 'GK', 1, 5000000.00, 1, NOW(), NOW(), NOW()),
  (2, 'PLAYER-2002', 'Defensor 1', 'DEF', 2, 10000000.00, 1, NOW(), NOW(), NOW()),
  (3, 'PLAYER-2003', 'Mediocampista 1', 'MID', 3, 15000000.00, 1, NOW(), NOW(), NOW()),
  (4, 'PLAYER-2004', 'Delantero 1', 'FWD', 4, 20000000.00, 1, NOW(), NOW(), NOW()),
  (5, 'PLAYER-2005', 'Mediocampista 2', 'MID', 5, 25000000.00, 1, NOW(), NOW(), NOW());

-- 7) ParticipantSquad
INSERT INTO Participant_Squad (id, participant_id, real_player_id, acquisition_date, release_date, purchase_price, acquisition_type, created_at, updated_at) VALUES
  (1, 1, 1, NOW(), NULL, 5000000.00, 'INITIAL', NOW(), NOW()),
  (2, 2, 2, NOW(), NULL, 10000000.00, 'INITIAL', NOW(), NOW()),
  (3, 3, 3, NOW(), NULL, 15000000.00, 'INITIAL', NOW(), NOW()),
  (4, 4, 4, NOW(), NULL, 20000000.00, 'INITIAL', NOW(), NOW()),
  (5, 5, 5, NOW(), NULL, 25000000.00, 'INITIAL', NOW(), NOW());

-- 8) Matchday
INSERT INTO Matchday (id, league_id, season, matchday_number, start_date, end_date, auto_update_at, next_postponed_check_at, status, created_at, updated_at) VALUES
  (1, 1, '2026', 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), NULL, 'FINISHED', NOW(), NOW()),
  (2, 1, '2026', 2, DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), NULL, 'FINISHED', NOW(), NOW()),
  (3, 1, '2026', 3, DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), DATE_ADD(NOW(), INTERVAL 6 DAY), NULL, 'FINISHED', NOW(), NOW()),
  (4, 1, '2026', 4, DATE_ADD(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 8 DAY), DATE_ADD(NOW(), INTERVAL 8 DAY), NULL, 'FINISHED', NOW(), NOW()),
  (5, 1, '2026', 5, DATE_ADD(CURDATE(), INTERVAL 9 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), NULL, 'FINISHED', NOW(), NOW());

-- 9) Match
INSERT INTO `Match` (id, matchday_id, league_id, external_api_id, home_team, away_team, start_date_time, status, created_at, updated_at) VALUES
  (1, 1, 1, 'MATCH-3001', 'River Plate', 'Boca Juniors', DATE_ADD(NOW(), INTERVAL 1 DAY), 'FINISHED', NOW(), NOW()),
  (2, 2, 1, 'MATCH-3002', 'Racing Club', 'Independiente', DATE_ADD(NOW(), INTERVAL 3 DAY), 'FINISHED', NOW(), NOW()),
  (3, 3, 1, 'MATCH-3003', 'San Lorenzo', 'River Plate', DATE_ADD(NOW(), INTERVAL 5 DAY), 'FINISHED', NOW(), NOW()),
  (4, 4, 1, 'MATCH-3004', 'Boca Juniors', 'Racing Club', DATE_ADD(NOW(), INTERVAL 7 DAY), 'FINISHED', NOW(), NOW()),
  (5, 5, 1, 'MATCH-3005', 'Independiente', 'San Lorenzo', DATE_ADD(NOW(), INTERVAL 9 DAY), 'FINISHED', NOW(), NOW());

-- 10) MatchdayMarket
INSERT INTO Matchday_Market (id, tournament_id, matchday_id, real_player_id, min_price, origin, seller_participant_id, creation_date, created_at, updated_at) VALUES
  (1, 1, 1, 1, 5000000.00, 'SYSTEM', NULL, NOW(), NOW(), NOW()),
  (2, 1, 2, 2, 10000000.00, 'SYSTEM', NULL, NOW(), NOW(), NOW()),
  (3, 1, 3, 3, 15000000.00, 'SYSTEM', NULL, NOW(), NOW(), NOW()),
  (4, 1, 4, 4, 20000000.00, 'PARTICIPANT', 4, NOW(), NOW(), NOW()),
  (5, 1, 5, 5, 25000000.00, 'PARTICIPANT', 5, NOW(), NOW(), NOW());

-- 11) Bid
INSERT INTO Bid (id, matchday_market_id, participant_id, offered_amount, status, bid_date, cancel_date, created_at, updated_at) VALUES
  (1, 1, 1, 6000000.00, 'ACTIVA', NOW(), NULL, NOW(), NOW()),
  (2, 2, 2, 11000000.00, 'ACTIVA', NOW(), NULL, NOW(), NOW()),
  (3, 3, 3, 16000000.00, 'ACTIVA', NOW(), NULL, NOW(), NOW()),
  (4, 4, 4, 21000000.00, 'ACTIVA', NOW(), NULL, NOW(), NOW()),
  (5, 5, 5, 26000000.00, 'ACTIVA', NOW(), NULL, NOW(), NOW());

-- 12) PlayerPerformance
INSERT INTO Player_Performance (id, real_player_id, matchday_id, league_id, match_id, points_obtained, update_date, created_at, updated_at) VALUES
  (1, 1, 1, 1, 1, 6, NOW(), NOW(), NOW()),
  (2, 2, 1, 1, 1, 4, NOW(), NOW(), NOW()),
  (3, 3, 1, 1, 2, 8, NOW(), NOW(), NOW()),
  (4, 4, 1, 1, 2, 10, NOW(), NOW(), NOW()),
  (5, 5, 1, 1, 3, 3, NOW(), NOW(), NOW());

-- 13) ParticipantMatchdayPoints
INSERT INTO Participant_Matchday_Points (id, participant_id, matchday_id, matchday_points, calc_date, created_at, updated_at) VALUES
  (1, 1, 1, 6, NOW(), NOW(), NOW()),
  (2, 2, 1, 4, NOW(), NOW(), NOW()),
  (3, 3, 1, 8, NOW(), NOW(), NOW()),
  (4, 4, 1, 10, NOW(), NOW(), NOW()),
  (5, 5, 1, 3, NOW(), NOW(), NOW());

-- 14) PlayerPointsBreakdown
INSERT INTO Player_Points_Breakdown (id, participant_id, matchday_id, real_player_id, contributed_points, player_performance_id, created_at, updated_at) VALUES
  (1, 1, 1, 1, 6, 1, NOW(), NOW()),
  (2, 2, 1, 2, 4, 2, NOW(), NOW()),
  (3, 3, 1, 3, 8, 3, NOW(), NOW()),
  (4, 4, 1, 4, 10, 4, NOW(), NOW()),
  (5, 5, 1, 5, 3, 5, NOW(), NOW());

-- 15) PlayerClause
INSERT INTO Player_Clause (id, tournament_id, real_player_id, owner_participant_id, base_clause, additional_shielding_clause, total_clause, update_date, created_at, updated_at) VALUES
  (1, 1, 1, 1, 10000000.00, 2000000.00, 12000000.00, NOW(), NOW(), NOW()),
  (2, 1, 2, 2, 20000000.00, 4000000.00, 24000000.00, NOW(), NOW(), NOW()),
  (3, 1, 3, 3, 30000000.00, 6000000.00, 36000000.00, NOW(), NOW(), NOW()),
  (4, 1, 4, 4, 40000000.00, 8000000.00, 48000000.00, NOW(), NOW(), NOW()),
  (5, 1, 5, 5, 50000000.00, 10000000.00, 60000000.00, NOW(), NOW(), NOW());

-- 16) Shielding
INSERT INTO Shielding (id, player_clause_id, participant_id, invested_amount, clause_increase, shielding_date, created_at, updated_at) VALUES
  (1, 1, 1, 500000.00, 1000000.00, NOW(), NOW(), NOW()),
  (2, 2, 2, 1000000.00, 2000000.00, NOW(), NOW(), NOW()),
  (3, 3, 3, 1500000.00, 3000000.00, NOW(), NOW(), NOW()),
  (4, 4, 4, 2000000.00, 4000000.00, NOW(), NOW(), NOW()),
  (5, 5, 5, 2500000.00, 5000000.00, NOW(), NOW(), NOW());

-- 17) Transaction
INSERT INTO `Transaction` (
  id, origin_participant_id, destination_participant_id, tournament_id, type, amount, ref_table, reference_id, creation_date, publication_date, effective_date, created_at, updated_at
) VALUES
  (1, 1, NULL, 1, 'BID_RESERVE', -6000000.00, 'Bid', 1, NOW(), NOW(), NOW(), NOW(), NOW()),
  (2, 2, NULL, 1, 'BID_RESERVE', -11000000.00, 'Bid', 2, NOW(), NOW(), NOW(), NOW(), NOW()),
  (3, NULL, 3, 1, 'INSTANT_SELL_INCOME', 12750000.00, 'ParticipantSquad', 3, NOW(), NOW(), NOW(), NOW(), NOW()),
  (4, 4, NULL, 1, 'NEGOTIATION_RESERVE', -9000000.00, 'Negotiation', 1, NOW(), NOW(), NOW(), NOW(), NOW()),
  (5, 5, 1, 1, 'TRANSFER_PAYMENT', -15000000.00, 'Negotiation', 2, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 4 HOUR), NOW(), NOW());

-- 18) Negotiation
INSERT INTO Negotiation (
  id, tournament_id, seller_participant_id, buyer_participant_id, real_player_id, agreed_amount, status, creation_date, publication_date, effective_date, rejection_date, created_at, 
  updated_at
) VALUES
  (1, 1, 1, 4, 1, 9000000.00, 'PENDING', NOW(), NULL, NULL, NULL, NOW(), NOW()),
  (2, 1, 2, 5, 2, 15000000.00, 'ACCEPTED', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 4 HOUR), NULL, NOW(), NOW()),
  (3, 1, 3, 1, 3, 12000000.00, 'REJECTED', NOW(), NOW(), NULL, NOW(), NOW(), NOW()),
  (4, 1, 4, 2, 4, 18000000.00, 'PENDING', NOW(), NULL, NULL, NULL, NOW(), NOW()),
  (5, 1, 5, 3, 5, 20000000.00, 'PENDING', NOW(), NULL, NULL, NULL, NOW(), NOW());

COMMIT;
