USE fantasy_argentina;
START TRANSACTION;

-- 1) User
INSERT INTO `User` (id_user, name, email, password, register_date) VALUES
  (1, 'User 1', 'user1@example.com', '$2b$10$dummyhash1', NOW()),
  (2, 'User 2', 'user2@example.com', '$2b$10$dummyhash2', NOW()),
  (3, 'User 3', 'user3@example.com', '$2b$10$dummyhash3', NOW()),
  (4, 'User 4', 'user4@example.com', '$2b$10$dummyhash4', NOW()),
  (5, 'User 5', 'user5@example.com', '$2b$10$dummyhash5', NOW());

-- 2) League
INSERT INTO League (id_league, name, country, external_api_id) VALUES
  (1, 'Liga Profesional', 'Argentina', 'AR-L1'),
  (2, 'Primera Nacional', 'Argentina', 'AR-L2'),
  (3, 'Primera B', 'Argentina', 'AR-L3'),
  (4, 'Federal A', 'Argentina', 'AR-L4'),
  (5, 'Copa Argentina', 'Argentina', 'AR-L5');

-- 3) Tournament
INSERT INTO Tournament (id_tournament, name, id_league, creation_date, initial_budget, squad_size, status, clause_enable_date) VALUES
  (1, 'Torneo Apertura', 1, NOW(), 100000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (2, 'Torneo Clausura', 2, NOW(), 100000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (3, 'Torneo Invierno', 3, NOW(), 80000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (4, 'Torneo Verano', 4, NOW(), 80000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (5, 'Copa Fantasy', 5, NOW(), 120000000.00, 15, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY));

-- 4) Participant (5 users dentro del Tournament 1)
INSERT INTO Participant (id_participant, id_user, id_tournament, bank_budget, reserved_money, total_points, join_date) VALUES
  (1, 1, 1, 100000000.00, 6000000.00, 12, NOW()),
  (2, 2, 1, 100000000.00, 11000000.00, 10, NOW()),
  (3, 3, 1, 100000000.00, 0.00, 15, NOW()),
  (4, 4, 1, 100000000.00, 9000000.00, 8, NOW()),
  (5, 5, 1, 100000000.00, 0.00, 14, NOW());

-- 5) RealTeam
INSERT INTO RealTeam (id_real_team, name, id_league, external_api_id) VALUES
  (1, 'River Plate', 1, 'TEAM-1001'),
  (2, 'Boca Juniors', 1, 'TEAM-1002'),
  (3, 'Racing Club', 1, 'TEAM-1003'),
  (4, 'Independiente', 1, 'TEAM-1004'),
  (5, 'San Lorenzo', 1, 'TEAM-1005');

-- 6) RealPlayer
INSERT INTO RealPlayer (id_real_player, external_api_id, name, position, id_real_team, market_value, active, last_update) VALUES
  (1, 'PLAYER-2001', 'Arquero 1', 'GK', 1, 5000000.00, 1, NOW()),
  (2, 'PLAYER-2002', 'Defensor 1', 'DEF', 2, 10000000.00, 1, NOW()),
  (3, 'PLAYER-2003', 'Mediocampista 1', 'MID', 3, 15000000.00, 1, NOW()),
  (4, 'PLAYER-2004', 'Delantero 1', 'FWD', 4, 20000000.00, 1, NOW()),
  (5, 'PLAYER-2005', 'Mediocampista 2', 'MID', 5, 25000000.00, 1, NOW());

-- 7) ParticipantSquad
INSERT INTO ParticipantSquad (id_squad, id_participant, id_real_player, acquisition_date, release_date, buy_price, acquisition_type) VALUES
  (1, 1, 1, NOW(), NULL, 5000000.00, 'INITIAL'),
  (2, 2, 2, NOW(), NULL, 10000000.00, 'INITIAL'),
  (3, 3, 3, NOW(), NULL, 15000000.00, 'INITIAL'),
  (4, 4, 4, NOW(), NULL, 20000000.00, 'INITIAL'),
  (5, 5, 5, NOW(), NULL, 25000000.00, 'INITIAL');

-- 8) Matchday
INSERT INTO Matchday (id_matchday, id_league, season, matchday_number, start_date, end_date, status) VALUES
  (1, 1, '2026', 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'FINISHED'),
  (2, 1, '2026', 2, DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'FINISHED'),
  (3, 1, '2026', 3, DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'FINISHED'),
  (4, 1, '2026', 4, DATE_ADD(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 8 DAY), 'FINISHED'),
  (5, 1, '2026', 5, DATE_ADD(CURDATE(), INTERVAL 9 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'FINISHED');

-- 9) Match
INSERT INTO `Match` (id_match, id_matchday, external_api_id, home_team, away_team, start_datetime, status) VALUES
  (1, 1, 'MATCH-3001', 'River Plate', 'Boca Juniors', DATE_ADD(NOW(), INTERVAL 1 DAY), 'FINISHED'),
  (2, 2, 'MATCH-3002', 'Racing Club', 'Independiente', DATE_ADD(NOW(), INTERVAL 3 DAY), 'FINISHED'),
  (3, 3, 'MATCH-3003', 'San Lorenzo', 'River Plate', DATE_ADD(NOW(), INTERVAL 5 DAY), 'FINISHED'),
  (4, 4, 'MATCH-3004', 'Boca Juniors', 'Racing Club', DATE_ADD(NOW(), INTERVAL 7 DAY), 'FINISHED'),
  (5, 5, 'MATCH-3005', 'Independiente', 'San Lorenzo', DATE_ADD(NOW(), INTERVAL 9 DAY), 'FINISHED');

-- 10) MatchdayMarket
INSERT INTO MatchdayMarket (id_market, id_tournament, id_matchday, id_real_player, min_price, origin, id_seller_participant, creation_date) VALUES
  (1, 1, 1, 1, 5000000.00, 'SYSTEM', NULL, NOW()),
  (2, 1, 2, 2, 10000000.00, 'SYSTEM', NULL, NOW()),
  (3, 1, 3, 3, 15000000.00, 'SYSTEM', NULL, NOW()),
  (4, 1, 4, 4, 20000000.00, 'PARTICIPANT', 4, NOW()),
  (5, 1, 5, 5, 25000000.00, 'PARTICIPANT', 5, NOW());

-- 11) Bid
INSERT INTO Bid (id_bid, id_market, id_participant, offered_amount, status, bid_date, cancel_date) VALUES
  (1, 1, 1, 6000000.00, 'ACTIVA', NOW(), NULL),
  (2, 2, 2, 11000000.00, 'ACTIVA', NOW(), NULL),
  (3, 3, 3, 16000000.00, 'ACTIVA', NOW(), NULL),
  (4, 4, 4, 21000000.00, 'ACTIVA', NOW(), NULL),
  (5, 5, 5, 26000000.00, 'ACTIVA', NOW(), NULL);

-- 12) PlayerPerformance
INSERT INTO PlayerPerformance (id_performance, id_real_player, id_matchday, points_obtained, played, update_date) VALUES
  (1, 1, 1, 6, 1, NOW()),
  (2, 2, 1, 4, 1, NOW()),
  (3, 3, 1, 8, 1, NOW()),
  (4, 4, 1, 10, 1, NOW()),
  (5, 5, 1, 3, 1, NOW());

-- 13) ParticipantMatchdayPoints
INSERT INTO ParticipantMatchdayPoints (id_participant_matchday_points, id_participant, id_matchday, matchday_points, calc_date) VALUES
  (1, 1, 1, 6, NOW()),
  (2, 2, 1, 4, NOW()),
  (3, 3, 1, 8, NOW()),
  (4, 4, 1, 10, NOW()),
  (5, 5, 1, 3, NOW());

-- 14) PlayerPointsBreakdown
INSERT INTO PlayerPointsBreakdown (id_breakdown, id_participant, id_matchday, id_real_player, contributed_pts, id_performance) VALUES
  (1, 1, 1, 1, 6, 1),
  (2, 2, 1, 2, 4, 2),
  (3, 3, 1, 3, 8, 3),
  (4, 4, 1, 4, 10, 4),
  (5, 5, 1, 5, 3, 5);

-- 15) PlayerClause
INSERT INTO PlayerClause (id_clause, id_tournament, id_real_player, id_owner_participant, base_clause, additional_clause_shielding, total_clause, update_date) VALUES
  (1, 1, 1, 1, 10000000.00, 2000000.00, 12000000.00, NOW()),
  (2, 1, 2, 2, 20000000.00, 4000000.00, 24000000.00, NOW()),
  (3, 1, 3, 3, 30000000.00, 6000000.00, 36000000.00, NOW()),
  (4, 1, 4, 4, 40000000.00, 8000000.00, 48000000.00, NOW()),
  (5, 1, 5, 5, 50000000.00, 10000000.00, 60000000.00, NOW());

-- 16) Shielding
INSERT INTO Shielding (id_shielding, id_clause, id_participant, invested_amount, clause_increase, shielding_date) VALUES
  (1, 1, 1, 500000.00, 1000000.00, NOW()),
  (2, 2, 2, 1000000.00, 2000000.00, NOW()),
  (3, 3, 3, 1500000.00, 3000000.00, NOW()),
  (4, 4, 4, 2000000.00, 4000000.00, NOW()),
  (5, 5, 5, 2500000.00, 5000000.00, NOW());

-- 17) Transaction
INSERT INTO `Transaction` (
  id_transaction, id_origin_participant, id_target_participant, id_tournament, type, amount, ref_table, ref_id, creation_date, publish_date, effective_date
) VALUES
  (1, 1, NULL, 1, 'BID_RESERVE', -6000000.00, 'Bid', 1, NOW(), NOW(), NOW()),
  (2, 2, NULL, 1, 'BID_RESERVE', -11000000.00, 'Bid', 2, NOW(), NOW(), NOW()),
  (3, NULL, 3, 1, 'INSTANT_SELL_INCOME', 12750000.00, 'ParticipantSquad', 3, NOW(), NOW(), NOW()),
  (4, 4, NULL, 1, 'NEGOTIATION_RESERVE', -9000000.00, 'Negotiation', 1, NOW(), NOW(), NOW()),
  (5, 5, 1, 1, 'TRANSFER_PAYMENT', -15000000.00, 'Negotiation', 2, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 4 HOUR));

-- 18) Negotiation
INSERT INTO Negotiation (
  id_negotiation, id_tournament, id_seller_participant, id_buyer_participant, id_real_player, agreed_amount, status, creation_date, publish_date, effective_date, reject_date
) VALUES
  (1, 1, 1, 4, 1, 9000000.00, 'PENDING', NOW(), NULL, NULL, NULL),
  (2, 1, 2, 5, 2, 15000000.00, 'ACCEPTED', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 4 HOUR), NULL),
  (3, 1, 3, 1, 3, 12000000.00, 'REJECTED', NOW(), NOW(), NULL, NOW()),
  (4, 1, 4, 2, 4, 18000000.00, 'PENDING', NOW(), NULL, NULL, NULL),
  (5, 1, 5, 3, 5, 20000000.00, 'PENDING', NOW(), NULL, NULL, NULL);

COMMIT;
