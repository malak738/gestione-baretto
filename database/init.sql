USE baretto;

CREATE TABLE IF NOT EXISTS prodotti (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  descrizione TEXT NULL,
  prezzo DECIMAL(10, 2) NOT NULL,
  disponibilita BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  CONSTRAINT chk_prodotti_prezzo CHECK (prezzo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS personale (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  ruolo VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_personale_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ordini (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prodotto_id BIGINT UNSIGNED NOT NULL,
  personale_id BIGINT UNSIGNED NOT NULL,
  quantita INT UNSIGNED NOT NULL,
  totale DECIMAL(10, 2) NOT NULL,
  data_ordine TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ordini_prodotto_id (prodotto_id),
  KEY idx_ordini_personale_id (personale_id),
  CONSTRAINT chk_ordini_quantita CHECK (quantita > 0),
  CONSTRAINT chk_ordini_totale CHECK (totale >= 0),
  CONSTRAINT fk_ordini_prodotto FOREIGN KEY (prodotto_id)
    REFERENCES prodotti (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_ordini_personale FOREIGN KEY (personale_id)
    REFERENCES personale (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
