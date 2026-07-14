# Worker codici sconto — Ramacciato Vintage

Backend sicuro che valida i codici sconto e crea/incassa gli ordini PayPal
lato server. I prezzi vengono riletti dai cataloghi pubblici del sito, quindi
gli importi inviati dal browser non sono manipolabili.

## Come funziona lo sconto
Ogni codice sconta il **5% solo sugli articoli della categoria** vinta al
"Gira il vinile":

| Codice      | Categoria      |
|-------------|----------------|
| RV-GAME5    | videogiochi    |
| RV-TECH5    | elettronica    |
| RV-MUSIC5   | musica         |
| RV-LIBRI5   | libri          |
| RV-OGG5     | oggetti        |
| RV-CARD5    | trading        |
| RV-DVD5     | dvd            |

Per aggiungere/togliere codici: modifica la tabella `CODES` in `worker.js` e ripubblica.

---

## 1. Credenziali PayPal (REST)
1. Vai su https://developer.paypal.com → **Apps & Credentials**
2. In alto scegli **Live** (o **Sandbox** per i test).
3. **Create App** → nome "Ramacciato Sconti" → Create.
4. Copia **Client ID** e **Secret**.

## 2. Deploy del Worker (via dashboard, senza installare nulla)
1. Cloudflare → **Compute (Workers)** → **Create** → **Create Worker**.
2. Nome: `ramacciato-sconti` → **Deploy**.
3. **Edit code** → incolla tutto il contenuto di `worker.js` → **Deploy**.
4. **Settings → Variables and Secrets** → aggiungi:
   - `PAYPAL_CLIENT_ID` (tipo *Secret*) = il Client ID
   - `PAYPAL_SECRET` (tipo *Secret*) = il Secret
   - `PAYPAL_ENV` (tipo *Text*) = `live` (o `sandbox` per i test)
5. **Deploy** di nuovo per applicare le variabili.
6. Copia l'URL del Worker, es. `https://ramacciato-sconti.<tuo-subdominio>.workers.dev`

### (Alternativa da terminale)
```
cd worker
npx wrangler login
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_SECRET
npx wrangler deploy
```

## 3. Collega il sito
In `checkout.html`, dentro `CONFIG`, imposta:
```js
worker_url: 'https://ramacciato-sconti.<tuo-subdominio>.workers.dev'
```
(faccio io il wiring del checkout una volta che hai l'URL)

## 4. Test
- Prima con `PAYPAL_ENV = sandbox` e credenziali sandbox + un account buyer sandbox.
- Verifica che il totale scenda del 5% sugli articoli giusti.
- Poi passa a `live`.

## Endpoint
- `POST /quote` → `{subtotal, discount, shipping, total, code, categoria}` (anteprima sconto)
- `POST /create-order` → `{id}` (order id PayPal)
- `POST /capture-order` → esito capture
