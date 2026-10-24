-- Existing tournaments keep their squads and markets. They must never be drawn again.
ALTER TABLE tournament
  ADD creator_user_id INT NULL,
  ADD initial_draw_state VARCHAR(16) NOT NULL DEFAULT 'legacy',
  ADD initial_draw_completed_at DATETIME NULL,
  ADD initial_draw_summary JSON NULL;
ALTER TABLE tournament ALTER COLUMN initial_draw_state SET DEFAULT 'waiting';
-- Registration time remains intact; sporting eligibility begins when a squad is assigned.
ALTER TABLE participant ADD playing_since DATETIME NULL;
