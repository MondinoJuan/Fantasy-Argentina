-- READ ONLY. Run before migration 04. Every query must return zero rows.
-- MySQL 8+. Fix/report existing inconsistent data explicitly; do not run a reset script.
SELECT id, bank_budget, available_money, reserved_money FROM participant
WHERE bank_budget < 0 OR available_money < 0 OR reserved_money < 0
 OR bank_budget <> available_money + reserved_money
 OR bank_budget <> FLOOR(bank_budget) OR reserved_money <> FLOOR(reserved_money) OR available_money <> FLOOR(available_money);

SELECT participant_id, COUNT(*) AS active_squads FROM participant_squad
WHERE release_date IS NULL GROUP BY participant_id HAVING COUNT(*) > 1;

SELECT id, participant_id FROM participant_squad WHERE release_date IS NULL
AND (JSON_LENGTH(starting_real_players_ids) > 11 OR JSON_LENGTH(substitutes_real_players_ids) > 5
 OR formation NOT IN ('4-4-2', '4-3-3', '3-4-3', '5-4-1'));

WITH held AS (
 SELECT s.participant_id, p.tournament_id, j.player_id FROM participant_squad s JOIN participant p ON p.id=s.participant_id
 CROSS JOIN JSON_TABLE(s.starting_real_players_ids, '$[*]' COLUMNS(player_id INT PATH '$')) j WHERE s.release_date IS NULL
 UNION ALL
 SELECT s.participant_id, p.tournament_id, j.player_id FROM participant_squad s JOIN participant p ON p.id=s.participant_id
 CROSS JOIN JSON_TABLE(s.substitutes_real_players_ids, '$[*]' COLUMNS(player_id INT PATH '$')) j WHERE s.release_date IS NULL
)
SELECT tournament_id, player_id, COUNT(*) AS duplicate_holders FROM held WHERE player_id > 0
GROUP BY tournament_id, player_id HAVING COUNT(*) > 1;

SELECT id, offered_amount FROM bid WHERE offered_amount < 0 OR offered_amount <> FLOOR(offered_amount);
SELECT id, agreed_amount FROM negotiation WHERE agreed_amount <= 0 OR agreed_amount <> FLOOR(agreed_amount);

-- Offers and market dates must belong to the same league/tournament/account.
SELECT b.id FROM bid b JOIN participant p ON p.id=b.participant_id
JOIN matchday_market m ON m.id=b.matchday_market_id
WHERE b.tournament_id <> p.tournament_id OR b.tournament_id <> m.tournament_id;
SELECT m.id FROM matchday_market m JOIN tournament t ON t.id=m.tournament_id JOIN matchday d ON d.id=m.matchday_id
WHERE t.league_id <> d.league_id;
