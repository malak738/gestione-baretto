'use strict';

const refreshInterval = 10000;
const orderStates = {
	in_attesa: { label: 'In attesa', className: 'waiting', progress: 'In coda', value: 33 },
	in_preparazione: { label: 'In preparazione', className: 'preparing', progress: 'In lavorazione', value: 66 },
	completato: { label: 'Completato', className: 'completed', progress: 'Pronto', value: 100 },
	registrato: { label: 'Registrato', className: 'unknown', progress: 'In attesa di presa in carico', value: 0 },
};
let loading = false;

function formatState(rawState) {
	const normalized = String(rawState || 'registrato').toLowerCase();
	return orderStates[normalized] || {
		label: normalized.replaceAll('_', ' '),
		className: 'unknown',
		progress: 'Stato ordine',
		value: 0,
	};
}

function makeOrderRow(order) {
	const state = formatState(order.stato);
	const row = document.createElement('article');
	row.className = 'order-row';

	const primary = document.createElement('div');
	primary.className = 'order-primary';
	const number = document.createElement('span');
	number.className = 'order-number';
	number.textContent = `#${order.id}`;
	const details = document.createElement('div');
	details.className = 'order-details';
	const product = document.createElement('p');
	product.className = 'order-product';
	product.textContent = order.prodotto;
	const quantity = document.createElement('p');
	quantity.className = 'order-quantity';
	quantity.textContent = `Quantità: ${order.quantita}`;
	details.append(product, quantity);
	primary.append(number, details);

	const progress = document.createElement('div');
	progress.className = 'order-progress';
	const track = document.createElement('div');
	track.className = 'progress-track';
	track.setAttribute('role', 'progressbar');
	track.setAttribute('aria-label', `Avanzamento ordine ${order.id}: ${state.label}`);
	track.setAttribute('aria-valuemin', '0');
	track.setAttribute('aria-valuemax', '100');
	track.setAttribute('aria-valuenow', String(state.value));
	const fill = document.createElement('div');
	fill.className = `progress-fill ${state.className}`;
	track.append(fill);
	const progressLabel = document.createElement('div');
	progressLabel.className = 'order-progress-label';
	progressLabel.textContent = state.progress;
	progress.append(track, progressLabel);

	const badge = document.createElement('span');
	badge.className = `status-badge ${state.className}`;
	badge.textContent = state.label;
	row.append(primary, progress, badge);
	return row;
}

function renderOrders(orders) {
	const list = document.querySelector('#orders-list');
	const counts = { in_attesa: 0, in_preparazione: 0, completato: 0 };
	for (const order of orders) {
		const state = String(order.stato || '').toLowerCase();
		if (Object.hasOwn(counts, state)) counts[state] += 1;
	}
	document.querySelector('#waiting-count').textContent = counts.in_attesa;
	document.querySelector('#preparing-count').textContent = counts.in_preparazione;
	document.querySelector('#completed-count').textContent = counts.completato;
	list.replaceChildren();
	if (!orders.length) {
		const message = document.createElement('p');
		message.className = 'empty-message';
		message.textContent = 'Nessun ordine registrato.';
		list.append(message);
		return;
	}
	list.append(...orders.map(makeOrderRow));
}

async function loadOrders() {
	if (loading) return;
	loading = true;
	const errorMessage = document.querySelector('#error-message');
	const refreshButton = document.querySelector('#refresh-button');
	refreshButton.disabled = true;
	try {
		const response = await fetch('/api/orders/status', { headers: { Accept: 'application/json' } });
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Impossibile caricare lo stato degli ordini.');
		renderOrders(data.ordini);
		document.querySelector('#live-indicator').classList.remove('offline');
		document.querySelector('#update-label').textContent = `Aggiornato alle ${new Intl.DateTimeFormat('it-IT', { timeStyle: 'short' }).format(new Date())}`;
		errorMessage.hidden = true;
	} catch (error) {
		document.querySelector('#live-indicator').classList.add('offline');
		document.querySelector('#update-label').textContent = 'Connessione non disponibile';
		errorMessage.textContent = error.message;
		errorMessage.hidden = false;
	} finally {
		refreshButton.disabled = false;
		loading = false;
	}
}

document.querySelector('#refresh-button').addEventListener('click', loadOrders);
loadOrders();
window.setInterval(loadOrders, refreshInterval);
