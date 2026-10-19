'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
	process.loadEnvFile(envPath);
}

const pool = mysql.createPool({
	host: process.env.DB_HOST || '127.0.0.1',
	port: Number(process.env.DB_PORT || 3306),
	user: process.env.DB_USER || 'utente',
	password: process.env.DB_PASSWORD || 'password',
	database: process.env.DB_NAME || 'baretto',
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

const app = express();
app.use(express.json());

async function getOrderColumns() {
	const [columns] = await pool.query('SHOW COLUMNS FROM ordini');
	return columns.map((column) => column.Field);
}

async function getOrderEmployeeTable(columns) {
	if (columns.includes('dipendente_id')) return { table: 'dipendenti', column: 'dipendente_id' };
	if (columns.includes('personale_id')) return { table: 'personale', column: 'personale_id' };
	throw new Error('La tabella ordini non contiene una colonna dipendente riconosciuta.');
}

async function getAdminData() {
	const [productColumns] = await pool.query('SHOW COLUMNS FROM prodotti');
	const productFields = productColumns.map((column) => column.Field);
	const availabilityColumn = productFields.includes('disponibilita')
		? 'disponibilita'
		: productFields.includes('disponibile')
			? 'disponibile'
			: null;
	const [products] = await pool.query(`
		SELECT id, nome, descrizione, prezzo, immagine_url,
			${availabilityColumn ? `\`${availabilityColumn}\`` : 'TRUE'} AS disponibile
		FROM prodotti
		ORDER BY nome
	`);

	const orderColumns = await getOrderColumns();
	const employee = await getOrderEmployeeTable(orderColumns);
	const [employees] = await pool.query(
		`SELECT id, nome, cognome, ruolo, email FROM \`${employee.table}\` ORDER BY cognome, nome`,
	);

	const orderIdColumn = orderColumns.includes('numero_ordine') ? 'numero_ordine' : 'id';
	const orderDateColumn = orderColumns.includes('data_ordine')
		? 'data_ordine'
		: orderColumns.includes('creato_il')
			? 'creato_il'
			: null;
	const totalExpression = orderColumns.includes('totale')
		? 'o.totale'
		: orderColumns.includes('prezzo_unitario')
			? 'o.quantita * o.prezzo_unitario'
			: '0';
	const statusExpression = orderColumns.includes('stato') ? 'o.stato' : "'registrato'";
	const dateExpression = orderDateColumn ? `o.\`${orderDateColumn}\`` : 'NULL';
	const [orders] = await pool.query(`
		SELECT o.\`${orderIdColumn}\` AS id, o.riferimento_ordine, o.cliente_nome,
			o.metodo_pagamento, p.nome AS prodotto,
			COALESCE(CONCAT(e.nome, ' ', e.cognome), o.cliente_nome, 'Self-service') AS dipendente,
			o.quantita, ${totalExpression} AS totale, ${statusExpression} AS stato,
			${dateExpression} AS data_ordine
		FROM ordini o
		JOIN prodotti p ON p.id = o.prodotto_id
		LEFT JOIN \`${employee.table}\` e ON e.id = o.\`${employee.column}\`
		ORDER BY o.\`${orderIdColumn}\` DESC
		LIMIT 50
	`);

	return { prodotti: products, dipendenti: employees, ordini: orders };
}

app.get('/api/health', async (request, response) => {
	try {
		await pool.query('SELECT 1');
		response.json({ status: 'ok', database: 'connected' });
	} catch {
		response.status(503).json({ status: 'error', database: 'disconnected' });
	}
});

app.get('/api/menu', async (request, response) => {
	try {
		const [columns] = await pool.query('SHOW COLUMNS FROM prodotti');
		const fields = columns.map((column) => column.Field);
		const availabilityColumn = fields.includes('disponibilita')
			? 'disponibilita'
			: fields.includes('disponibile')
				? 'disponibile'
				: null;
		const [products] = await pool.query(`
			SELECT id, nome, descrizione, prezzo, immagine_url
			FROM prodotti
			${availabilityColumn ? `WHERE \`${availabilityColumn}\` = TRUE` : ''}
			ORDER BY nome
		`);
		response.json({ prodotti: products });
	} catch (error) {
		console.error('Errore durante il caricamento del menu:', error.message);
		response.status(500).json({ error: 'Impossibile caricare il menu.' });
	}
});

app.get('/api/admin/data', async (request, response) => {
	try {
		response.json(await getAdminData());
	} catch (error) {
		console.error('Errore durante il caricamento dei dati amministrativi:', error.message);
		response.status(500).json({ error: 'Impossibile caricare i dati del database.' });
	}
});

app.get('/api/orders/status', async (request, response) => {
	try {
		const columns = await getOrderColumns();
		const orderIdColumn = columns.includes('numero_ordine') ? 'numero_ordine' : 'id';
		const statusExpression = columns.includes('stato') ? 'o.stato' : "'registrato'";
		const [orders] = await pool.query(`
			SELECT o.\`${orderIdColumn}\` AS id, p.nome AS prodotto,
				o.quantita, ${statusExpression} AS stato
			FROM ordini o
			JOIN prodotti p ON p.id = o.prodotto_id
			ORDER BY o.\`${orderIdColumn}\` DESC
			LIMIT 100
		`);
		response.json({ ordini: orders });
	} catch (error) {
		console.error('Errore durante il caricamento dello stato degli ordini:', error.message);
		response.status(500).json({ error: 'Impossibile caricare lo stato degli ordini.' });
	}
});

app.post('/api/admin/prodotti', async (request, response) => {
	const { nome, descrizione = '', prezzo, disponibile = true, immagine_url = '' } = request.body || {};
	const productName = typeof nome === 'string' ? nome.trim() : '';
	const productDescription = typeof descrizione === 'string' ? descrizione.trim() : '';
	const productImage = typeof immagine_url === 'string' ? immagine_url.trim() : '';
	const productPrice = Number(prezzo);
	let validImageUrl = '';
	try {
		if (productImage) {
			const imageUrl = new URL(productImage);
			if (!['http:', 'https:'].includes(imageUrl.protocol)) throw new Error();
			validImageUrl = imageUrl.href;
		}
	} catch {
		return response.status(400).json({ error: 'Inserisci un URL immagine http o https valido.' });
	}

	if (!productName || productName.length > 150 || productDescription.length > 65535
		|| productImage.length > 2048
		|| !Number.isFinite(productPrice) || productPrice < 0 || productPrice > 99999999.99
		|| typeof disponibile !== 'boolean') {
		return response.status(400).json({ error: 'Inserisci nome, prezzo valido e disponibilità corretta.' });
	}

	try {
		const [productColumns] = await pool.query('SHOW COLUMNS FROM prodotti');
		const fields = productColumns.map((column) => column.Field);
		const availabilityColumn = fields.includes('disponibilita')
			? 'disponibilita'
			: fields.includes('disponibile')
				? 'disponibile'
				: null;
		const columns = ['nome', 'descrizione', 'prezzo', 'immagine_url'];
		const values = [productName, productDescription || null, productPrice, validImageUrl || null];
		if (availabilityColumn) {
			columns.push(availabilityColumn);
			values.push(disponibile);
		}
		const [result] = await pool.query(
			`INSERT INTO prodotti (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
			values,
		);
		response.status(201).json({ id: result.insertId, message: 'Prodotto inserito.' });
	} catch (error) {
		console.error('Errore durante l’inserimento del prodotto:', error.message);
		response.status(500).json({ error: 'Impossibile inserire il prodotto.' });
	}
});

app.post('/api/admin/dipendenti', async (request, response) => {
	const { nome, cognome, ruolo, email } = request.body || {};
	const employee = {
		nome: typeof nome === 'string' ? nome.trim() : '',
		cognome: typeof cognome === 'string' ? cognome.trim() : '',
		ruolo: typeof ruolo === 'string' ? ruolo.trim() : '',
		email: typeof email === 'string' ? email.trim() : '',
	};
	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!employee.nome || employee.nome.length > 100
		|| !employee.cognome || employee.cognome.length > 100
		|| !employee.ruolo || employee.ruolo.length > 100
		|| employee.email.length > 255 || !emailPattern.test(employee.email)) {
		return response.status(400).json({ error: 'Inserisci nome, cognome, ruolo e un’email valida.' });
	}

	try {
		const orderColumns = await getOrderColumns();
		const employeeTable = await getOrderEmployeeTable(orderColumns);
		const [employeeColumns] = await pool.query(`SHOW COLUMNS FROM \`${employeeTable.table}\``);
		const fields = employeeColumns.map((column) => column.Field);
		const columns = ['nome', 'cognome', 'ruolo', 'email'];
		const values = [employee.nome, employee.cognome, employee.ruolo, employee.email];
		if (fields.includes('telefono')) {
			columns.push('telefono');
			values.push(typeof request.body.telefono === 'string' ? request.body.telefono.trim() || null : null);
		}
		if (fields.includes('attivo')) {
			columns.push('attivo');
			values.push(true);
		}
		const [result] = await pool.query(
			`INSERT INTO \`${employeeTable.table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
			values,
		);
		response.status(201).json({ id: result.insertId, message: 'Dipendente inserito.' });
	} catch (error) {
		if (error.code === 'ER_DUP_ENTRY') {
			return response.status(409).json({ error: 'Esiste già un dipendente con questa email.' });
		}
		console.error('Errore durante l’inserimento del dipendente:', error.message);
		response.status(500).json({ error: 'Impossibile inserire il dipendente.' });
	}
});

app.post('/api/admin/ordini', async (request, response) => {
	const productId = Number(request.body?.prodotto_id);
	const employeeId = Number(request.body?.dipendente_id);
	const quantity = Number(request.body?.quantita);
	if (!Number.isSafeInteger(productId) || productId < 1
		|| !Number.isSafeInteger(employeeId) || employeeId < 1
		|| !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
		return response.status(400).json({ error: 'Seleziona prodotto e dipendente e inserisci una quantità valida.' });
	}

	try {
		const employee = await getOrderEmployeeTable(await getOrderColumns());
		const [productColumns] = await pool.query('SHOW COLUMNS FROM prodotti');
		const productFields = productColumns.map((column) => column.Field);
		const availabilityColumn = productFields.includes('disponibilita')
			? 'disponibilita'
			: productFields.includes('disponibile')
				? 'disponibile'
				: null;
		const [products] = await pool.query(
			`SELECT prezzo FROM prodotti WHERE id = ?${availabilityColumn ? ` AND \`${availabilityColumn}\` = TRUE` : ''}`,
			[productId],
		);
		if (products.length === 0) {
			return response.status(400).json({ error: 'Il prodotto selezionato non esiste o non è disponibile.' });
		}
		const [employees] = await pool.query(`SELECT id FROM \`${employee.table}\` WHERE id = ?`, [employeeId]);
		if (employees.length === 0) {
			return response.status(400).json({ error: 'Il dipendente selezionato non esiste.' });
		}

		const unitPrice = Number(products[0].prezzo);
		const totalCents = Math.round(unitPrice * 100) * quantity;
		const total = totalCents / 100;
		if (!Number.isSafeInteger(totalCents) || total > 99999999.99) {
			return response.status(400).json({ error: 'Il totale dell’ordine supera il limite consentito.' });
		}
		const columns = await getOrderColumns();
		const insertFields = ['prodotto_id', employee.column, 'quantita'];
		const values = [productId, employeeId, quantity];
		if (columns.includes('prezzo_unitario')) {
			insertFields.push('prezzo_unitario');
			values.push(unitPrice);
		}
		if (columns.includes('totale')) {
			insertFields.push('totale');
			values.push(total);
		}
		if (columns.includes('stato')) {
			insertFields.push('stato');
			values.push('in_attesa');
		}
		if (columns.includes('note') && typeof request.body.note === 'string' && request.body.note.trim()) {
			insertFields.push('note');
			values.push(request.body.note.trim().slice(0, 500));
		}
		if (!columns.includes('totale') && !columns.includes('prezzo_unitario')) {
			throw new Error('La tabella ordini non prevede un campo per il prezzo.');
		}
		const [result] = await pool.query(
			`INSERT INTO ordini (${insertFields.map((field) => `\`${field}\``).join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
			values,
		);
		response.status(201).json({ id: result.insertId, totale: total, message: 'Ordine inserito.' });
	} catch (error) {
		console.error('Errore durante l’inserimento dell’ordine:', error.message);
		response.status(500).json({ error: 'Impossibile inserire l’ordine.' });
	}
});

app.post('/api/orders', async (request, response) => {
	const customerName = typeof request.body?.cliente_nome === 'string' ? request.body.cliente_nome.trim() : '';
	const paymentMethod = request.body?.metodo_pagamento;
	const items = request.body?.articoli;
	if (!customerName || customerName.length > 100
		|| !['contanti', 'carta'].includes(paymentMethod)
		|| !Array.isArray(items) || items.length < 1 || items.length > 50) {
		return response.status(400).json({ error: 'Controlla nome, pagamento e prodotti nel carrello.' });
	}

	const quantities = new Map();
	for (const item of items) {
		const productId = Number(item?.prodotto_id);
		const quantity = Number(item?.quantita);
		if (!Number.isSafeInteger(productId) || productId < 1
			|| !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50
			|| quantities.has(productId)) {
			return response.status(400).json({ error: 'Il carrello contiene prodotti o quantità non validi.' });
		}
		quantities.set(productId, quantity);
	}

	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const productIds = [...quantities.keys()];
		const [productColumns] = await connection.query('SHOW COLUMNS FROM prodotti');
		const productFields = productColumns.map((column) => column.Field);
		const availabilityColumn = productFields.includes('disponibilita')
			? 'disponibilita'
			: productFields.includes('disponibile')
				? 'disponibile'
				: null;
		const placeholders = productIds.map(() => '?').join(', ');
		const [products] = await connection.query(
			`SELECT id, prezzo FROM prodotti WHERE id IN (${placeholders})${availabilityColumn ? ` AND \`${availabilityColumn}\` = TRUE` : ''} FOR UPDATE`,
			productIds,
		);
		if (products.length !== productIds.length) {
			await connection.rollback();
			return response.status(400).json({ error: 'Uno o più prodotti non sono più disponibili.' });
		}

		const orderColumns = await getOrderColumns();
		const groupId = randomUUID();
		let totalCents = 0;
		for (const product of products) {
			const lineTotal = Math.round(Number(product.prezzo) * 100) * quantities.get(Number(product.id));
			if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(totalCents + lineTotal)) {
				throw new Error('Il totale supera il limite consentito.');
			}
			totalCents += lineTotal;
		}
		if (totalCents > 9999999999) {
			throw new Error('Il totale supera il limite consentito.');
		}

		for (const product of products) {
			const unitPrice = Number(product.prezzo);
			const quantity = quantities.get(Number(product.id));
			const fields = ['prodotto_id', 'quantita'];
			const values = [product.id, quantity];
			if (orderColumns.includes('dipendente_id')) {
				fields.push('dipendente_id');
				values.push(null);
			} else if (orderColumns.includes('personale_id')) {
				fields.push('personale_id');
				values.push(null);
			}
			if (orderColumns.includes('prezzo_unitario')) {
				fields.push('prezzo_unitario');
				values.push(unitPrice);
			}
			if (orderColumns.includes('totale')) {
				fields.push('totale');
				values.push((Math.round(unitPrice * 100) * quantity) / 100);
			}
			if (orderColumns.includes('stato')) {
				fields.push('stato');
				values.push('in_attesa');
			}
			for (const [field, value] of Object.entries({
				riferimento_ordine: groupId,
				cliente_nome: customerName,
				metodo_pagamento: paymentMethod,
			})) {
				if (orderColumns.includes(field)) {
					fields.push(field);
					values.push(value);
				}
			}
			if (!orderColumns.includes('totale') && !orderColumns.includes('prezzo_unitario')) {
				throw new Error('La tabella ordini non prevede un campo per il prezzo.');
			}
			await connection.query(
				`INSERT INTO ordini (${fields.map((field) => `\`${field}\``).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
				values,
			);
		}

		await connection.commit();
		response.status(201).json({ riferimento: groupId, totale: totalCents / 100, message: 'Ordine inviato.' });
	} catch (error) {
		await connection.rollback();
		console.error('Errore durante la registrazione dell’ordine self-service:', error.message);
		response.status(500).json({ error: 'Impossibile inviare l’ordine.' });
	} finally {
		connection.release();
	}
});

app.use(express.static(path.join(__dirname, 'public')));

async function initializeDatabase() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS prodotti (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			nome VARCHAR(150) NOT NULL,
			descrizione TEXT NULL,
			prezzo DECIMAL(10, 2) NOT NULL,
			immagine_url VARCHAR(2048) NULL,
			disponibilita BOOLEAN NOT NULL DEFAULT TRUE,
			PRIMARY KEY (id),
			CONSTRAINT chk_prodotti_prezzo CHECK (prezzo >= 0)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS dipendenti (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			nome VARCHAR(100) NOT NULL,
			cognome VARCHAR(100) NOT NULL,
			ruolo VARCHAR(100) NOT NULL,
			email VARCHAR(255) NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_dipendenti_email (email)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
	`);

	await pool.query(`
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
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
	`);

	const orderColumns = await getOrderColumns();
	const [productColumns] = await pool.query('SHOW COLUMNS FROM prodotti');
	if (!productColumns.some((column) => column.Field === 'immagine_url')) {
		await pool.query('ALTER TABLE prodotti ADD COLUMN immagine_url VARCHAR(2048) NULL');
	}
	if (!orderColumns.includes('stato')) {
		await pool.query('ALTER TABLE ordini ADD COLUMN stato VARCHAR(30) NULL DEFAULT NULL');
		await pool.query("UPDATE ordini SET stato = 'registrato' WHERE stato IS NULL");
		await pool.query("ALTER TABLE ordini MODIFY COLUMN stato VARCHAR(30) NOT NULL DEFAULT 'in_attesa'");
	}
	const [orderColumnRows] = await pool.query('SHOW COLUMNS FROM ordini');
	const orderFields = orderColumnRows.map((column) => column.Field);
	const employeeColumn = orderFields.includes('dipendente_id') ? 'dipendente_id' : 'personale_id';
	const employeeDefinition = orderColumnRows.find((column) => column.Field === employeeColumn);
	if (employeeDefinition && employeeDefinition.Null === 'NO') {
		await pool.query(`ALTER TABLE ordini MODIFY COLUMN \`${employeeColumn}\` ${employeeDefinition.Type} NULL`);
	}
	if (!orderFields.includes('riferimento_ordine')) {
		await pool.query('ALTER TABLE ordini ADD COLUMN riferimento_ordine CHAR(36) NULL');
	}
	if (!orderFields.includes('cliente_nome')) {
		await pool.query('ALTER TABLE ordini ADD COLUMN cliente_nome VARCHAR(100) NULL');
	}
	if (!orderFields.includes('metodo_pagamento')) {
		await pool.query('ALTER TABLE ordini ADD COLUMN metodo_pagamento VARCHAR(20) NULL');
	}

	await seedDatabase();
}

async function seedDatabase() {
	const [prodottiRows] = await pool.query('SELECT COUNT(*) AS totale FROM prodotti');
	if (prodottiRows[0].totale === 0) {
		await pool.query(`
			INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita) VALUES
				('Caffè espresso', 'Espresso intenso e aromatico, ideale a qualsiasi ora della giornata.', 2.50, TRUE),
				('Cappuccino', 'Caffè con schiuma di latte e cacao in polvere.', 3.20, TRUE),
				('Croissant al burro', 'Pasticceria fresca e croccante, perfetta per la colazione.', 2.80, TRUE),
				('Spritz', 'Aperitivo leggero e rinfrescante, servito con ghiaccio.', 5.90, TRUE),
				('Panino al prosciutto', 'Panino con prosciutto cotto, formaggio e verdure.', 7.50, TRUE),
				('Acqua frizzante', 'Acqua naturale frizzante da 500 ml.', 2.20, TRUE)
		`);
	}
	const additionalProducts = [
		['Tè caldo alla pesca', 'Tè caldo profumato alla pesca, servito in tazza.', 3.00],
		['Spremuta d’arancia', 'Spremuta fresca preparata al momento.', 3.80],
		['Toast prosciutto e formaggio', 'Toast caldo con prosciutto cotto e formaggio filante.', 5.50],
		['Muffin al cioccolato', 'Muffin morbido con gocce di cioccolato.', 3.00],
	];
	for (const [name, description, price] of additionalProducts) {
		await pool.query(
			`INSERT INTO prodotti (nome, descrizione, prezzo, disponibilita)
			 SELECT ?, ?, ?, TRUE FROM DUAL
			 WHERE NOT EXISTS (SELECT 1 FROM prodotti WHERE nome = ?)`,
			[name, description, price, name],
		);
	}

	const personalTableNames = ['personale', 'dipendenti'];
	for (const tableName of personalTableNames) {
		const tableExists = await pool.query('SHOW TABLES LIKE ?', [tableName]).then(([rows]) => rows.length > 0);
		if (!tableExists) continue;
		const [tableRows] = await pool.query(`SELECT COUNT(*) AS totale FROM \`${tableName}\``);
		if (tableRows[0].totale === 0) {
			const columns = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``).then(([rows]) => rows.map((row) => row.Field));
			if (columns.includes('telefono')) {
				await pool.query(`
					INSERT INTO \`${tableName}\` (nome, cognome, ruolo, email, telefono, attivo) VALUES
						('Luca', 'Rossi', 'Barista', 'luca.rossi@barettocafe.it', '+39 347 223 1177', TRUE),
						('Sofia', 'Bianchi', 'Bartender', 'sofia.bianchi@barettocafe.it', '+39 333 445 8899', TRUE),
						('Marco', 'Verdi', 'Cameriere', 'marco.verdi@barettocafe.it', '+39 349 762 1144', TRUE),
						('Elena', 'Neri', 'Manager', 'elena.neri@barettocafe.it', '+39 345 998 2210', TRUE)
				`);
			} else {
				await pool.query(`
					INSERT INTO \`${tableName}\` (nome, cognome, ruolo, email) VALUES
						('Luca', 'Rossi', 'Barista', 'luca.rossi@barettocafe.it'),
						('Sofia', 'Bianchi', 'Bartender', 'sofia.bianchi@barettocafe.it'),
						('Marco', 'Verdi', 'Cameriere', 'marco.verdi@barettocafe.it'),
						('Elena', 'Neri', 'Manager', 'elena.neri@barettocafe.it')
				`);
			}
		}
	}

	const [ordiniRows] = await pool.query('SELECT COUNT(*) AS totale FROM ordini');
	if (ordiniRows[0].totale === 0) {
		const columns = await pool.query('SHOW COLUMNS FROM ordini').then(([rows]) => rows.map((row) => row.Field));
		const employeeIdColumn = columns.includes('dipendente_id') ? 'dipendente_id' : columns.includes('personale_id') ? 'personale_id' : null;
		if (employeeIdColumn) {
			const employeeTable = columns.includes('dipendente_id') ? 'dipendenti' : 'personale';
			const selectEmployee = (email) => columns.includes('dipendente_id')
				? `(SELECT id FROM dipendenti WHERE email = '${email}')`
				: `(SELECT id FROM personale WHERE email = '${email}')`;
			if (columns.includes('totale') && !columns.includes('prezzo_unitario')) {
				await pool.query(`
					INSERT INTO ordini (prodotto_id, ${employeeIdColumn}, quantita, totale) VALUES
						((SELECT id FROM prodotti WHERE nome = 'Cappuccino'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'luca.rossi@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'luca.rossi@barettocafe.it')`}, 2, 6.40),
						((SELECT id FROM prodotti WHERE nome = 'Panino al prosciutto'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'marco.verdi@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'marco.verdi@barettocafe.it')`}, 1, 7.50),
						((SELECT id FROM prodotti WHERE nome = 'Spritz'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'sofia.bianchi@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'sofia.bianchi@barettocafe.it')`}, 3, 17.70),
						((SELECT id FROM prodotti WHERE nome = 'Croissant al burro'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'elena.neri@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'elena.neri@barettocafe.it')`}, 4, 11.20)
				`);
			} else if (columns.includes('prezzo_unitario')) {
				await pool.query(`
					INSERT INTO ordini (prodotto_id, ${employeeIdColumn}, quantita, prezzo_unitario, stato, note) VALUES
						((SELECT id FROM prodotti WHERE nome = 'Cappuccino'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'luca.rossi@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'luca.rossi@barettocafe.it')`}, 2, 3.20, 'completato', 'Da asporto, senza zucchero.'),
						((SELECT id FROM prodotti WHERE nome = 'Panino al prosciutto'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'marco.verdi@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'marco.verdi@barettocafe.it')`}, 1, 7.50, 'in_preparazione', 'Con patatine aggiuntive.'),
						((SELECT id FROM prodotti WHERE nome = 'Spritz'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'sofia.bianchi@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'sofia.bianchi@barettocafe.it')`}, 3, 5.90, 'in_attesa', 'Due con ghiaccio e un senza ghiaccio.'),
						((SELECT id FROM prodotti WHERE nome = 'Croissant al burro'), ${employeeIdColumn === 'dipendente_id' ? `(SELECT id FROM dipendenti WHERE email = 'elena.neri@barettocafe.it')` : `(SELECT id FROM personale WHERE email = 'elena.neri@barettocafe.it')`}, 4, 2.80, 'completato', 'Per la colazione del personale.')
				`);
			}
		}
	}
}

async function startServer() {
	await initializeDatabase();

	const port = Number(process.env.PORT || 3000);
	const host = process.env.HOST || '0.0.0.0';

	return new Promise((resolve, reject) => {
		const server = app.listen(port, host, () => {
			console.log(`Server Express in ascolto sulla porta ${port}.`);
			resolve(server);
		});

		server.once('error', reject);
	});
}

if (require.main === module) {
	startServer()
		.then((server) => {
			const shutdown = () => {
				server.close(() => {
					pool.end().catch((error) => {
						console.error('Errore durante la chiusura del database:', error.message);
					});
				});
			};

			process.once('SIGINT', shutdown);
			process.once('SIGTERM', shutdown);
		})
		.catch(async (error) => {
			console.error('Impossibile avviare il server:', error.message);
			await pool.end();
			process.exitCode = 1;
		});
}

module.exports = { app, pool, initializeDatabase, startServer };