# Gestione Baretto

Applicazione per la gestione di un bar. Il progetto usa Node.js, Express e MySQL 8; Docker Compose avvia il database e il server Express espone i file statici e un endpoint di stato.

## Requisiti

- Node.js 20.6 o successivo e npm
- Docker con Docker Compose v2

## Configurazione

Installa le dipendenze:

```sh
npm ci
```

Crea un file `.env` nella cartella principale del progetto con i parametri di connessione:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=utente
DB_PASSWORD=password
DB_NAME=baretto
PORT=3000
```

`PORT` è facoltativa e predefinita a `3000`. Gli altri valori corrispondono alla configurazione di sviluppo in `docker-compose.yml`. Se modifichi utente o password, aggiorna anche le variabili `MYSQL_USER` e `MYSQL_PASSWORD` del servizio MySQL. Non condividere né aggiungere al controllo versione il file `.env`.

## Avvio

Avvia il database e l'applicazione:

```sh
npm run dev
```

All'avvio vengono create o verificate le tabelle `prodotti`, `personale` e `ordini`; quelle già esistenti non vengono svuotate. Se sono vuote, il sistema inserisce un set di dati di esempio realistici (prodotti, personale e ordini) per avere subito un database popolato. Il server resta in ascolto su `http://localhost:3000` (o sulla porta impostata in `PORT`). La cartella `public` è servita alla radice e `GET /api/health` verifica anche la connessione al database:

```sh
curl http://localhost:3000/api/health
```

La risposta attesa è `{"status":"ok","database":"connected"}`. Ferma Express con `Ctrl+C`, poi, se necessario, ferma il database senza eliminare i dati:

```sh
docker compose down
```

I dati MySQL persistono nel
 volume Docker `mysql_data`. `docker compose down -v` elimina anche il volume e i dati.

Per controllare direttamente le tabelle del database:

```bash
docker exec -it mysql-dev mysql -uutente -ppassword -Dbaretto
```

## Stato dell'applicazione

La pagina `http://localhost:3000` contiene il pannello amministrativo per inserire prodotti, dipendenti e ordini e consultare i record presenti. Il menu self-service per i clienti è disponibile su `http://localhost:3000/menu.html`: mostra i prodotti disponibili, permette di comporre un carrello e confermare l'ordine scegliendo contanti o carta al ritiro. I pagamenti non vengono elaborati online. Nel pannello, ogni prodotto può avere un URL immagine facoltativo.

Il collegamento **Stato ordini** apre una pagina dedicata all'avanzamento, aggiornata automaticamente ogni 10 secondi; è disponibile anche direttamente all'indirizzo `http://localhost:3000/ordini.html`. Il pannello e le pagine ordini non richiedono autenticazione: usali solo in un ambiente fidato e non esporli pubblicamente senza prima aggiungere un sistema di accesso.