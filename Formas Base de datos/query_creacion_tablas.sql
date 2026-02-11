CREATE DATABASE IF NOT EXISTS fantasy_argentina
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE fantasy_argentina;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Shielding;
DROP TABLE IF EXISTS PlayerClause;
DROP TABLE IF EXISTS PlayerPointsBreakdown;
DROP TABLE IF EXISTS ParticipantMatchdayPoints;
DROP TABLE IF EXISTS PlayerPerformance;
DROP TABLE IF EXISTS Negotiation;
DROP TABLE IF EXISTS Transaction;
DROP TABLE IF EXISTS Bid;
DROP TABLE IF EXISTS MatchdayMarket;
DROP TABLE IF EXISTS `Match`;
DROP TABLE IF EXISTS Matchday;
DROP TABLE IF EXISTS ParticipantSquad;
DROP TABLE IF EXISTS RealPlayer;
DROP TABLE IF EXISTS RealTeam;
DROP TABLE IF EXISTS Participant;
DROP TABLE IF EXISTS Tournament;
DROP TABLE IF EXISTS League;
DROP TABLE IF EXISTS `User`;

SET FOREIGN_KEY_CHECKS = 1;

-- 1) USER  :contentReference[oaicite:4]{index=4}
CREATE TABLE `User` (
  id_user         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(190) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  register_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_user),
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB;

-- 3) LEAGUE  :contentReference[oaicite:5]{index=5}
CREATE TABLE League (
  id_league       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120) NOT NULL,
  country         VARCHAR(80)  NOT NULL,
  external_api_id VARCHAR(80)  NULL,
  PRIMARY KEY (id_league),
  KEY idx_league_external (external_api_id)
) ENGINE=InnoDB;

-- 2) TOURNAMENT  :contentReference[oaicite:6]{index=6}
CREATE TABLE Tournament (
  id_tournament               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                        VARCHAR(120) NOT NULL,
  id_league                   BIGINT UNSIGNED NOT NULL,
  creation_date               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  initial_budget              DECIMAL(15,2) NOT NULL,
  squad_size                  INT NOT NULL,
  status                      VARCHAR(30) NOT NULL,
  clause_enable_date          DATETIME NULL,
  PRIMARY KEY (id_tournament),
  KEY idx_tournament_league (id_league),
  CONSTRAINT fk_tournament_league
    FOREIGN KEY (id_league) REFERENCES League(id_league)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4) PARTICIPANT  :contentReference[oaicite:7]{index=7}
-- dinero_disponible = budget_bank - reserved_money (columna generada)
CREATE TABLE Participant (
  id_participant    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_user           BIGINT UNSIGNED NOT NULL,
  id_tournament     BIGINT UNSIGNED NOT NULL,
  bank_budget       DECIMAL(15,2) NOT NULL,
  reserved_money    DECIMAL(15,2) NOT NULL DEFAULT 0,
  available_money   DECIMAL(15,2) AS (bank_budget - reserved_money) STORED,
  total_points      INT NOT NULL DEFAULT 0,
  join_date         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_participant),
  UNIQUE KEY uq_participant_user_tournament (id_user, id_tournament),
  KEY idx_participant_tournament_points (id_tournament, total_points),
  CONSTRAINT fk_participant_user
    FOREIGN KEY (id_user) REFERENCES `User`(id_user)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_participant_tournament
    FOREIGN KEY (id_tournament) REFERENCES Tournament(id_tournament)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6) REAL_TEAM  :contentReference[oaicite:8]{index=8}
CREATE TABLE RealTeam (
  id_real_team     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(120) NOT NULL,
  id_league        BIGINT UNSIGNED NOT NULL,
  external_api_id  VARCHAR(80) NULL,
  PRIMARY KEY (id_real_team),
  KEY idx_realteam_league (id_league),
  KEY idx_realteam_external (external_api_id),
  CONSTRAINT fk_realteam_league
    FOREIGN KEY (id_league) REFERENCES League(id_league)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5) REAL_PLAYER  :contentReference[oaicite:9]{index=9}
CREATE TABLE RealPlayer (
  id_real_player      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  external_api_id     VARCHAR(80) NULL,
  name                VARCHAR(120) NOT NULL,
  position            VARCHAR(40) NOT NULL,
  id_real_team        BIGINT UNSIGNED NOT NULL,
  market_value        DECIMAL(15,2) NOT NULL,
  active              TINYINT(1) NOT NULL DEFAULT 1,
  last_update         DATETIME NULL,
  PRIMARY KEY (id_real_player),
  KEY idx_realplayer_team (id_real_team),
  KEY idx_realplayer_external (external_api_id),
  CONSTRAINT fk_realplayer_realteam
    FOREIGN KEY (id_real_team) REFERENCES RealTeam(id_real_team)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 7) PARTICIPANT_SQUAD  :contentReference[oaicite:10]{index=10}
CREATE TABLE ParticipantSquad (
  id_squad             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_participant       BIGINT UNSIGNED NOT NULL,
  id_real_player       BIGINT UNSIGNED NOT NULL,
  acquisition_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  release_date         DATETIME NULL,
  buy_price            DECIMAL(15,2) NOT NULL,
  acquisition_type     VARCHAR(40) NOT NULL,
  PRIMARY KEY (id_squad),
  UNIQUE KEY uq_squad_unique (id_participant, id_real_player, acquisition_date),
  KEY idx_squad_participant (id_participant),
  KEY idx_squad_player (id_real_player),
  CONSTRAINT fk_squad_participant
    FOREIGN KEY (id_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_squad_realplayer
    FOREIGN KEY (id_real_player) REFERENCES RealPlayer(id_real_player)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8) MATCHDAY  :contentReference[oaicite:11]{index=11}
CREATE TABLE Matchday (
  id_matchday     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_league       BIGINT UNSIGNED NOT NULL,
  season          VARCHAR(20) NOT NULL,
  matchday_number INT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR(30) NOT NULL,
  PRIMARY KEY (id_matchday),
  UNIQUE KEY uq_matchday_unique (id_league, season, matchday_number),
  KEY idx_matchday_league (id_league),
  CONSTRAINT fk_matchday_league
    FOREIGN KEY (id_league) REFERENCES League(id_league)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 9) MATCH  :contentReference[oaicite:12]{index=12}
CREATE TABLE `Match` (
  id_match        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_matchday     BIGINT UNSIGNED NOT NULL,
  external_api_id VARCHAR(80) NULL,
  home_team       VARCHAR(120) NOT NULL,
  away_team       VARCHAR(120) NOT NULL,
  start_datetime  DATETIME NOT NULL,
  status          VARCHAR(30) NOT NULL,
  PRIMARY KEY (id_match),
  UNIQUE KEY uq_match_external (external_api_id),
  KEY idx_match_matchday (id_matchday),
  CONSTRAINT fk_match_matchday
    FOREIGN KEY (id_matchday) REFERENCES Matchday(id_matchday)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 10) MATCHDAY_MARKET  :contentReference[oaicite:13]{index=13}
CREATE TABLE MatchdayMarket (
  id_market                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_tournament             BIGINT UNSIGNED NOT NULL,
  id_matchday               BIGINT UNSIGNED NOT NULL,
  id_real_player            BIGINT UNSIGNED NOT NULL,
  min_price                 DECIMAL(15,2) NOT NULL,
  origin                    VARCHAR(40) NOT NULL,
  id_seller_participant     BIGINT UNSIGNED NULL,
  creation_date             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_market),
  UNIQUE KEY uq_market_unique (id_tournament, id_matchday, id_real_player),
  KEY idx_market_tournament_matchday (id_tournament, id_matchday),
  KEY idx_market_player (id_real_player),
  CONSTRAINT fk_market_tournament
    FOREIGN KEY (id_tournament) REFERENCES Tournament(id_tournament)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_market_matchday
    FOREIGN KEY (id_matchday) REFERENCES Matchday(id_matchday)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_market_realplayer
    FOREIGN KEY (id_real_player) REFERENCES RealPlayer(id_real_player)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_market_seller
    FOREIGN KEY (id_seller_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 11) BID  :contentReference[oaicite:14]{index=14}
CREATE TABLE Bid (
  id_bid            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_market         BIGINT UNSIGNED NOT NULL,
  id_participant    BIGINT UNSIGNED NOT NULL,
  offered_amount    DECIMAL(15,2) NOT NULL,
  status            VARCHAR(20) NOT NULL,
  bid_date          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancel_date       DATETIME NULL,

  -- MySQL workaround para "UNIQUE (...) WHERE status='ACTIVA'"
  active_flag       TINYINT GENERATED ALWAYS AS (
                    CASE WHEN status = 'ACTIVA' THEN 1 ELSE NULL END
                    ) STORED,

  PRIMARY KEY (id_bid),
  UNIQUE KEY uq_bid_active_one_per_market_participant (id_market, id_participant, active_flag),
  KEY idx_bid_participant_status (id_participant, status),
  KEY idx_bid_market_status (id_market, status),
  CONSTRAINT fk_bid_market
    FOREIGN KEY (id_market) REFERENCES MatchdayMarket(id_market)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_bid_participant
    FOREIGN KEY (id_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 12) PLAYER_PERFORMANCE  :contentReference[oaicite:15]{index=15}
CREATE TABLE PlayerPerformance (
  id_performance    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_real_player    BIGINT UNSIGNED NOT NULL,
  id_matchday       BIGINT UNSIGNED NOT NULL,
  points_obtained   INT NOT NULL,
  played            TINYINT(1) NOT NULL,
  update_date       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_performance),
  UNIQUE KEY uq_performance_unique (id_real_player, id_matchday),
  KEY idx_performance_matchday (id_matchday),
  CONSTRAINT fk_performance_player
    FOREIGN KEY (id_real_player) REFERENCES RealPlayer(id_real_player)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_performance_matchday
    FOREIGN KEY (id_matchday) REFERENCES Matchday(id_matchday)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 13) PARTICIPANT_MATCHDAY_POINTS  :contentReference[oaicite:16]{index=16}
CREATE TABLE ParticipantMatchdayPoints (
  id_participant_matchday_points BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_participant                 BIGINT UNSIGNED NOT NULL,
  id_matchday                    BIGINT UNSIGNED NOT NULL,
  matchday_points                INT NOT NULL,
  calc_date                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_participant_matchday_points),
  UNIQUE KEY uq_participant_matchday (id_participant, id_matchday),
  KEY idx_pmp_matchday (id_matchday),
  CONSTRAINT fk_pmp_participant
    FOREIGN KEY (id_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pmp_matchday
    FOREIGN KEY (id_matchday) REFERENCES Matchday(id_matchday)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 14) PLAYER_POINTS_BREAKDOWN  :contentReference[oaicite:17]{index=17}
CREATE TABLE PlayerPointsBreakdown (
  id_breakdown     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_participant   BIGINT UNSIGNED NOT NULL,
  id_matchday      BIGINT UNSIGNED NOT NULL,
  id_real_player   BIGINT UNSIGNED NOT NULL,
  contributed_pts  INT NOT NULL,
  id_performance   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_breakdown),
  UNIQUE KEY uq_breakdown_unique (id_participant, id_matchday, id_real_player),
  KEY idx_breakdown_participant (id_participant),
  CONSTRAINT fk_breakdown_participant
    FOREIGN KEY (id_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_breakdown_matchday
    FOREIGN KEY (id_matchday) REFERENCES Matchday(id_matchday)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_breakdown_player
    FOREIGN KEY (id_real_player) REFERENCES RealPlayer(id_real_player)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_breakdown_performance
    FOREIGN KEY (id_performance) REFERENCES PlayerPerformance(id_performance)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 15) PLAYER_CLAUSE  :contentReference[oaicite:18]{index=18}
CREATE TABLE PlayerClause (
  id_clause                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_tournament                BIGINT UNSIGNED NOT NULL,
  id_real_player               BIGINT UNSIGNED NOT NULL,
  id_owner_participant         BIGINT UNSIGNED NOT NULL,
  base_clause                  DECIMAL(15,2) NOT NULL,
  additional_clause_shielding  DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_clause                 DECIMAL(15,2) NOT NULL,
  update_date                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_clause),
  UNIQUE KEY uq_clause_unique (id_tournament, id_real_player),
  KEY idx_clause_owner (id_owner_participant),
  CONSTRAINT fk_clause_tournament
    FOREIGN KEY (id_tournament) REFERENCES Tournament(id_tournament)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_clause_player
    FOREIGN KEY (id_real_player) REFERENCES RealPlayer(id_real_player)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_clause_owner
    FOREIGN KEY (id_owner_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 16) SHIELDING  :contentReference[oaicite:19]{index=19}
CREATE TABLE Shielding (
  id_shielding      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_clause         BIGINT UNSIGNED NOT NULL,
  id_participant    BIGINT UNSIGNED NOT NULL,
  invested_amount   DECIMAL(15,2) NOT NULL,
  clause_increase   DECIMAL(15,2) NOT NULL,
  shielding_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_shielding),
  KEY idx_shielding_clause (id_clause),
  CONSTRAINT fk_shielding_clause
    FOREIGN KEY (id_clause) REFERENCES PlayerClause(id_clause)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_shielding_participant
    FOREIGN KEY (id_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 17) TRANSACTION  :contentReference[oaicite:20]{index=20}
CREATE TABLE Transaction (
  id_transaction        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_origin_participant BIGINT UNSIGNED NULL,
  id_target_participant BIGINT UNSIGNED NULL,
  id_tournament         BIGINT UNSIGNED NOT NULL,
  type                 VARCHAR(40) NOT NULL,
  amount               DECIMAL(15,2) NOT NULL,
  ref_table            VARCHAR(60) NOT NULL,
  ref_id               BIGINT UNSIGNED NOT NULL,
  creation_date        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publish_date         DATETIME NULL,
  effective_date       DATETIME NULL,
  PRIMARY KEY (id_transaction),
  KEY idx_tx_tournament (id_tournament),
  CONSTRAINT fk_tx_origin
    FOREIGN KEY (id_origin_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_tx_target
    FOREIGN KEY (id_target_participant) REFERENCES Participant(id_participant)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_tx_tournament
    FOREIGN KEY (id_tournament) REFERENCES Tournament(id_tournament)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 18) NEGOTIATION  :contentReference[oaicite:21]{index=21}
CREATE TABLE Negotiation (
    id_negotiation BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_tournament BIGINT UNSIGNED NOT NULL,
    id_seller_participant BIGINT UNSIGNED NOT NULL,
    id_buyer_participant BIGINT UNSIGNED NOT NULL,
    id_real_player BIGINT UNSIGNED NOT NULL,
    agreed_amount DECIMAL(15 , 2 ) NOT NULL,
    status VARCHAR(30) NOT NULL,
    creation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    publish_date DATETIME NULL,
    effective_date DATETIME NULL,
    reject_date DATETIME NULL,
    PRIMARY KEY (id_negotiation),
    KEY idx_neg_buyer_status (id_buyer_participant , status),
    KEY idx_neg_seller_status (id_seller_participant , status),
    CONSTRAINT fk_neg_tournament FOREIGN KEY (id_tournament)
        REFERENCES Tournament (id_tournament)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_neg_seller FOREIGN KEY (id_seller_participant)
        REFERENCES Participant (id_participant)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_neg_buyer FOREIGN KEY (id_buyer_participant)
        REFERENCES Participant (id_participant)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_neg_player FOREIGN KEY (id_real_player)
        REFERENCES RealPlayer (id_real_player)
        ON UPDATE CASCADE ON DELETE RESTRICT
)  ENGINE=INNODB;