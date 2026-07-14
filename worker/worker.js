/* ═══════════════════════════════════════════════════════════════
   RAMACCIATO VINTAGE — Worker codici sconto + PayPal (server-side)
   ---------------------------------------------------------------
   Endpoint:
     POST /quote          → { subtotal, discount, shipping, total, code, categoria }
     POST /create-order   → { id }  (order id PayPal, per i Buttons)
     POST /capture-order  → { status, id, ... }

   Secret da impostare in Cloudflare (Settings → Variables):
     PAYPAL_CLIENT_ID   (REST app — LIVE o SANDBOX)
     PAYPAL_SECRET
   Variabili normali (facoltative):
     PAYPAL_ENV   = "live"  oppure  "sandbox"   (default: live)

   I prezzi e le categorie vengono RILETTI dai cataloghi pubblici del
   sito: il browser invia solo id + quantità, non i prezzi. Così un
   utente non può manomettere gli importi.
═══════════════════════════════════════════════════════════════ */

const SITE_BASE = 'https://ramacciatovintage.it';
const CAT_FILES = ['musica','dvd','videogiochi','oggetti','elettronica','libri','trading'];

/* Spedizione — deve rispecchiare CONFIG in checkout.html */
const SHIPPING = {
  italia: 5.90,
  europa: 12.90,
  pickup: 3.90
};
const FREE_ABOVE = 50.00;

/* Codici sconto — 5% SOLO sugli articoli della categoria indicata.
   Vivono qui nel Worker, NON nel sito: non sono nel sorgente pubblico.
   Per aggiungere/togliere codici modifica questa tabella e ripubblica. */
const CODES = {
  'RV-GAME5':  { pct: 5, cat: 'videogiochi' },
  'RV-TECH5':  { pct: 5, cat: 'elettronica' },
  'RV-MUSIC5': { pct: 5, cat: 'musica' },
  'RV-LIBRI5': { pct: 5, cat: 'libri' },
  'RV-OGG5':   { pct: 5, cat: 'oggetti' },
  'RV-CARD5':  { pct: 5, cat: 'trading' },
  'RV-DVD5':   { pct: 5, cat: 'dvd' }
};

/* Origini autorizzate a chiamare il Worker */
const ALLOWED_ORIGINS = [
  'https://ramacciatovintage.it',
  'https://www.ramacciatovintage.it'
];

/* ─────────────────────────────────────────────────────────── */

function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

function corsHeaders(origin){
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status, origin){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
  });
}

/* Legge tutti i cataloghi pubblici e costruisce mappa id → prodotto */
let CATALOG_CACHE = null;
let CATALOG_TS = 0;
async function loadCatalog(){
  const now = Date.now();
  if (CATALOG_CACHE && (now - CATALOG_TS) < 60000) return CATALOG_CACHE; // cache 60s
  const map = {};
  await Promise.all(CAT_FILES.map(async (c) => {
    try {
      const r = await fetch(SITE_BASE + '/catalogo-' + c + '.json', { cf: { cacheTtl: 60 } });
      if (!r.ok) return;
      const arr = await r.json();
      if (Array.isArray(arr)) {
        for (const p of arr) {
          if (p && p.id != null) map[String(p.id)] = p;
        }
      }
    } catch (e) { /* ignora file mancanti/vuoti */ }
  }));
  CATALOG_CACHE = map;
  CATALOG_TS = now;
  return map;
}

/* Calcola importi autorevoli a partire da id+qty (prezzi dal catalogo) */
async function computeTotals(body){
  const items = Array.isArray(body.items) ? body.items : [];
  const zona = SHIPPING[body.zona] != null ? body.zona : 'italia';
  const codeRaw = (body.code || '').trim().toUpperCase();

  const catalog = await loadCatalog();

  let subtotal = 0;
  const lines = [];
  for (const it of items) {
    const p = catalog[String(it.id)];
    if (!p) continue;                 // id inesistente → ignorato
    if (p.sold) continue;             // già venduto → ignorato
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const price = Number(p.price) || 0;
    const lineTotal = round2(price * qty);
    subtotal = round2(subtotal + lineTotal);
    lines.push({ id: p.id, name: p.name || 'Articolo', cat: p.cat, price: price, qty: qty, lineTotal: lineTotal });
  }

  /* Sconto: 5% solo sugli articoli della categoria del codice */
  let discount = 0, categoria = null, codeValid = false;
  if (codeRaw && CODES[codeRaw]) {
    const rule = CODES[codeRaw];
    categoria = rule.cat;
    let baseCat = 0;
    for (const l of lines) if (l.cat === rule.cat) baseCat = round2(baseCat + l.lineTotal);
    discount = round2(baseCat * rule.pct / 100);
    codeValid = discount > 0; // valido solo se c'è almeno un articolo di quella categoria
  }

  let shipping = SHIPPING[zona];
  if (subtotal >= FREE_ABOVE) shipping = 0;

  const total = round2(subtotal + shipping - discount);
  return { lines, subtotal, discount, shipping, total, zona,
           code: codeValid ? codeRaw : null, categoria: codeValid ? categoria : null };
}

/* ── PayPal REST ─────────────────────────────────────────── */
function ppBase(env){
  return (env.PAYPAL_ENV === 'sandbox')
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}
async function ppToken(env){
  const auth = btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_SECRET);
  const r = await fetch(ppBase(env) + '/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('PayPal token error');
  return d.access_token;
}

async function createOrder(env, t){
  const token = await ppToken(env);
  const items = t.lines.map(l => ({
    name: String(l.name).substring(0, 127),
    quantity: String(l.qty),
    unit_amount: { currency_code: 'EUR', value: l.price.toFixed(2) },
    category: 'PHYSICAL_GOODS'
  }));
  const breakdown = {
    item_total: { currency_code: 'EUR', value: t.subtotal.toFixed(2) },
    shipping:   { currency_code: 'EUR', value: t.shipping.toFixed(2) }
  };
  if (t.discount > 0) breakdown.discount = { currency_code: 'EUR', value: t.discount.toFixed(2) };

  const r = await fetch(ppBase(env) + '/v2/checkout/orders', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'Ramacciato Vintage — Ordine',
        amount: {
          currency_code: 'EUR',
          value: t.total.toFixed(2),
          breakdown: breakdown
        },
        items: items
      }],
      application_context: { brand_name: 'Ramacciato Vintage', locale: 'it-IT', user_action: 'PAY_NOW' }
    })
  });
  const d = await r.json();
  if (!d.id) throw new Error('PayPal create error: ' + JSON.stringify(d));
  return d.id;
}

async function captureOrder(env, orderID){
  const token = await ppToken(env);
  const r = await fetch(ppBase(env) + '/v2/checkout/orders/' + encodeURIComponent(orderID) + '/capture', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  });
  return await r.json();
}

/* ── Router ──────────────────────────────────────────────── */
export default {
  async fetch(request, env){
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST')
      return json({ error: 'method' }, 405, origin);

    let body = {};
    try { body = await request.json(); } catch(e){ return json({ error: 'bad json' }, 400, origin); }

    try {
      if (url.pathname === '/quote') {
        const t = await computeTotals(body);
        return json({ subtotal: t.subtotal, discount: t.discount, shipping: t.shipping,
                      total: t.total, code: t.code, categoria: t.categoria }, 200, origin);
      }
      if (url.pathname === '/create-order') {
        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET)
          return json({ error: 'PayPal non configurato' }, 500, origin);
        const t = await computeTotals(body);
        if (!t.lines.length) return json({ error: 'carrello vuoto' }, 400, origin);
        const id = await createOrder(env, t);
        return json({ id: id, total: t.total, discount: t.discount }, 200, origin);
      }
      if (url.pathname === '/capture-order') {
        if (!body.orderID) return json({ error: 'orderID mancante' }, 400, origin);
        const d = await captureOrder(env, body.orderID);
        return json(d, 200, origin);
      }
      return json({ error: 'not found' }, 404, origin);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, origin);
    }
  }
};
