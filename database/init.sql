USE baretto;

CREATE TABLE IF NOT EXISTS prodotti (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  descrizione TEXT NULL,
  prezzo DECIMAL(10, 2) NOT NULL,
  immagine_url VARCHAR(2048) NULL,
  disponibilita BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  CONSTRAINT chk_prodotti_prezzo CHECK (prezzo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dipendenti (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  ruolo VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dipendenti_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ordini (
  numero_ordine BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prodotto_id BIGINT UNSIGNED NOT NULL,
  dipendente_id BIGINT UNSIGNED NULL,
  quantita INT UNSIGNED NOT NULL,
  stato VARCHAR(30) NOT NULL DEFAULT 'in_attesa',
  totale DECIMAL(10, 2) NOT NULL,
  riferimento_ordine CHAR(36) NULL,
  cliente_nome VARCHAR(100) NULL,
  metodo_pagamento VARCHAR(20) NULL,
  data_ordine TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (numero_ordine),
  KEY idx_ordini_prodotto_id (prodotto_id),
  KEY idx_ordini_dipendente_id (dipendente_id),
  CONSTRAINT chk_ordini_quantita CHECK (quantita > 0),
  CONSTRAINT chk_ordini_totale CHECK (totale >= 0),
  CONSTRAINT fk_ordini_prodotto FOREIGN KEY (prodotto_id)
    REFERENCES prodotti (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_ordini_dipendente FOREIGN KEY (dipendente_id)
    REFERENCES dipendenti (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Caffè espresso', 'Espresso intenso e aromatico, ideale a qualsiasi ora della giornata.', 2.50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Caffè espresso');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Cappuccino', 'Caffè con schiuma di latte e cacao in polvere.', 3.20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Cappuccino');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Croissant al burro', 'Pasticceria fresca e croccante, perfetta per la colazione.', 2.80, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Croissant al burro');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Spritz', 'Aperitivo leggero e rinfrescante, servito con ghiaccio.', 5.90, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Spritz');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Panino al prosciutto', 'Panino con prosciutto cotto, formaggio e verdure.', 7.50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Panino al prosciutto');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Tè caldo alla pesca', 'Tè caldo profumato alla pesca, servito in tazza.', 3.00, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Tè caldo alla pesca');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Spremuta d’arancia', 'Spremuta fresca preparata al momento.', 3.80, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Spremuta d’arancia');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Toast prosciutto e formaggio', 'Toast caldo con prosciutto cotto e formaggio filante.', 5.50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Toast prosciutto e formaggio');

INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
SELECT 'Muffin al cioccolato', 'Muffin morbido con gocce di cioccolato.', 3.00, TRUE
WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = 'Muffin al cioccolato');

INSERT INTO dipendenti (nome, cognome, ruolo, email)
SELECT 'Luca', 'Rossi', 'Barista', 'luca.rossi@barettocafe.it'
WHERE NOT EXISTS (SELECT 1 FROM dipendenti WHERE email = 'luca.rossi@barettocafe.it');

INSERT INTO dipendenti (nome, cognome, ruolo, email)
SELECT 'Sofia', 'Bianchi', 'Bartender', 'sofia.bianchi@barettocafe.it'
WHERE NOT EXISTS (SELECT 1 FROM dipendenti WHERE email = 'sofia.bianchi@barettocafe.it');

INSERT INTO dipendenti (nome, cognome, ruolo, email)
SELECT 'Marco', 'Verdi', 'Cameriere', 'marco.verdi@barettocafe.it'
WHERE NOT EXISTS (SELECT 1 FROM dipendenti WHERE email = 'marco.verdi@barettocafe.it');

INSERT INTO dipendenti (nome, cognome, ruolo, email)
SELECT 'Elena', 'Neri', 'Manager', 'elena.neri@barettocafe.it'
WHERE NOT EXISTS (SELECT 1 FROM dipendenti WHERE email = 'elena.neri@barettocafe.it');

INSERT INTO ordini (prodotto_id, dipendente_id, quantita, totale)
SELECT p.id, d.id, 2, 6.40
FROM prodotti p
JOIN dipendenti d ON d.email = 'luca.rossi@barettocafe.it'
WHERE p.nome = 'Cappuccino'
AND NOT EXISTS (
  SELECT 1
  FROM ordini o
  WHERE o.prodotto_id = p.id
    AND o.dipendente_id = d.id
    AND o.quantita = 2
);

INSERT INTO ordini (prodotto_id, dipendente_id, quantita, totale)
SELECT p.id, d.id, 1, 7.50
FROM prodotti p
JOIN dipendenti d ON d.email = 'marco.verdi@barettocafe.it'
WHERE p.nome = 'Panino al prosciutto'
AND NOT EXISTS (
  SELECT 1
  FROM ordini o
  WHERE o.prodotto_id = p.id
    AND o.dipendente_id = d.id
    AND o.quantita = 1
);

INSERT INTO ordini (prodotto_id, dipendente_id, quantita, totale)
SELECT p.id, d.id, 3, 17.70
FROM prodotti p
JOIN dipendenti d ON d.email = 'sofia.bianchi@barettocafe.it'
WHERE p.nome = 'Spritz'
AND NOT EXISTS (
  SELECT 1
  FROM ordini o
  WHERE o.prodotto_id = p.id
    AND o.dipendente_id = d.id
    AND o.quantita = 3
);

INSERT INTO ordini (prodotto_id, dipendente_id, quantita, totale)
SELECT p.id, d.id, 4, 11.20
FROM prodotti p
JOIN dipendenti d ON d.email = 'elena.neri@barettocafe.it'
WHERE p.nome = 'Croissant al burro'
AND NOT EXISTS (
  SELECT 1
  FROM ordini o
  WHERE o.prodotto_id = p.id
    AND o.dipendente_id = d.id
    AND o.quantita = 4
);
