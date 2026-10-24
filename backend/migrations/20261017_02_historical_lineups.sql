-- Additive migration for point 2. Apply to the database used by the current ORM entities.
-- Back up first. MySQL DDL commits implicitly. Apply this file ONCE, before deploying this code.
-- It does not run the old reset scripts, alter ownership, or invent past lineups.

-- Stable source identity independent of generated IDs and DATETIME precision.
ALTER TABLE participant_squad ADD COLUMN history_source_key VARCHAR(255) NULL;
UPDATE participant_squad SET history_source_key = CONCAT('legacy-squad-', id) WHERE history_source_key IS NULL;
ALTER TABLE participant_squad MODIFY history_source_key VARCHAR(255) NOT NULL,
  ADD UNIQUE KEY participant_squad_history_source_key_unique (history_source_key);

CREATE TABLE squad_revision (
  id INT NOT NULL AUTO_INCREMENT,
  participant_id INT NOT NULL,
  source_key VARCHAR(255) NOT NULL,
  effective_at DATETIME(3) NOT NULL,
  acquired_at DATETIME(3) NOT NULL,
  released_at DATETIME(3) NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  legacy_baseline TINYINT(1) NOT NULL DEFAULT 0,
  state JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY squad_revision_participant_effective_at_index (participant_id, effective_at),
  CONSTRAINT squad_revision_participant_fk FOREIGN KEY (participant_id) REFERENCES participant(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE matchday_lineup (
  id INT NOT NULL AUTO_INCREMENT,
  participant_id INT NOT NULL,
  matchday_id INT NOT NULL,
  match_id INT NULL,
  source_revision_id INT NULL,
  scope_key VARCHAR(255) NOT NULL,
  cutoff_at DATETIME(3) NOT NULL,
  allow_changes_during_matchday TINYINT(1) NOT NULL DEFAULT 0,
  formation VARCHAR(255) NOT NULL,
  starting_slots JSON NOT NULL,
  substitutes_real_players_ids JSON NOT NULL,
  captain_real_player_id INT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY matchday_lineup_scope_key_unique (scope_key),
  KEY matchday_lineup_participant_matchday_index (participant_id, matchday_id),
  CONSTRAINT matchday_lineup_participant_fk FOREIGN KEY (participant_id) REFERENCES participant(id) ON DELETE CASCADE,
  CONSTRAINT matchday_lineup_matchday_fk FOREIGN KEY (matchday_id) REFERENCES matchday(id) ON DELETE CASCADE,
  CONSTRAINT matchday_lineup_match_fk FOREIGN KEY (match_id) REFERENCES game_match(id) ON DELETE RESTRICT,
  CONSTRAINT matchday_lineup_revision_fk FOREIGN KEY (source_revision_id) REFERENCES squad_revision(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE player_points_breakdown
  ADD COLUMN performance_contributions JSON NULL,
  MODIFY contributed_points DOUBLE NOT NULL;
ALTER TABLE participant_matchday_points MODIFY matchday_points DOUBLE NOT NULL;
ALTER TABLE participant MODIFY total_score DOUBLE NOT NULL DEFAULT 0;
