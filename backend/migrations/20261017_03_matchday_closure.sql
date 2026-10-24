-- Apply ONCE, after 20261017_02_historical_lineups.sql and before starting this backend.
-- MySQL DDL commits implicitly. This migration does not execute closures or award money.
ALTER TABLE matchday
  ADD COLUMN closure_completed_at DATETIME NULL,
  ADD COLUMN closure_summary JSON NULL;

ALTER TABLE game_match
  ADD COLUMN finished_at DATETIME NULL,
  ADD COLUMN pending_recovery TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN pending_original_start DATETIME NULL,
  ADD COLUMN recovery_completed_at DATETIME NULL,
  ADD KEY game_match_pending_recovery_index (league_id, pending_recovery);

ALTER TABLE matchday_automation_job
  ADD COLUMN lease_until DATETIME NULL,
  ADD COLUMN lease_token VARCHAR(36) NULL,
  ADD KEY automation_due_index (status, run_at),
  ADD KEY automation_lease_index (status, lease_until);

-- Existing completed closure jobs are evidence of an already executed economic closure.
-- Do not infer this from matchday.status: fixture imports also used to set it to completed.
UPDATE matchday m
JOIN matchday_automation_job j ON j.matchday_id = m.id AND j.step = 'matchday_closure' AND j.status = 'completed'
SET m.closure_completed_at = COALESCE(j.finished_at, j.updated_at), m.auto_update_at = NULL;

-- Clear old deadlines; automatic seeding rebuilds them using last kickoff + five hours.
UPDATE matchday SET auto_update_at = NULL WHERE closure_completed_at IS NULL;

UPDATE game_match SET pending_recovery = 1, pending_original_start = start_date_time WHERE status = 'postponed';

-- Old running jobs can be safely claimed after restart; completion markers prevent replaying money.
UPDATE matchday_automation_job SET status = 'pending', lease_token = NULL, lease_until = NULL WHERE status = 'running';
-- Failed jobs previously had no retry date. Make them eligible for the new bounded backoff.
UPDATE matchday_automation_job SET status = 'pending' WHERE status = 'failed';
