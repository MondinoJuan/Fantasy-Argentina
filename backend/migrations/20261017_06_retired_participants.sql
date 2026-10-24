-- Preserve squads, scores, bids, ledger and lineup history after leaving a tournament.
ALTER TABLE participant ADD retired_at DATETIME NULL;
