-- Apply ONCE after 02 and 03, before starting the new backend. MySQL 8.0.16+.
-- Run 20261017_04_economy_ownership_preflight.sql first: all result sets must be empty.
-- DDL commits implicitly. This file does not charge accounts or invent historical ownership.
ALTER TABLE participant
 MODIFY bank_budget DOUBLE NOT NULL, MODIFY reserved_money DOUBLE NOT NULL DEFAULT 0,
 MODIFY available_money DOUBLE NOT NULL DEFAULT 0,
 ADD CONSTRAINT participant_money_valid CHECK (
  bank_budget >= 0 AND reserved_money >= 0 AND available_money >= 0
  AND bank_budget <= 9007199254740991 AND reserved_money <= 9007199254740991 AND available_money <= 9007199254740991
  AND bank_budget = FLOOR(bank_budget) AND reserved_money = FLOOR(reserved_money) AND available_money = FLOOR(available_money)
  AND bank_budget = reserved_money + available_money);
ALTER TABLE participant ADD UNIQUE KEY participant_id_tournament_unique (id, tournament_id);
-- Use VIRTUAL: a STORED generated column would conflict with the existing cascading participant FK.
-- https://dev.mysql.com/doc/refman/8.0/en/create-table-generated-columns.html
ALTER TABLE participant_squad ADD COLUMN starting_slots JSON NULL,
 ADD COLUMN active_participant_id INT GENERATED ALWAYS AS (CASE WHEN release_date IS NULL THEN participant_id ELSE NULL END) VIRTUAL,
 ADD UNIQUE KEY participant_squad_one_active_unique (active_participant_id);
ALTER TABLE matchday_market ADD COLUMN closed_at DATETIME NULL;
ALTER TABLE negotiation ADD COLUMN reserved_amount DOUBLE NOT NULL DEFAULT 0,
 MODIFY agreed_amount DOUBLE NOT NULL;
ALTER TABLE bid ADD COLUMN last_modified_at DATETIME NULL, MODIFY offered_amount DOUBLE NOT NULL;

-- Keep an independent FK index before removing the old tournament-prefixed unique index.
ALTER TABLE bid ADD KEY bid_tournament_lookup (tournament_id),
 ADD KEY bid_participant_lookup (participant_id), ADD KEY bid_player_lookup (real_player_id);

-- Discover the old generated index name rather than assuming a particular schema version.
SET @old_bid_index = (SELECT index_name FROM (
 SELECT index_name, GROUP_CONCAT(column_name ORDER BY column_name) AS cols
 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='bid' AND non_unique=0
 GROUP BY index_name
) indexes_for_bid WHERE cols='participant_id,real_player_id,tournament_id' LIMIT 1);
SET @ddl = IF(@old_bid_index IS NULL, 'SELECT 1', CONCAT('ALTER TABLE bid DROP INDEX `', REPLACE(@old_bid_index, '`', '``'), '`'));
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;
ALTER TABLE bid ADD UNIQUE KEY bid_market_participant_player_unique (matchday_market_id, participant_id, real_player_id);

ALTER TABLE `transaction` ADD COLUMN event_key VARCHAR(255) NULL,
 ADD COLUMN balance_change JSON NULL, MODIFY amount DOUBLE NOT NULL,
 ADD UNIQUE KEY transaction_event_key_unique (event_key);

-- Keep economic records when a participant leaves. Other participants' account records remain private.
SET @old_origin_fk = (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE table_schema=DATABASE() AND table_name='transaction' AND column_name='origin_participant_id' AND referenced_table_name='participant' LIMIT 1);
SET @ddl = IF(@old_origin_fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `transaction` DROP FOREIGN KEY `', REPLACE(@old_origin_fk, '`', '``'), '`'));
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;
SET @old_destination_fk = (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE table_schema=DATABASE() AND table_name='transaction' AND column_name='destination_participant_id' AND referenced_table_name='participant' LIMIT 1);
SET @ddl = IF(@old_destination_fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `transaction` DROP FOREIGN KEY `', REPLACE(@old_destination_fk, '`', '``'), '`'));
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;
ALTER TABLE `transaction`
 ADD CONSTRAINT transaction_origin_account_fk FOREIGN KEY (origin_participant_id) REFERENCES participant(id) ON DELETE SET NULL,
 ADD CONSTRAINT transaction_destination_account_fk FOREIGN KEY (destination_participant_id) REFERENCES participant(id) ON DELETE SET NULL;

CREATE TABLE player_ownership (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 tournament_id INT NOT NULL, real_player_id INT NOT NULL, owner_id INT NULL,
 changed_at DATETIME NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 UNIQUE KEY player_ownership_tournament_player_unique (tournament_id, real_player_id),
 KEY player_ownership_owner_index (owner_id),
 CONSTRAINT player_ownership_tournament_fk FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
 CONSTRAINT player_ownership_player_fk FOREIGN KEY (real_player_id) REFERENCES real_player(id) ON DELETE RESTRICT,
 CONSTRAINT player_ownership_owner_fk FOREIGN KEY (owner_id) REFERENCES participant(id) ON DELETE SET NULL,
 CONSTRAINT player_ownership_same_tournament_fk FOREIGN KEY (owner_id, tournament_id) REFERENCES participant(id, tournament_id) ON DELETE RESTRICT
);
CREATE TABLE ownership_movement (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 ownership_id INT NOT NULL, previous_owner_id INT NULL, next_owner_id INT NULL,
 reason VARCHAR(255) NOT NULL, occurred_at DATETIME NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 CONSTRAINT ownership_movement_ownership_fk FOREIGN KEY (ownership_id) REFERENCES player_ownership(id) ON DELETE CASCADE,
 CONSTRAINT ownership_movement_previous_fk FOREIGN KEY (previous_owner_id) REFERENCES participant(id) ON DELETE SET NULL,
 CONSTRAINT ownership_movement_next_fk FOREIGN KEY (next_owner_id) REFERENCES participant(id) ON DELETE SET NULL
);

-- Bootstrap is performed transactionally by initializeGameIntegrity on startup:
-- validate/record present ownership, normalize explicit slots, reconcile reserves from active offers,
-- reserve affordable legacy negotiations and cancel unaffordable legacy ones. Never backdate these observations.
