# TRIGGERS

DELIMITER $$

DROP TRIGGER IF EXISTS trg_available_money_participant $$
CREATE TRIGGER trg_available_money_participant AFTER INSERT ON bid
FOR EACH ROW
BEGIN
  update participant p
  set p.reserved_money = p.reserved_money + bid.offered_amount and p.available_money = p.available_money - bid.offered_amount
  where bid.participant_id = p.id
  ;
END $$

DELIMITER ;
