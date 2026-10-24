-- Apply after migrations 01-04. Does not reset existing league quotes or tournament clauses.
ALTER TABLE real_player_league_value
  MODIFY translated_value DOUBLE NULL,
  ADD evolution_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD evolution_base DOUBLE NULL,
  ADD evolution_history JSON NULL;
