'use strict';

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const dateTime = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' });
const cachedProducts = new Map();
let toastTimer;

function showToast(message, isError = false) {
	const toast = document.querySelector('#toast');
	toast.textContent = message;
	toast.classList.toggle('error', isError);
	toast.classList.add('visible');
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3500);
}

async function requestJson(url, options = {}) {
	const response = await fetch(url, {
		...options,
		headers: { 'Content-Type': 'application/json', ...options.headers },
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || 'Si è verificato un errore.');
	return data;
}

function addCell(row, value, className) {
	const cell = document.createElement('td');
	if (className) cell.className = className;
	cell.textContent = value ?? '';
	row.append(cell);
	return cell;
}

function showEmptyRow(body, columnCount, message) {
	const row = document.createElement('tr');
	const cell = document.createElement('td');
	cell.className = 'empty-row';
	cell.colSpan = columnCount;
	cell.textContent = message;
	row.append(cell);
	body.replaceChildren(row);
}

function renderProducts(products) {
	const body = document.querySelector('#products-table');
	body.replaceChildren();
	cachedProducts.clear();
	document.querySelector('#order-product').replaceChildren(new Option('Seleziona un prodotto', ''));
	for (const product of products) {
		cachedProducts.set(Number(product.id), Number(product.prezzo));
		const option = new Option(`${product.nome} · ${euro.format(Number(product.prezzo))}`, product.id);
		if (!product.disponibile) option.disabled = true;
		document.querySelector('#order-product').add(option);

		const row = document.createElement('tr');
		const name = addCell(row, product.nome, 'product-name');
		if (product.descrizione) {
			const description = document.createElement('span');
			description.className = 'product-description';
			description.textContent = product.descrizione;
			name.append(description);
		}
		addCell(row, euro.format(Number(product.prezzo)), 'price-cell');
		const availability = document.createElement('span');
		availability.className = `status-pill${product.disponibile ? '' : ' unavailable'}`;
		availability.textContent = product.disponibile ? 'Disponibile' : 'Non disponibile';
		const availabilityCell = document.createElement('td');
		availabilityCell.append(availability);
		row.append(availabilityCell);
		body.append(row);
	}
	if (!products.length) showEmptyRow(body, 3, 'Nessun prodotto ancora inserito.');
	document.querySelector('#products-count').textContent = products.length;
	document.querySelector('#products-tab-count').textContent = products.length;
	updateOrderTotal();
}

function renderEmployees(employees) {
	const body = document.querySelector('#employees-table');
	body.replaceChildren();
	const select = document.querySelector('#order-employee');
	select.replaceChildren(new Option('Seleziona una persona', ''));
	for (const employee of employees) {
		select.add(new Option(`${employee.nome} ${employee.cognome} · ${employee.ruolo}`, employee.id));
		const row = document.createElement('tr');
		addCell(row, `${employee.nome} ${employee.cognome}`, 'product-name');
		addCell(row, employee.ruolo);
		addCell(row, employee.email);
		body.append(row);
	}
	if (!employees.length) showEmptyRow(body, 3, 'Nessun membro del personale ancora inserito.');
	document.querySelector('#employees-count').textContent = employees.length;
	document.querySelector('#employees-tab-count').textContent = employees.length;
}

function renderOrders(orders) {
	const body = document.querySelector('#orders-table');
	body.replaceChildren();
	for (const order of orders) {
		const row = document.createElement('tr');
		addCell(row, `#${order.id}`, 'product-name');
		addCell(row, order.prodotto);
		addCell(row, order.dipendente);
		addCell(row, order.quantita);
		addCell(row, euro.format(Number(order.totale)), 'price-cell');
		const status = document.createElement('span');
		status.className = `status-pill${order.stato === 'in_attesa' ? ' pending' : ''}`;
		status.textContent = order.stato.replaceAll('_', ' ');
		const statusCell = document.createElement('td');
		statusCell.append(status);
		if (order.data_ordine) {
			const date = document.createElement('span');
			date.className = 'product-description';
			date.textContent = dateTime.format(new Date(order.data_ordine));
			statusCell.append(date);
		}
		row.append(statusCell);
		body.append(row);
	}
	if (!orders.length) showEmptyRow(body, 6, 'Nessun ordine ancora registrato.');
	document.querySelector('#orders-count').textContent = orders.length;
	document.querySelector('#orders-tab-count').textContent = orders.length;
}

async function loadData() {
	const [data, health] = await Promise.all([
		requestJson('/api/admin/data'),
		requestJson('/api/health'),
	]);
	renderProducts(data.prodotti);
	renderEmployees(data.dipendenti);
	renderOrders(data.ordini);
	document.querySelector('#connection-label').textContent = health.database === 'connected' ? 'connesso' : 'disconnesso';
	document.querySelector('.online-dot').classList.toggle('offline', health.database !== 'connected');
}

function updateOrderTotal() {
	const productId = Number(document.querySelector('#order-product').value);
	const quantity = Number(document.querySelector('#order-form [name="quantita"]').value);
	const price = cachedProducts.get(productId);
	const display = document.querySelector('#order-total');
	display.textContent = price === undefined
		? 'Seleziona un prodotto'
		: euro.format(Math.round(price * quantity * 100) / 100);
}

async function submitForm(form, endpoint, buildPayload, successMessage) {
	const button = form.querySelector('button[type="submit"]');
	button.disabled = true;
	form.classList.add('is-loading');
	try {
		const payload = buildPayload(new FormData(form));
		const result = await requestJson(endpoint, { method: 'POST', body: JSON.stringify(payload) });
		form.reset();
		if (form.id === 'product-form') form.elements.disponibile.checked = true;
		if (form.id === 'order-form') form.elements.quantita.value = '1';
		showToast(result.message || successMessage);
		await loadData();
	} catch (error) {
		showToast(error.message, true);
	} finally {
		button.disabled = false;
		form.classList.remove('is-loading');
		updateOrderTotal();
	}
}

document.querySelector('#product-form').addEventListener('submit', (event) => {
	event.preventDefault();
	submitForm(event.currentTarget, '/api/admin/prodotti', (form) => ({
		nome: form.get('nome'),
		descrizione: form.get('descrizione'),
		immagine_url: form.get('immagine_url'),
		prezzo: Number(form.get('prezzo')),
		disponibile: form.get('disponibile') === 'on',
	}), 'Prodotto inserito.');
});

document.querySelector('#employee-form').addEventListener('submit', (event) => {
	event.preventDefault();
	submitForm(event.currentTarget, '/api/admin/dipendenti', (form) => ({
		nome: form.get('nome'),
		cognome: form.get('cognome'),
		ruolo: form.get('ruolo'),
		email: form.get('email'),
		telefono: form.get('telefono'),
	}), 'Membro del team aggiunto.');
});

document.querySelector('#order-form').addEventListener('submit', (event) => {
	event.preventDefault();
	submitForm(event.currentTarget, '/api/admin/ordini', (form) => ({
		prodotto_id: Number(form.get('prodotto_id')),
		dipendente_id: Number(form.get('dipendente_id')),
		quantita: Number(form.get('quantita')),
	}), 'Ordine registrato.');
});

document.querySelector('#order-product').addEventListener('change', updateOrderTotal);
document.querySelector('#order-form [name="quantita"]').addEventListener('input', updateOrderTotal);
document.querySelector('#refresh-button').addEventListener('click', async () => {
	try {
		await loadData();
		showToast('Dati aggiornati.');
	} catch (error) {
		showToast(error.message, true);
	}
});

document.querySelectorAll('.records-tab').forEach((tab) => {
	tab.addEventListener('click', () => {
		document.querySelectorAll('.records-tab').forEach((item) => {
			const selected = item === tab;
			item.classList.toggle('active', selected);
			item.setAttribute('aria-selected', String(selected));
		});
		document.querySelectorAll('.table-wrap').forEach((panel) => {
			panel.hidden = panel.id !== tab.dataset.tab;
		});
	});
});

loadData().catch((error) => {
	document.querySelector('#connection-label').textContent = 'non disponibile';
	document.querySelector('.online-dot').classList.add('offline');
	showToast(error.message, true);
});
