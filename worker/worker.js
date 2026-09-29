// Ramacciato Vintage - Worker codici sconto + PayPal (server-side)
// Sconto del giorno: ogni giorno e' valida UNA sola categoria (rotazione).

const SITE_BASE = 'https://ramacciatovintage.it';
const CAT_FILES = ['musica','dvd','videogiochi','oggetti','elettronica','libri','trading'];

// Spedizioni: le tariffe si leggono da catalogo.json del sito (impostazioni.spedizione),
// cosi basta cambiare quel file. Questa copia serve solo se il sito non risponde.
const SHIP_FALLBACK = {"paesi": {"IT": "Italia", "AT": "Austria", "BE": "Belgio", "BG": "Bulgaria", "CY": "Cipro", "HR": "Croazia", "DK": "Danimarca", "EE": "Estonia", "FI": "Finlandia", "FR": "Francia", "DE": "Germania", "GR": "Grecia", "IE": "Irlanda", "LV": "Lettonia", "LT": "Lituania", "LU": "Lussemburgo", "MT": "Malta", "NL": "Paesi Bassi", "PL": "Polonia", "PT": "Portogallo", "CZ": "Repubblica Ceca", "RO": "Romania", "SK": "Slovacchia", "SI": "Slovenia", "ES": "Spagna", "SE": "Svezia", "HU": "Ungheria"}, "zone": {"z1": ["AT", "DE", "FR", "SI", "HR", "HU", "NL"], "z2": ["BE", "BG", "CZ", "ES", "LU", "PL"], "z3": ["DK", "PT", "GR", "SK", "RO", "FI", "EE", "LV", "LT", "SE", "IE", "CY", "MT"]}, "metodi": [{"id": "it-inpost", "area": "italia", "corriere": "InPost", "nome": "Locker InPost", "tipo": "punto", "giorni": "1-3 giorni lavorativi", "prezzo": 4.9}, {"id": "it-poste-punto", "area": "italia", "corriere": "Poste Italiane", "nome": "Ufficio postale o Punto Poste", "tipo": "punto", "giorni": "2-4 giorni lavorativi", "prezzo": 5.9}, {"id": "it-brt-punto", "area": "italia", "corriere": "BRT", "nome": "BRT Fermopoint", "tipo": "punto", "giorni": "1-3 giorni lavorativi", "prezzo": 6.9}, {"id": "it-poste-casa", "area": "italia", "corriere": "Poste Italiane", "nome": "Consegna a domicilio", "tipo": "casa", "giorni": "2-4 giorni lavorativi", "prezzo": 6.9}, {"id": "it-brt-casa", "area": "italia", "corriere": "BRT", "nome": "Consegna a domicilio", "tipo": "casa", "giorni": "1-3 giorni lavorativi", "prezzo": 7.9}, {"id": "eu-inpost", "area": "estero", "corriere": "InPost", "nome": "Locker InPost", "tipo": "punto", "giorni": "4-7 giorni lavorativi", "prezzo": 9.9, "paesi": ["FR", "ES", "PT", "PL", "BE", "NL", "LU"]}, {"id": "eu-gls", "area": "estero", "corriere": "GLS", "nome": "Consegna a domicilio", "tipo": "casa", "giorni": "3-6 giorni lavorativi", "prezzo": {"z1": 12.9, "z2": 13.9, "z3": 15.9}}, {"id": "eu-brt", "area": "estero", "corriere": "BRT", "nome": "Consegna a domicilio (rete DPD)", "tipo": "casa", "giorni": "3-6 giorni lavorativi", "prezzo": {"z1": 13.9, "z2": 15.9, "z3": 17.9}}, {"id": "eu-ups", "area": "estero", "corriere": "UPS", "nome": "UPS Standard a domicilio", "tipo": "casa", "giorni": "2-5 giorni lavorativi", "prezzo": {"z1": 15.9, "z2": 16.9, "z3": 18.9}}, {"id": "eu-poste", "area": "estero", "corriere": "Poste Italiane", "nome": "Poste Delivery International", "tipo": "casa", "giorni": "5-10 giorni lavorativi", "prezzo": 25.9}], "gratuita": {"italia": {"sopra": 30.0, "modo": "piu_economica"}, "estero": {"sopra": 100.0, "sconto": 5.9}}};
// Vecchi valori "zona" (pagine checkout rimaste in cache): li traduco nei nuovi metodi
const LEGACY_ZONA = { italia: ['it-poste-casa','IT'], pickup: ['it-inpost','IT'], europa: ['eu-gls','DE'] };

let SHIP_CACHE = null, SHIP_TS = 0;
async function loadShipping(){
  const now = Date.now();
  if (SHIP_CACHE && (now - SHIP_TS) < 60000) return SHIP_CACHE;
  let cfg = null;
  try {
    const r = await fetch(SITE_BASE + '/catalogo.json', { cf: { cacheTtl: 60 } });
    if (r.ok) { const j = await r.json(); cfg = j && j.impostazioni && j.impostazioni.spedizione; }
  } catch (e) {}
  if (!cfg || !Array.isArray(cfg.metodi)) cfg = SHIP_FALLBACK;
  SHIP_CACHE = cfg; SHIP_TS = now;
  return cfg;
}
// Stessa logica del checkout (checkout.html -> calcolaSpedizione)
function zonaDi(cfg, paese){
  if (paese === 'IT') return 'it';
  const z = cfg.zone || {};
  for (const k in z) if ((z[k] || []).indexOf(paese) >= 0) return k;
  return null;
}
function calcolaSpedizione(cfg, metodoId, paese, subtotale){
  const m = (cfg.metodi || []).find(x => x.id === metodoId);
  if (!m) return { errore: 'metodo' };
  const zona = zonaDi(cfg, paese);
  if (!zona) return { errore: 'paese' };
  if (m.area === 'italia' ? paese !== 'IT' : paese === 'IT') return { errore: 'area' };
  if (m.paesi && m.paesi.indexOf(paese) < 0) return { errore: 'paese-metodo' };
  const base = typeof m.prezzo === 'number' ? m.prezzo : (m.prezzo || {})[zona];
  if (base == null) return { errore: 'prezzo' };
  const g = cfg.gratuita || {};
  let sconto = 0;
  if (m.area === 'italia' && g.italia && subtotale >= g.italia.sopra) {
    if (g.italia.modo === 'tutte') sconto = base;
    else sconto = Math.min(...cfg.metodi.filter(x => x.area === 'italia').map(x => Number(x.prezzo)));
  } else if (m.area === 'estero' && g.estero && subtotale >= g.estero.sopra) {
    sconto = Number(g.estero.sconto) || 0;
  }
  sconto = Math.min(base, sconto);
  return { metodo: m, zona: zona, pieno: round2(base), prezzo: round2(base - sconto) };
}

// Codici sconto - 5% SOLO sugli articoli della categoria indicata.
const CODES = {
  'RV-GAME5':  { pct: 5, cat: 'videogiochi' },
  'RV-TECH5':  { pct: 5, cat: 'elettronica' },
  'RV-MUSIC5': { pct: 5, cat: 'musica' },
  'RV-LIBRI5': { pct: 5, cat: 'libri' },
  'RV-OGG5':   { pct: 5, cat: 'oggetti' },
  'RV-CARD5':  { pct: 5, cat: 'trading' },
  'RV-DVD5':   { pct: 5, cat: 'dvd' }
};

// Ordine rotazione "sconto del giorno" (DEVE combaciare con l'ordine CATS in index.html)
const ORDER = ['videogiochi','elettronica','musica','libri','oggetti','trading','dvd'];
// cat -> codice
const CAT_CODE = {};
for (const k in CODES) CAT_CODE[CODES[k].cat] = k;

function todayIndex(){ return Math.floor(Date.now() / 86400000) % ORDER.length; }
function todayCat(){ return ORDER[todayIndex()]; }

const ALLOWED_ORIGINS = [
  'https://ramacciatovintage.it',
  'https://www.ramacciatovintage.it'
];

function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

function corsHeaders(origin){
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

let CATALOG_CACHE = null;
let CATALOG_TS = 0;
async function loadCatalog(){
  const now = Date.now();
  if (CATALOG_CACHE && (now - CATALOG_TS) < 60000) return CATALOG_CACHE;
  const map = {};
  await Promise.all(CAT_FILES.map(async (c) => {
    try {
      const r = await fetch(SITE_BASE + '/catalogo-' + c + '.json', { cf: { cacheTtl: 60 } });
      if (!r.ok) return;
      const arr = await r.json();
      if (Array.isArray(arr)) {
        for (const p of arr) { if (p && p.id != null) map[String(p.id)] = p; }
      }
    } catch (e) {}
  }));
  CATALOG_CACHE = map;
  CATALOG_TS = now;
  return map;
}

async function computeTotals(body){
  const items = Array.isArray(body.items) ? body.items : [];
  const shipCfg = await loadShipping();
  let metodo = body.spedizione && body.spedizione.metodo, paese = body.spedizione && body.spedizione.paese;
  if (!metodo && LEGACY_ZONA[body.zona]) { metodo = LEGACY_ZONA[body.zona][0]; paese = LEGACY_ZONA[body.zona][1]; }
  if (!metodo) { metodo = 'it-poste-casa'; paese = 'IT'; }
  paese = String(paese || 'IT').toUpperCase();
  const codeRaw = (body.code || '').trim().toUpperCase();
  const catalog = await loadCatalog();

  let subtotal = 0;
  const lines = [];
  for (const it of items) {
    const p = catalog[String(it.id)];
    if (!p) continue;
    if (p.sold) continue;
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const price = Number(p.price) || 0;
    const lineTotal = round2(price * qty);
    subtotal = round2(subtotal + lineTotal);
    lines.push({ id: p.id, name: p.name || 'Articolo', cat: p.cat, price: price, qty: qty, lineTotal: lineTotal });
  }

  // Sconto valido SOLO se il codice e' quello della categoria di oggi
  let discount = 0, categoria = null, codeValid = false, reason = null;
  if (codeRaw && CODES[codeRaw]) {
    const rule = CODES[codeRaw];
    if (rule.cat !== todayCat()) {
      reason = 'not-today';                 // codice esistente ma non e' lo sconto di oggi
    } else {
      categoria = rule.cat;
      let baseCat = 0;
      for (const l of lines) if (l.cat === rule.cat) baseCat = round2(baseCat + l.lineTotal);
      discount = round2(baseCat * rule.pct / 100);
      codeValid = discount > 0;
      if (!codeValid) reason = 'no-items';  // nessun articolo della categoria nel carrello
    }
  } else if (codeRaw) {
    reason = 'unknown';
  }

  const sp = calcolaSpedizione(shipCfg, metodo, paese, subtotal);
  if (sp.errore) throw new Error('Spedizione non disponibile per questo paese (' + sp.errore + ')');
  const shipping = sp.prezzo;
  const zona = metodo;

  const total = round2(subtotal + shipping - discount);
  return { lines, subtotal, discount, shipping, total, zona, reason,
           spedizione: { metodo: metodo, paese: paese, corriere: sp.metodo.corriere, nome: sp.metodo.nome },
           code: codeValid ? codeRaw : null, categoria: codeValid ? categoria : null };
}

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
        description: ('Ramacciato Vintage - Ordine - Spedizione ' + t.spedizione.corriere + ' ' + t.spedizione.nome + ' (' + t.spedizione.paese + ')').substring(0, 127),
        amount: { currency_code: 'EUR', value: t.total.toFixed(2), breakdown: breakdown },
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

export default {
  async fetch(request, env){
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(origin) });

    // Sconto del giorno (GET) - per la ruota in home
    if (url.pathname === '/today') {
      const cat = todayCat();
      return json({ index: todayIndex(), cat: cat, code: CAT_CODE[cat] }, 200, origin);
    }

    if (request.method !== 'POST')
      return json({ error: 'method' }, 405, origin);

    let body = {};
    try { body = await request.json(); } catch(e){ return json({ error: 'bad json' }, 400, origin); }

    try {
      if (url.pathname === '/quote') {
        const t = await computeTotals(body);
        return json({ subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, spedizione: t.spedizione,
                      total: t.total, code: t.code, categoria: t.categoria, reason: t.reason }, 200, origin);
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
