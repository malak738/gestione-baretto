'use strict';

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const maxQuantity = 50;
const fallbackImages = {
	te: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Hot_tea._8_minutes_fruit_infusion.jpg/960px-Hot_tea._8_minutes_fruit_infusion.jpg',
	caffetteria: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',
	cucina: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80',
	aperitivo: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80',
};
const productImages = [
	{ match: /\b(?:te|tisana|infuso)\b/, image: fallbackImages.te },
	{ match: /\b(?:cappuccino|latte macchiato)\b/, image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=80' },
	{ match: /\b(?:espresso|caffe)\b/, image: fallbackImages.caffetteria },
	{ match: /\bcroissant\b/, image: fallbackImages.cucina },
	{ match: /\b(?:panino|sandwich|toast)\b/, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80' },
	{ match: /\bmuffin\b/, image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=900&q=80' },
	{ match: /\b(?:spremuta|succo)\b/, image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=80' },
	{ match: /\b(?:spritz|cocktail)\b/, image: fallbackImages.aperitivo },
	{ match: /\bacqua\b.{0,40}\bfrizzante\b|\bfrizzante\b.{0,40}\bacqua\b/, image: 'https://d3w0qkmdic0cyn.cloudfront.net/assets_thumbnails/prodotti/acque-minerali/san-benedetto/standard/standard-benedicta/image-thumb__5914__product_tab_showcase_item/%402x_Benedicta_Frizzante_1.5L_2023.png', fit: 'contain' },
	{ match: /\b(?:acqua|water)\b/, image: 'https://images.unsplash.com/photo-1534215754734-18e55d13e346?auto=format&fit=crop&w=900&q=80' },
];
const quantities = new Map();
let products = [];
let selectedCategory = 'tutti';

function normalizedProductText(product) {
	return `${product.nome} ${product.descrizione || ''}`
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

function categoryFor(product) {
	const name = normalizedProductText(product);
	if (/spritz|aperitiv|cocktail|vino|birra/.test(name)) return 'aperitivo';
	if (/\b(?:muffin|toast|panino|croissant)\b/.test(name)) return 'cucina';
	if (/\b(?:te|tisana|infuso|spremuta|succo)\b|caff|espresso|cappucc|latte|macchiato|cioccolat/.test(name)) return 'caffetteria';
	return 'cucina';
}

function displayCategory(category) {
	return { caffetteria: 'Caffetteria', cucina: 'Cucina', aperitivo: 'Aperitivo' }[category];
}

function productImage(product, category) {
	const name = normalizedProductText(product);
	const imageMatch = productImages.find((entry) => entry.match.test(name));
	const productFallback = imageMatch?.image || fallbackImages[category];
	const image = document.createElement('img');
	image.className = 'product-image';
	if (imageMatch?.fit === 'contain') image.classList.add('product-image--contain');
	image.alt = product.nome;
	image.loading = 'lazy';
	image.src = product.immagine_url || productFallback;
	image.addEventListener('error', () => {
		image.onerror = null;
		image.src = productFallback;
	}, { once: true });
	return image;
}

function imageCredit(product) {
	if (product.immagine_url) return null;
	if (/\b(?:te|tisana|infuso)\b/.test(normalizedProductText(product))) {
		return {
			label: 'Foto: Shixart1985 · CC BY 2.0',
			url: 'https://commons.wikimedia.org/wiki/File:Hot_tea._8_minutes_fruit_infusion.jpg',
		};
	}
	return null;
}

function makeProductCard(product, index) {
	const category = categoryFor(product);
	const card = document.createElement('article');
	card.className = 'product-card';
	card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
	const imageWrap = document.createElement('div');
	imageWrap.className = 'product-image-wrap';
	imageWrap.append(productImage(product, category));
	const credit = imageCredit(product);
	if (credit) {
		const creditLink = document.createElement('a');
		creditLink.className = 'product-image-credit';
		creditLink.href = credit.url;
		creditLink.target = '_blank';
		creditLink.rel = 'noopener noreferrer';
		creditLink.textContent = credit.label;
		imageWrap.append(creditLink);
	}
	const badge = document.createElement('span');
	badge.className = 'product-category';
	badge.textContent = displayCategory(category);
	imageWrap.append(badge);

	const copy = document.createElement('div');
	copy.className = 'product-copy';
	const titleRow = document.createElement('div');
	titleRow.className = 'product-title-row';
	const title = document.createElement('h3');
	title.className = 'product-title';
	title.textContent = product.nome;
	const price = document.createElement('span');
	price.className = 'product-price';
	price.textContent = euro.format(Number(product.prezzo));
	titleRow.append(title, price);
	const description = document.createElement('p');
	description.className = 'product-description';
	description.textContent = product.descrizione || 'Preparato al momento, con cura.';
	const addButton = document.createElement('button');
	addButton.className = 'add-button';
	addButton.type = 'button';
	addButton.dataset.productId = product.id;
	addButton.innerHTML = '<span aria-hidden="true">＋</span> Aggiungi';
	copy.append(titleRow, description, addButton);
	card.append(imageWrap, copy);
	return card;
}

function renderMenu() {
	const grid = document.querySelector('#product-grid');
	const filtered = products.filter((product) => selectedCategory === 'tutti' || categoryFor(product) === selectedCategory);
	grid.replaceChildren(...filtered.map(makeProductCard));
	if (!filtered.length) {
		const empty = document.createElement('p');
		empty.className = 'cart-empty';
		empty.textContent = 'Nessun prodotto in questa categoria.';
		grid.append(empty);
	}
}

function renderCart() {
	const cart = document.querySelector('#cart-items');
	const entries = [...quantities.entries()].filter(([, quantity]) => quantity > 0);
	const itemCount = entries.reduce((total, [, quantity]) => total + quantity, 0);
	const totalCents = entries.reduce((total, [id, quantity]) => {
		const product = products.find((entry) => String(entry.id) === id);
		return total + (product ? Math.round(Number(product.prezzo) * 100) * quantity : 0);
	}, 0);
	document.querySelector('#cart-count').textContent = itemCount;
	document.querySelector('#header-count').textContent = itemCount;
	document.querySelector('#mobile-count').textContent = `${itemCount} ${itemCount === 1 ? 'prodotto' : 'prodotti'}`;
	document.querySelector('#cart-total').textContent = euro.format(totalCents / 100);
	document.querySelector('#mobile-total').textContent = euro.format(totalCents / 100);
	document.querySelector('.checkout-button').disabled = itemCount === 0;
	if (!entries.length) {
		const empty = document.createElement('p');
		empty.className = 'cart-empty';
		empty.innerHTML = 'Il carrello è vuoto.<br>Comincia da qualcosa di buono.';
		cart.replaceChildren(empty);
		return;
	}

	cart.replaceChildren(...entries.map(([id, quantity]) => {
		const product = products.find((entry) => String(entry.id) === id);
		const line = document.createElement('div');
		line.className = 'cart-line';
		const name = document.createElement('span');
		name.className = 'cart-line-name';
		name.textContent = product.nome;
		const linePrice = document.createElement('span');
		linePrice.className = 'cart-line-price';
		linePrice.textContent = euro.format(Math.round(Number(product.prezzo) * 100) * quantity / 100);
		const controls = document.createElement('div');
		controls.className = 'quantity-control';
		controls.setAttribute('aria-label', `Quantità ${product.nome}`);
		for (const [action, label] of [['decrease', 'Diminuisci quantità'], ['increase', 'Aumenta quantità']]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.dataset.action = action;
			button.dataset.productId = id;
			button.setAttribute('aria-label', label);
			button.textContent = action === 'increase' ? '+' : '−';
			controls.append(button);
			if (action === 'decrease') {
				const amount = document.createElement('span');
				amount.textContent = quantity;
				controls.append(amount);
			}
		}
		line.append(name, linePrice, controls);
		return line;
	}));
}

async function loadMenu() {
	const response = await fetch('/api/menu', { headers: { Accept: 'application/json' } });
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || 'Impossibile caricare il menu.');
	products = data.prodotti;
	renderMenu();
	renderCart();
}

document.querySelector('.category-tabs').addEventListener('click', (event) => {
	const button = event.target.closest('[data-category]');
	if (!button) return;
	selectedCategory = button.dataset.category;
	document.querySelectorAll('.category-tab').forEach((tab) => {
		const active = tab === button;
		tab.classList.toggle('active', active);
		tab.setAttribute('aria-pressed', String(active));
	});
	renderMenu();
});

document.querySelector('#product-grid').addEventListener('click', (event) => {
	const button = event.target.closest('[data-product-id]');
	if (!button) return;
	const id = String(button.dataset.productId);
	if ((quantities.get(id) || 0) >= maxQuantity) {
		const feedback = document.querySelector('#order-feedback');
		feedback.classList.add('error');
		feedback.textContent = `Puoi aggiungere al massimo ${maxQuantity} unità per prodotto.`;
		feedback.hidden = false;
		return;
	}
	quantities.set(id, (quantities.get(id) || 0) + 1);
	document.querySelector('#order-feedback').hidden = true;
	renderCart();
});

document.querySelector('#cart-items').addEventListener('click', (event) => {
	const button = event.target.closest('[data-action]');
	if (!button) return;
	const id = String(button.dataset.productId);
	if (button.dataset.action === 'increase' && (quantities.get(id) || 0) >= maxQuantity) return;
	const nextQuantity = (quantities.get(id) || 0) + (button.dataset.action === 'increase' ? 1 : -1);
	if (nextQuantity > 0) quantities.set(id, nextQuantity);
	else quantities.delete(id);
	renderCart();
});

document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const button = form.querySelector('button[type="submit"]');
	const feedback = document.querySelector('#order-feedback');
	const formData = new FormData(form);
	button.disabled = true;
	button.textContent = 'Invio in corso...';
	feedback.hidden = true;
	try {
		const response = await fetch('/api/orders', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				cliente_nome: formData.get('cliente_nome'),
				metodo_pagamento: formData.get('metodo_pagamento'),
				articoli: [...quantities].map(([prodotto_id, quantita]) => ({ prodotto_id: Number(prodotto_id), quantita })),
			}),
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || 'Impossibile inviare l’ordine.');
		quantities.clear();
		form.reset();
		renderCart();
		feedback.classList.remove('error');
		feedback.textContent = `Ordine confermato. Codice ${result.riferimento.slice(0, 8).toUpperCase()}. Puoi pagare al ritiro.`;
		feedback.hidden = false;
	} catch (error) {
		feedback.classList.add('error');
		feedback.textContent = error.message;
		feedback.hidden = false;
	} finally {
		button.innerHTML = 'Conferma ordine <span aria-hidden="true">→</span>';
		button.disabled = quantities.size === 0;
	}
});

loadMenu().catch((error) => {
	const message = document.querySelector('#menu-message');
	message.textContent = error.message;
	message.hidden = false;
});