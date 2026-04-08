CREATE DATABASE IF NOT EXISTS fantasy_argentina
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE fantasy_argentina;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS shielding;
DROP TABLE IF EXISTS player_clause;
DROP TABLE IF EXISTS player_points_breakdown;
DROP TABLE IF EXISTS participant_matchday_points;
DROP TABLE IF EXISTS player_performance;
DROP TABLE IF EXISTS negotiation;
DROP TABLE IF EXISTS `transaction`;
DROP TABLE IF EXISTS bid;
DROP TABLE IF EXISTS matchday_market;
DROP TABLE IF EXISTS dependant_player;
DROP TABLE IF EXISTS `match`;
DROP TABLE IF EXISTS matchday;
DROP TABLE IF EXISTS participant_squad;
DROP TABLE IF EXISTS real_player;
DROP TABLE IF EXISTS real_team;
DROP TABLE IF EXISTS participant;
DROP TABLE IF EXISTS tournament;
DROP TABLE IF EXISTS league;
DROP TABLE IF EXISTS sport;
DROP TABLE IF EXISTS `user`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `user` (
  id                INT NOT NULL AUTO_INCREMENT,
  username          VARCHAR(255) NOT NULL,
  mail              VARCHAR(255) NOT NULL,
  password          VARCHAR(255) NOT NULL,
  registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type              VARCHAR(30) NOT NULL DEFAULT 'USER',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_mail (mail)
) ENGINE=InnoDB;

CREATE TABLE sport (
  id             INT NOT NULL AUTO_INCREMENT,
  id_en_api      INT NOT NULL,
  descripcion    VARCHAR(255) NOT NULL,
  cupo_titular   INT NOT NULL,
  cupo_suplente  INT NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE league (
  id             INT NOT NULL AUTO_INCREMENT,
  name           VARCHAR(255) NOT NULL,
  country        VARCHAR(255) NOT NULL,
  sport          VARCHAR(255) NOT NULL,
  id_en_api      INT NOT NULL,
  season_num     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE tournament (
  id                 INT NOT NULL AUTO_INCREMENT,
  name               VARCHAR(255) NOT NULL,
  league_id          INT NOT NULL,
  sport              VARCHAR(255) NOT NULL,
  creation_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  initial_budget     DOUBLE NOT NULL,
  squad_size         INT NOT NULL,
  status             VARCHAR(30) NOT NULL,
  public_code        VARCHAR(255) NOT NULL,
  clause_enable_date DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tournament_public_code (public_code),
  KEY idx_tournament_league (league_id),
  CONSTRAINT fk_tournament_league
    FOREIGN KEY (league_id) REFERENCES league(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE participant (
  id              INT NOT NULL AUTO_INCREMENT,
  user_id         INT NOT NULL,
  tournament_id   INT NOT NULL,
  bank_budget     DOUBLE NOT NULL,
  reserved_money  DOUBLE NOT NULL DEFAULT 0,
  available_money DOUBLE NOT NULL DEFAULT 0,
  total_score     INT NOT NULL DEFAULT 0,
  join_date       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant_user_tournament (user_id, tournament_id),
  KEY idx_participant_tournament (tournament_id),
  CONSTRAINT fk_participant_user
    FOREIGN KEY (user_id) REFERENCES `user`(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_participant_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE real_team (
  id          INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  league_id   INT NOT NULL,
  id_en_api   INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_real_team_league (league_id),
  CONSTRAINT fk_real_team_league
    FOREIGN KEY (league_id) REFERENCES league(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE real_player (
  id           INT NOT NULL AUTO_INCREMENT,
  id_en_api    INT NOT NULL,
  name         VARCHAR(255) NOT NULL,
  position     VARCHAR(30) NOT NULL,
  real_team_id INT NOT NULL,
  active       TINYINT(1) NOT NULL DEFAULT 1,
  last_update  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_real_player_team (real_team_id),
  CONSTRAINT fk_real_player_real_team
    FOREIGN KEY (real_team_id) REFERENCES real_team(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE dependant_player (
  id               INT NOT NULL AUTO_INCREMENT,
  tournament_id    INT NOT NULL,
  real_player_id   INT NOT NULL,
  market_value     DOUBLE NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dependant_player (tournament_id, real_player_id),
  KEY idx_dependant_player_real_player (real_player_id),
  CONSTRAINT fk_dependant_player_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_dependant_player_real_player
    FOREIGN KEY (real_player_id) REFERENCES real_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE participant_squad (
  id                INT NOT NULL AUTO_INCREMENT,
  participant_id    INT NOT NULL,
  real_player_id    INT NOT NULL,
  acquisition_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  buy_price         DOUBLE NOT NULL,
  release_date      DATETIME NULL,
  acquisition_type  VARCHAR(40) NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant_squad (participant_id, real_player_id, acquisition_date),
  KEY idx_participant_squad_player (real_player_id),
  CONSTRAINT fk_participant_squad_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_participant_squad_real_player
    FOREIGN KEY (real_player_id) REFERENCES real_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE matchday (
  id               INT NOT NULL AUTO_INCREMENT,
  league_id        INT NOT NULL,
  season           VARCHAR(20) NOT NULL,
  matchday_number  INT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  auto_update_at   DATETIME NULL,
  next_postponed_check_at DATETIME NULL,
  status           VARCHAR(30) NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_matchday (league_id, season, matchday_number),
  CONSTRAINT fk_matchday_league
    FOREIGN KEY (league_id) REFERENCES league(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `match` (
  id               INT NOT NULL AUTO_INCREMENT,
  matchday_id      INT NOT NULL,
  league_id        INT NOT NULL,
  external_api_id  VARCHAR(80) NOT NULL,
  home_team        VARCHAR(255) NOT NULL,
  away_team        VARCHAR(255) NOT NULL,
  start_date_time  DATETIME NOT NULL,
  status           VARCHAR(30) NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_external_api_id (external_api_id),
  KEY idx_match_matchday (matchday_id),
  KEY idx_match_league (league_id),
  CONSTRAINT fk_match_matchday
    FOREIGN KEY (matchday_id) REFERENCES matchday(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_match_league
    FOREIGN KEY (league_id) REFERENCES league(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE matchday_market (
  id                   INT NOT NULL AUTO_INCREMENT,
  tournament_id        INT NOT NULL,
  matchday_id          INT NOT NULL,
  dependant_player_id  INT NOT NULL,
  minimum_price        DOUBLE NOT NULL,
  origin               VARCHAR(40) NOT NULL,
  seller_participant_id INT NULL,
  creation_date        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_matchday_market (tournament_id, matchday_id, dependant_player_id),
  KEY idx_matchday_market_matchday (matchday_id),
  KEY idx_matchday_market_seller (seller_participant_id),
  CONSTRAINT fk_matchday_market_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_matchday_market_matchday
    FOREIGN KEY (matchday_id) REFERENCES matchday(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_matchday_market_dependant_player
    FOREIGN KEY (dependant_player_id) REFERENCES dependant_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_matchday_market_seller
    FOREIGN KEY (seller_participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE bid (
  id                 INT NOT NULL AUTO_INCREMENT,
  matchday_market_id INT NOT NULL,
  participant_id     INT NOT NULL,
  offered_amount     DOUBLE NOT NULL,
  status             VARCHAR(20) NOT NULL,
  bid_date           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancellation_date  DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bid_market_participant_status (matchday_market_id, participant_id, status),
  KEY idx_bid_participant_status (participant_id, status),
  KEY idx_bid_market_status (matchday_market_id, status),
  CONSTRAINT fk_bid_market
    FOREIGN KEY (matchday_market_id) REFERENCES matchday_market(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_bid_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE player_performance (
  id              INT NOT NULL AUTO_INCREMENT,
  real_player_id  INT NOT NULL,
  matchday_id     INT NOT NULL,
  league_id       INT NOT NULL,
  match_id        INT NULL,
  points_obtained INT NOT NULL,
  update_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_performance (real_player_id, matchday_id, league_id, match_id),
  CONSTRAINT fk_player_performance_player
    FOREIGN KEY (real_player_id) REFERENCES real_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_performance_matchday
    FOREIGN KEY (matchday_id) REFERENCES matchday(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_performance_league
    FOREIGN KEY (league_id) REFERENCES league(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_performance_match
    FOREIGN KEY (match_id) REFERENCES `match`(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE participant_matchday_points (
  id              INT NOT NULL AUTO_INCREMENT,
  participant_id  INT NOT NULL,
  matchday_id     INT NOT NULL,
  matchday_points INT NOT NULL,
  accumulated_points INT NULL,
  position        INT NULL,
  calculation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant_matchday_points (participant_id, matchday_id),
  CONSTRAINT fk_participant_matchday_points_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_participant_matchday_points_matchday
    FOREIGN KEY (matchday_id) REFERENCES matchday(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE player_points_breakdown (
  id                    INT NOT NULL AUTO_INCREMENT,
  participant_id        INT NOT NULL,
  matchday_id           INT NOT NULL,
  real_player_id        INT NOT NULL,
  contributed_points    INT NOT NULL,
  player_performance_id INT NOT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_points_breakdown (participant_id, matchday_id, real_player_id),
  CONSTRAINT fk_player_points_breakdown_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_points_breakdown_matchday
    FOREIGN KEY (matchday_id) REFERENCES matchday(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_points_breakdown_real_player
    FOREIGN KEY (real_player_id) REFERENCES real_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_points_breakdown_performance
    FOREIGN KEY (player_performance_id) REFERENCES player_performance(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE player_clause (
  id                         INT NOT NULL AUTO_INCREMENT,
  tournament_id              INT NOT NULL,
  dependant_player_id        INT NOT NULL,
  owner_participant_id       INT NOT NULL,
  base_clause                DOUBLE NOT NULL,
  additional_shielding_clause DOUBLE NOT NULL DEFAULT 0,
  total_clause               DOUBLE NOT NULL,
  update_date                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clause_disabled_until      DATETIME NULL,
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_clause (tournament_id, dependant_player_id),
  KEY idx_player_clause_owner (owner_participant_id),
  CONSTRAINT fk_player_clause_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_clause_dependant_player
    FOREIGN KEY (dependant_player_id) REFERENCES dependant_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_player_clause_owner
    FOREIGN KEY (owner_participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE shielding (
  id                INT NOT NULL AUTO_INCREMENT,
  player_clause_id  INT NOT NULL,
  participant_id    INT NOT NULL,
  invested_amount   DOUBLE NOT NULL,
  clause_increase   DOUBLE NOT NULL,
  shielding_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shielding_clause (player_clause_id),
  CONSTRAINT fk_shielding_clause
    FOREIGN KEY (player_clause_id) REFERENCES player_clause(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_shielding_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `transaction` (
  id                        INT NOT NULL AUTO_INCREMENT,
  origin_participant_id     INT NULL,
  destination_participant_id INT NULL,
  tournament_id             INT NOT NULL,
  type                      VARCHAR(40) NOT NULL,
  amount                    DOUBLE NOT NULL,
  reference_table           VARCHAR(60) NOT NULL,
  reference_id              VARCHAR(255) NOT NULL,
  creation_date             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publication_date          DATETIME NULL,
  effective_date            DATETIME NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transaction_tournament (tournament_id),
  CONSTRAINT fk_transaction_origin
    FOREIGN KEY (origin_participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_transaction_destination
    FOREIGN KEY (destination_participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_transaction_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE negotiation (
  id                    INT NOT NULL AUTO_INCREMENT,
  tournament_id         INT NOT NULL,
  seller_participant_id INT NOT NULL,
  buyer_participant_id  INT NOT NULL,
  dependant_player_id   INT NOT NULL,
  agreed_amount         DOUBLE NOT NULL,
  status                VARCHAR(30) NOT NULL,
  creation_date         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publication_date      DATETIME NULL,
  effective_date        DATETIME NULL,
  rejection_date        DATETIME NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_neg_buyer_status (buyer_participant_id, status),
  KEY idx_neg_seller_status (seller_participant_id, status),
  CONSTRAINT fk_negotiation_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_negotiation_seller
    FOREIGN KEY (seller_participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_negotiation_buyer
    FOREIGN KEY (buyer_participant_id) REFERENCES participant(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_negotiation_dependant_player
    FOREIGN KEY (dependant_player_id) REFERENCES dependant_player(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
