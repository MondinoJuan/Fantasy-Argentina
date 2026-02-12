USE fantasy_argentina;
START TRANSACTION;

-- 1) User
INSERT INTO `user` (id, username, mail, password) VALUES
  (1, 'User 1', 'user1@example.com', '$2b$10$dummyhash1'),
  (9, 'User 2', 'user2@example.com', '$2b$10$dummyhash2'),
  (8, 'User 3', 'user3@example.com', '$2b$10$dummyhash3'),
  (6, 'User 4', 'user4@example.com', '$2b$10$dummyhash4'),
  (5, 'User 5', 'user5@example.com', '$2b$10$dummyhash5');

-- 2) League
INSERT INTO league (id, name, country, external_api_id) VALUES
  (1, 'Liga 1', 'Argentina', 'AR-L1'),
  (2, 'Liga 2', 'Argentina', 'AR-L2'),
  (3, 'Liga 3', 'Argentina', 'AR-L3'),
  (4, 'Liga 4', 'Argentina', 'AR-L4'),
  (5, 'Liga 5', 'Argentina', 'AR-L5');

-- 3) Tournament
INSERT INTO tournament (id, name, id_league, initial_budget, squad_size, status, clause_enable_date) VALUES
  (1, 'Torneo 1', 1, 100000000.00, 11, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (2, 'Torneo 2', 2, 100000000.00, 11, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (3, 'Torneo 3', 3, 100000000.00, 11, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (4, 'Torneo 4', 4, 100000000.00, 11, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY)),
  (5, 'Torneo 5', 5, 100000000.00, 11, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 14 DAY));

-- 4) Participant (5 users inside Tournament 1)
INSERT INTO participant (id, id_user, id_tournament, bank_budget, reserved_money, total_points) VALUES
  (1, 1, 1, 100000000.00, 0.00, 0),
  (2, 2, 1, 100000000.00, 0.00, 0),
  (3, 3, 1, 100000000.00, 0.00, 0),
  (4, 8, 1, 100000000.00, 0.00, 0),
  (5, 6, 1, 100000000.00, 0.00, 0);

-- 5) RealTeam (all in League 1 for simplicity)
INSERT INTO realteam (id, name, id_league, external_api_id) VALUES
  (1, 'Equipo Real 1', 1, 'TEAM-1001'),
  (2, 'Equipo Real 2', 1, 'TEAM-1002'),
  (3, 'Equipo Real 3', 1, 'TEAM-1003'),
  (4, 'Equipo Real 4', 1, 'TEAM-1004'),
  (5, 'Equipo Real 5', 1, 'TEAM-1005');

-- 6) RealPlayer
INSERT INTO realplayer (id, external_api_id, name, position, id_real_team, market_value, active) VALUES
  (1, 'PLAYER-2001', 'Jugador 1', 'GK', 1, 5000000.00, 1),
  (2, 'PLAYER-2002', 'Jugador 2', 'DEF', 2, 10000000.00, 1),
  (3, 'PLAYER-2003', 'Jugador 3', 'MID', 3, 15000000.00, 1),
  (4, 'PLAYER-2004', 'Jugador 4', 'FWD', 4, 20000000.00, 1),
  (5, 'PLAYER-2005', 'Jugador 5', 'MID', 5, 25000000.00, 1);

-- 7) ParticipantSquad (initial assignment: each participant owns one player)
INSERT INTO participantsquad (id, id_participant, id_real_player, acquisition_date, release_date, buy_price, acquisition_type) VALUES
  (1, 1, 1, NOW(), NULL, 5000000.00, 'INITIAL'),
  (2, 2, 2, NOW(), NULL, 10000000.00, 'INITIAL'),
  (3, 3, 3, NOW(), NULL, 15000000.00, 'INITIAL'),
  (4, 4, 4, NOW(), NULL, 20000000.00, 'INITIAL'),
  (5, 5, 5, NOW(), NULL, 25000000.00, 'INITIAL');

-- 8) Matchday (League 1, Season 2026)
INSERT INTO matchday (id, id_league, season, matchday_number, start_date, end_date, status) VALUES
  (1, 1, '2026', 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'FINISHED'),
  (2, 1, '2026', 2, DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'FINISHED'),
  (3, 1, '2026', 3, DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'FINISHED'),
  (4, 1, '2026', 4, DATE_ADD(CURDATE(), INTERVAL 4 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'FINISHED'),
  (5, 1, '2026', 5, DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'FINISHED');

-- 9) Match
INSERT INTO `match` (id, id_matchday, external_api_id, home_team, away_team, start_datetime, status) VALUES
  (1, 1, 'MATCH-3001', 'Equipo Local 1', 'Equipo Visita 1', DATE_ADD(NOW(), INTERVAL 1 DAY), 'FINISHED'),
  (2, 2, 'MATCH-3002', 'Equipo Local 2', 'Equipo Visita 2', DATE_ADD(NOW(), INTERVAL 2 DAY), 'FINISHED'),
  (3, 3, 'MATCH-3003', 'Equipo Local 3', 'Equipo Visita 3', DATE_ADD(NOW(), INTERVAL 3 DAY), 'FINISHED'),
  (4, 4, 'MATCH-3004', 'Equipo Local 4', 'Equipo Visita 4', DATE_ADD(NOW(), INTERVAL 4 DAY), 'FINISHED'),
  (5, 5, 'MATCH-3005', 'Equipo Local 5', 'Equipo Visita 5', DATE_ADD(NOW(), INTERVAL 5 DAY), 'FINISHED');

-- 10) MatchdayMarket (Tournament 1, Matchday 1, 5 listings)
INSERT INTO matchdaymarket (id, id_tournament, id_matchday, id_real_player, min_price, origin, id_seller_participant, creation_date) VALUES
  (1, 1, 1, 1, 5000000.00, 'SYSTEM', NULL, NOW()),
  (2, 1, 1, 2, 10000000.00, 'SYSTEM', NULL, NOW()),
  (3, 1, 1, 3, 15000000.00, 'SYSTEM', NULL, NOW()),
  (4, 1, 1, 4, 20000000.00, 'SYSTEM', NULL, NOW()),
  (5, 1, 1, 5, 25000000.00, 'SYSTEM', NULL, NOW());

-- 11) Bid (one ACTIVE bid per market+participant enforced by generated active_flag)
INSERT INTO bid (id, id_market, id_participant, offered_amount, status, bid_date, cancel_date) VALUES
  (1, 1, 1, 6000000.00, 'ACTIVA', NOW(), NULL),
  (2, 2, 2, 11000000.00, 'ACTIVA', NOW(), NULL),
  (3, 3, 3, 16000000.00, 'ACTIVA', NOW(), NULL),
  (4, 4, 4, 21000000.00, 'ACTIVA', NOW(), NULL),
  (5, 5, 5, 26000000.00, 'ACTIVA', NOW(), NULL);

-- 12) PlayerPerformance (Matchday 1 points cache)
INSERT INTO playerperformance (id, id_real_player, id_matchday, points_obtained, played, update_date) VALUES
  (1, 1, 1, 6, 1, NOW()),
  (2, 2, 1, 4, 1, NOW()),
  (3, 3, 1, 8, 1, NOW()),
  (4, 4, 1, 10, 1, NOW()),
  (5, 5, 1, 3, 1, NOW());

-- 13) ParticipantMatchdayPoints (Matchday 1 totals per participant)
INSERT INTO participantmatchdaypoints (id, id_participant, id_matchday, matchday_points, calc_date) VALUES
  (1, 1, 1, 6, NOW()),
  (2, 2, 1, 4, NOW()),
  (3, 3, 1, 8, NOW()),
  (4, 4, 1, 10, NOW()),
  (5, 5, 1, 3, NOW());

-- 14) PlayerPointsBreakdown (audit per player contribution)
INSERT INTO playerpointsbreakdown (id, id_participant, id_matchday, id_real_player, contributed_pts, id_performance) VALUES
  (1, 1, 1, 1, 6, 1),
  (2, 2, 1, 2, 4, 2),
  (3, 3, 1, 3, 8, 3),
  (4, 4, 1, 4, 10, 4),
  (5, 5, 1, 5, 3, 5);

-- 15) PlayerClause (one per player per tournament)
INSERT INTO playerclause (id, id_tournament, id_real_player, id_owner_participant, base_clause, additional_clause_shielding, total_clause, update_date) VALUES
  (1, 1, 1, 1, 10000000.00, 2000000.00, 12000000.00, NOW()),
  (2, 1, 2, 2, 20000000.00, 4000000.00, 24000000.00, NOW()),
  (3, 1, 3, 3, 30000000.00, 6000000.00, 36000000.00, NOW()),
  (4, 1, 4, 4, 40000000.00, 8000000.00, 48000000.00, NOW()),
  (5, 1, 5, 5, 50000000.00, 10000000.00, 60000000.00, NOW());

-- 16) Shielding (history of shielding investments)
INSERT INTO shielding (id, id_clause, id_participant, invested_amount, clause_increase, shielding_date) VALUES
  (1, 1, 1, 500000.00, 1000000.00, NOW()),
  (2, 2, 2, 1000000.00, 2000000.00, NOW()),
  (3, 3, 3, 1500000.00, 3000000.00, NOW()),
  (4, 4, 4, 2000000.00, 4000000.00, NOW()),
  (5, 5, 5, 2500000.00, 5000000.00, NOW());

-- 17) Transaction (ledger examples)
INSERT INTO `transaction`(`id`, `id_origin_participant`, `id_target_participant`, `id_tournament`, `type`, `amount`, `ref_table`, `ref_id`, `creation_date`, 
`publish_date`, `effective_date`)
VALUES
  (1, 1, NULL, 1, 'BID_RESERVE', -6000000.00, 'Bid', 1, NOW(), NOW(), NOW()),
  (2, 2, NULL, 1, 'BID_RESERVE', -11000000.00, 'Bid', 2, NOW(), NOW(), NOW()),
  (3, NULL, 3, 1, 'INSTANT_SELL_INCOME', 12750000.00, 'ParticipantSquad', 3, NOW(), NOW(), NOW()),
  (4, 4, NULL, 1, 'NEGOTIATION_RESERVE', -9000000.00, 'Negotiation', 1, NOW(), NOW(), NOW()),
  (5, 5, 1, 1, 'TRANSFER_PAYMENT', -15000000.00, 'Negotiation', 2, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 4 HOUR));

-- 18) Negotiation (5 offers between participants)
INSERT INTO negotiation (id, id_tournament, id_seller_participant, id_buyer_participant, id_real_player, agreed_amount, status, creation_date, publish_date, 
effective_date, reject_date) VALUES
  (1, 1, 1, 4, 1, 9000000.00, 'PENDING', NOW(), NULL, NULL, NULL),
  (2, 1, 2, 5, 2, 15000000.00, 'ACCEPTED', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 4 HOUR), NULL),
  (3, 1, 3, 1, 3, 12000000.00, 'REJECTED', NOW(), NOW(), NULL, NOW()),
  (4, 1, 4, 2, 4, 18000000.00, 'PENDING', NOW(), NULL, NULL, NULL),
  (5, 1, 5, 3, 5, 20000000.00, 'PENDING', NOW(), NULL, NULL, NULL);

COMMIT;