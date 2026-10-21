var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// inventory.js
var enabled = /* @__PURE__ */ __name((env) => env.INVENTORY_ENABLED === "1", "enabled");
var cents = /* @__PURE__ */ __name((n) => Math.round(Number(n) * 100), "cents");
function database(env) {
  if (!env.INVENTORY_DB) throw new Error("Inventario temporaneamente non disponibile");
  return env.INVENTORY_DB;
}
__name(database, "database");
async function product(env, id) {
  const p = await database(env).prepare("SELECT * FROM products WHERE id=? AND publish_rv=1").bind(String(id)).first();
  if (!p) throw new Error("Articolo non disponibile");
  const metadata = JSON.parse(p.metadata_json || "{}");
  if (metadata.nascosto) throw new Error("Articolo non disponibile");
  return { ...metadata, id: p.id, name: p.name, cat: p.category, price: p.price_cents / 100, copie: Math.max(0, p.stock - p.reserved), sold: p.stock <= p.reserved };
}
__name(product, "product");
async function publicProducts(env) {
  const rows = await database(env).prepare("SELECT id,stock,reserved FROM products WHERE publish_rv=1").all();
  return (rows.results || []).map((p) => ({ id: p.id, copie: Math.max(0, p.stock - p.reserved), sold: p.stock <= p.reserved }));
}
__name(publicProducts, "publicProducts");
async function categoryCounts(env) {
  const rows = await database(env).prepare("SELECT category,metadata_json FROM products WHERE publish_rv=1 AND stock>reserved").all();
  const out = {};
  for (const p of rows.results || []) {
    let m = {};
    try {
      m = JSON.parse(p.metadata_json || "{}");
    } catch (_) {
    }
    if (m.nascosto) continue;
    const c = String(p.category || "");
    out[c] = (out[c] || 0) + 1;
  }
  return out;
}
__name(categoryCounts, "categoryCounts");
async function expire(env) {
  const db = database(env);
  const rows = await db.prepare(`SELECT r.* FROM reservations r JOIN orders o ON o.order_id=r.order_id
   WHERE r.status='active' AND o.status='created' AND datetime(r.expires_at)<=CURRENT_TIMESTAMP`).all();
  for (const r of rows.results || []) await db.batch([
    db.prepare(`UPDATE products SET reserved=MAX(0,reserved-?) WHERE id=? AND EXISTS
     (SELECT 1 FROM reservations r JOIN orders o ON o.order_id=r.order_id WHERE r.order_id=? AND r.product_id=? AND r.status='active' AND o.status='created')`).bind(r.quantity, r.product_id, r.order_id, r.product_id),
    db.prepare(`UPDATE reservations SET status='expired' WHERE order_id=? AND product_id=? AND status='active'
     AND EXISTS(SELECT 1 FROM orders WHERE order_id=? AND status='created')`).bind(r.order_id, r.product_id, r.order_id)
  ]);
  await db.prepare(`UPDATE orders SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='created'
   AND EXISTS(SELECT 1 FROM reservations WHERE reservations.order_id=orders.order_id AND status='expired')`).run();
}
__name(expire, "expire");
async function reserve(env, id, t) {
  const db = database(env);
  await expire(env);
  const statements = [db.prepare(`INSERT INTO orders(order_id,source,status,shipping_zone,subtotal_cents,discount_cents,shipping_cents,total_cents,discount_code)
 VALUES(?,'rv','created',?,?,?,?,?,?)`).bind(id, t.zona, cents(t.subtotal), cents(t.discount), cents(t.shipping), cents(t.total), t.code)];
  const expires = new Date(Date.now() + 30 * 6e4).toISOString();
  for (const l of t.lines) {
    statements.push(db.prepare(`INSERT INTO reservations(order_id,product_id,quantity,status,expires_at)
     VALUES(?,?,CASE WHEN EXISTS(SELECT 1 FROM products WHERE id=? AND publish_rv=1 AND stock-reserved>=?) THEN ? ELSE 0 END,'active',?)`).bind(id, String(l.id), String(l.id), l.qty, l.qty, expires));
    statements.push(db.prepare("UPDATE products SET reserved=reserved+?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(l.qty, String(l.id)));
    statements.push(db.prepare("INSERT INTO order_items(order_id,product_id,name,category,unit_price_cents,quantity) VALUES(?,?,?,?,?,?)").bind(id, String(l.id), l.name, l.cat, cents(l.price), l.qty));
  }
  await db.batch(statements);
}
__name(reserve, "reserve");
async function beforeCapture(env, id) {
  const db = database(env);
  const order = await db.prepare("SELECT * FROM orders WHERE order_id=? AND source='rv'").bind(id).first();
  if (!order) throw new Error("Ordine non riconosciuto");
  if (order.status === "captured") return JSON.parse(order.paypal_payload_json);
  if (order.status === "capturing") return null;
  const result = await db.prepare(`UPDATE orders SET status='capturing',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND source='rv' AND status='created'
   AND EXISTS(SELECT 1 FROM reservations WHERE order_id=? AND status='active')
   AND NOT EXISTS(SELECT 1 FROM reservations WHERE order_id=? AND (status!='active' OR datetime(expires_at)<=CURRENT_TIMESTAMP))`).bind(id, id, id).run();
  if (!result.meta?.changes) throw new Error("Prenotazione scaduta o ordine gi\xE0 in elaborazione");
  return null;
}
__name(beforeCapture, "beforeCapture");
async function complete(env, id, payload) {
  if (payload.status !== "COMPLETED") return;
  const db = database(env);
  const rows = await db.prepare("SELECT * FROM reservations WHERE order_id=? AND status='active'").bind(id).all();
  const statements = [];
  for (const r of rows.results || []) {
    statements.push(db.prepare(`UPDATE products SET stock=stock-?,reserved=reserved-?,updated_at=CURRENT_TIMESTAMP WHERE id=?
     AND EXISTS(SELECT 1 FROM reservations WHERE order_id=? AND product_id=? AND status='active')`).bind(r.quantity, r.quantity, r.product_id, id, r.product_id));
    statements.push(db.prepare("UPDATE reservations SET status='fulfilled' WHERE order_id=? AND product_id=? AND status='active'").bind(id, r.product_id));
  }
  statements.push(db.prepare("UPDATE orders SET status='captured',paypal_payload_json=?,captured_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND source='rv'").bind(JSON.stringify(payload), id));
  await db.batch(statements);
}
__name(complete, "complete");

// worker.js
var SITE_BASE = "https://ramacciatovintage.it";
var CAT_FILES = ["musica", "dvd", "videogiochi", "oggetti", "elettronica", "libri", "trading"];
var SHIP_FALLBACK = { "paesi": { "IT": "Italia", "AT": "Austria", "BE": "Belgio", "BG": "Bulgaria", "CY": "Cipro", "HR": "Croazia", "DK": "Danimarca", "EE": "Estonia", "FI": "Finlandia", "FR": "Francia", "DE": "Germania", "GR": "Grecia", "IE": "Irlanda", "LV": "Lettonia", "LT": "Lituania", "LU": "Lussemburgo", "MT": "Malta", "NL": "Paesi Bassi", "PL": "Polonia", "PT": "Portogallo", "CZ": "Repubblica Ceca", "RO": "Romania", "SK": "Slovacchia", "SI": "Slovenia", "ES": "Spagna", "SE": "Svezia", "HU": "Ungheria" }, "zone": { "z1": ["AT", "DE", "FR", "SI", "HR", "HU", "NL"], "z2": ["BE", "BG", "CZ", "ES", "LU", "PL"], "z3": ["DK", "PT", "GR", "SK", "RO", "FI", "EE", "LV", "LT", "SE", "IE", "CY", "MT"] }, "metodi": [{ "id": "it-inpost", "area": "italia", "corriere": "InPost", "nome": "Locker InPost", "tipo": "punto", "giorni": "1-3 giorni lavorativi", "prezzo": 4.9 }, { "id": "it-poste-punto", "area": "italia", "corriere": "Poste Italiane", "nome": "Ufficio postale o Punto Poste", "tipo": "punto", "giorni": "2-4 giorni lavorativi", "prezzo": 5.9 }, { "id": "it-brt-punto", "area": "italia", "corriere": "BRT", "nome": "BRT Fermopoint", "tipo": "punto", "giorni": "1-3 giorni lavorativi", "prezzo": 6.9 }, { "id": "it-poste-casa", "area": "italia", "corriere": "Poste Italiane", "nome": "Consegna a domicilio", "tipo": "casa", "giorni": "2-4 giorni lavorativi", "prezzo": 6.9 }, { "id": "it-brt-casa", "area": "italia", "corriere": "BRT", "nome": "Consegna a domicilio", "tipo": "casa", "giorni": "1-3 giorni lavorativi", "prezzo": 7.9 }, { "id": "eu-inpost", "area": "estero", "corriere": "InPost", "nome": "Locker InPost", "tipo": "punto", "giorni": "4-7 giorni lavorativi", "prezzo": 9.9, "paesi": ["FR", "ES", "PT", "PL", "BE", "NL", "LU"] }, { "id": "eu-gls", "area": "estero", "corriere": "GLS", "nome": "Consegna a domicilio", "tipo": "casa", "giorni": "3-6 giorni lavorativi", "prezzo": { "z1": 12.9, "z2": 13.9, "z3": 15.9 } }, { "id": "eu-brt", "area": "estero", "corriere": "BRT", "nome": "Consegna a domicilio (rete DPD)", "tipo": "casa", "giorni": "3-6 giorni lavorativi", "prezzo": { "z1": 13.9, "z2": 15.9, "z3": 17.9 } }, { "id": "eu-ups", "area": "estero", "corriere": "UPS", "nome": "UPS Standard a domicilio", "tipo": "casa", "giorni": "2-5 giorni lavorativi", "prezzo": { "z1": 15.9, "z2": 16.9, "z3": 18.9 } }, { "id": "eu-poste", "area": "estero", "corriere": "Poste Italiane", "nome": "Poste Delivery International", "tipo": "casa", "giorni": "5-10 giorni lavorativi", "prezzo": 25.9 }], "gratuita": { "italia": { "sopra": 30, "modo": "piu_economica" }, "estero": { "sopra": 100, "sconto": 5.9 } } };
var LEGACY_ZONA = { italia: ["it-poste-casa", "IT"], pickup: ["it-inpost", "IT"], europa: ["eu-gls", "DE"] };
var SHIP_CACHE = null;
var SHIP_TS = 0;
async function loadShipping() {
  const now = Date.now();
  if (SHIP_CACHE && now - SHIP_TS < 6e4) return SHIP_CACHE;
  let cfg = null;
  try {
    const r = await fetch(SITE_BASE + "/catalogo.json", { cf: { cacheTtl: 60 } });
    if (r.ok) {
      const j = await r.json();
      cfg = j && j.impostazioni && j.impostazioni.spedizione;
    }
  } catch (e) {
  }
  if (!cfg || !Array.isArray(cfg.metodi)) cfg = SHIP_FALLBACK;
  SHIP_CACHE = cfg;
  SHIP_TS = now;
  return cfg;
}
__name(loadShipping, "loadShipping");
function zonaDi(cfg, paese) {
  if (paese === "IT") return "it";
  const z = cfg.zone || {};
  for (const k in z) if ((z[k] || []).indexOf(paese) >= 0) return k;
  return null;
}
__name(zonaDi, "zonaDi");
function calcolaSpedizione(cfg, metodoId, paese, subtotale) {
  const m = (cfg.metodi || []).find((x) => x.id === metodoId);
  if (!m) return { errore: "metodo" };
  const zona = zonaDi(cfg, paese);
  if (!zona) return { errore: "paese" };
  if (m.area === "italia" ? paese !== "IT" : paese === "IT") return { errore: "area" };
  if (m.paesi && m.paesi.indexOf(paese) < 0) return { errore: "paese-metodo" };
  const base = typeof m.prezzo === "number" ? m.prezzo : (m.prezzo || {})[zona];
  if (base == null) return { errore: "prezzo" };
  const g = cfg.gratuita || {};
  let sconto = 0;
  if (m.area === "italia" && g.italia && subtotale >= g.italia.sopra) {
    if (g.italia.modo === "tutte") sconto = base;
    else sconto = Math.min(...cfg.metodi.filter((x) => x.area === "italia").map((x) => Number(x.prezzo)));
  } else if (m.area === "estero" && g.estero && subtotale >= g.estero.sopra) {
    sconto = Number(g.estero.sconto) || 0;
  }
  sconto = Math.min(base, sconto);
  return { metodo: m, zona, pieno: round2(base), prezzo: round2(base - sconto) };
}
__name(calcolaSpedizione, "calcolaSpedizione");
var CODES = {
  "RV-GAME5": { pct: 5, cat: "videogiochi" },
  "RV-TECH5": { pct: 5, cat: "elettronica" },
  "RV-MUSIC5": { pct: 5, cat: "musica" },
  "RV-LIBRI5": { pct: 5, cat: "libri" },
  "RV-OGG5": { pct: 5, cat: "oggetti" },
  "RV-CARD5": { pct: 5, cat: "trading" },
  "RV-DVD5": { pct: 5, cat: "dvd" }
};
var ORDER = ["videogiochi", "elettronica", "musica", "libri", "oggetti", "trading", "dvd"];
var CAT_CODE = {};
for (const k in CODES) CAT_CODE[CODES[k].cat] = k;
var MIN_DISPONIBILI = 10;
var ATTIVE_CACHE = null;
var ATTIVE_TS = 0;
async function categorieAttive(env) {
  const now = Date.now();
  if (ATTIVE_CACHE && now - ATTIVE_TS < 6e4) return ATTIVE_CACHE;
  let counts = {};
  if (enabled(env)) {
    counts = await categoryCounts(env);
  } else {
    const catalog = await loadCatalog();
    for (const id in catalog) {
      const p = catalog[id];
      if (!p || p.sold || p.nascosto) continue;
      counts[p.cat] = (counts[p.cat] || 0) + 1;
    }
  }
  const attive = ORDER.filter((c) => (counts[c] || 0) >= MIN_DISPONIBILI);
  ATTIVE_CACHE = { attive, counts };
  ATTIVE_TS = now;
  return ATTIVE_CACHE;
}
__name(categorieAttive, "categorieAttive");
async function todayCat(env) {
  const { attive } = await categorieAttive(env);
  if (!attive.length) return null;
  return attive[Math.floor(Date.now() / 864e5) % attive.length];
}
__name(todayCat, "todayCat");
var ALLOWED_ORIGINS = [
  "https://ramacciatovintage.it",
  "https://www.ramacciatovintage.it"
];
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
__name(round2, "round2");
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(origin))
  });
}
__name(json, "json");
var CATALOG_CACHE = null;
var CATALOG_TS = 0;
async function loadCatalog() {
  const now = Date.now();
  if (CATALOG_CACHE && now - CATALOG_TS < 6e4) return CATALOG_CACHE;
  const map = {};
  await Promise.all(CAT_FILES.map(async (c) => {
    try {
      const r = await fetch(SITE_BASE + "/catalogo-" + c + ".json", { cf: { cacheTtl: 60 } });
      if (!r.ok) return;
      const arr = await r.json();
      if (Array.isArray(arr)) {
        for (const p of arr) {
          if (p && p.id != null) map[String(p.id)] = p;
        }
      }
    } catch (e) {
    }
  }));
  CATALOG_CACHE = map;
  CATALOG_TS = now;
  return map;
}
__name(loadCatalog, "loadCatalog");
async function computeTotals(body, env) {
  const items = Array.isArray(body.items) ? body.items : [];
  const shipCfg = await loadShipping();
  let metodo = body.spedizione && body.spedizione.metodo, paese = body.spedizione && body.spedizione.paese;
  if (!metodo && LEGACY_ZONA[body.zona]) {
    metodo = LEGACY_ZONA[body.zona][0];
    paese = LEGACY_ZONA[body.zona][1];
  }
  if (!metodo) {
    metodo = "it-poste-casa";
    paese = "IT";
  }
  paese = String(paese || "IT").toUpperCase();
  const codeRaw = (body.code || "").trim().toUpperCase();
  const catalog = enabled(env) ? null : await loadCatalog();
  let subtotal = 0;
  const lines = [];
  for (const it of items) {
    const p = enabled(env) ? await product(env, it.id) : catalog[String(it.id)];
    if (!p) continue;
    if (p.sold) {
      if (enabled(env)) throw new Error("Articolo esaurito");
      continue;
    }
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    if (enabled(env) && qty > p.copie) throw new Error("Quantit\xE0 non disponibile");
    const price = Number(p.price) || 0;
    const lineTotal = round2(price * qty);
    subtotal = round2(subtotal + lineTotal);
    lines.push({ id: p.id, name: p.name || "Articolo", cat: p.cat, price, qty, lineTotal });
  }
  let discount = 0, categoria = null, codeValid = false, reason = null;
  if (codeRaw && CODES[codeRaw]) {
    const rule = CODES[codeRaw];
    if (rule.cat !== await todayCat(env)) {
      reason = "not-today";
    } else {
      categoria = rule.cat;
      let baseCat = 0;
      for (const l of lines) if (l.cat === rule.cat) baseCat = round2(baseCat + l.lineTotal);
      discount = round2(baseCat * rule.pct / 100);
      codeValid = discount > 0;
      if (!codeValid) reason = "no-items";
    }
  } else if (codeRaw) {
    reason = "unknown";
  }
  const sp = calcolaSpedizione(shipCfg, metodo, paese, subtotal);
  if (sp.errore) throw new Error("Spedizione non disponibile per questo paese (" + sp.errore + ")");
  const shipping = sp.prezzo;
  const zona = metodo;
  const total = round2(subtotal + shipping - discount);
  return {
    lines,
    subtotal,
    discount,
    shipping,
    total,
    zona,
    reason,
    spedizione: { metodo, paese, corriere: sp.metodo.corriere, nome: sp.metodo.nome },
    code: codeValid ? codeRaw : null,
    categoria: codeValid ? categoria : null
  };
}
__name(computeTotals, "computeTotals");
function ppBase(env) {
  return env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
__name(ppBase, "ppBase");
async function ppToken(env) {
  const auth = btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET);
  const r = await fetch(ppBase(env) + "/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("PayPal token error");
  return d.access_token;
}
__name(ppToken, "ppToken");
async function createOrder(env, t) {
  const token = await ppToken(env);
  const items = t.lines.map((l) => ({
    name: String(l.name).substring(0, 127),
    quantity: String(l.qty),
    unit_amount: { currency_code: "EUR", value: l.price.toFixed(2) },
    category: "PHYSICAL_GOODS"
  }));
  const breakdown = {
    item_total: { currency_code: "EUR", value: t.subtotal.toFixed(2) },
    shipping: { currency_code: "EUR", value: t.shipping.toFixed(2) }
  };
  if (t.discount > 0) breakdown.discount = { currency_code: "EUR", value: t.discount.toFixed(2) };
  const r = await fetch(ppBase(env) + "/v2/checkout/orders", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        description: ("Ramacciato Vintage - Ordine - Spedizione " + t.spedizione.corriere + " " + t.spedizione.nome + " (" + t.spedizione.paese + ")").substring(0, 127),
        amount: { currency_code: "EUR", value: t.total.toFixed(2), breakdown },
        items
      }],
      application_context: { brand_name: "Ramacciato Vintage", locale: "it-IT", user_action: "PAY_NOW" }
    })
  });
  const d = await r.json();
  if (!d.id) throw new Error("PayPal create error: " + JSON.stringify(d));
  return d.id;
}
__name(createOrder, "createOrder");
async function captureOrder(env, orderID) {
  const token = await ppToken(env);
  const r = await fetch(ppBase(env) + "/v2/checkout/orders/" + encodeURIComponent(orderID) + "/capture", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "PayPal-Request-Id": "rv-capture-" + orderID }
  });
  return await r.json();
}
__name(captureOrder, "captureOrder");
var worker_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (url.pathname === "/today") {
      let cat = null;
      try {
        cat = await todayCat(env);
      } catch (e) {
        cat = null;
      }
      return json({
        index: cat ? ORDER.indexOf(cat) : -1,
        cat,
        code: cat ? CAT_CODE[cat] : null,
        soglia: MIN_DISPONIBILI
      }, 200, origin);
    }
    if (request.method === "GET" && url.pathname === "/products" && enabled(env)) {
      try {
        return json({ products: await publicProducts(env) }, 200, origin);
      } catch (_) {
        return json({ error: "Disponibilit\xE0 non verificabile" }, 503, origin);
      }
    }
    if (request.method !== "POST")
      return json({ error: "method" }, 405, origin);
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "bad json" }, 400, origin);
    }
    try {
      if (url.pathname === "/quote") {
        const t = await computeTotals(body, env);
        return json({
          subtotal: t.subtotal,
          discount: t.discount,
          shipping: t.shipping,
          spedizione: t.spedizione,
          total: t.total,
          code: t.code,
          categoria: t.categoria,
          reason: t.reason
        }, 200, origin);
      }
      if (url.pathname === "/create-order") {
        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET)
          return json({ error: "PayPal non configurato" }, 500, origin);
        const t = await computeTotals(body, env);
        if (!t.lines.length) return json({ error: "carrello vuoto" }, 400, origin);
        const id = await createOrder(env, t);
        if (enabled(env)) await reserve(env, id, t);
        return json({ id, total: t.total, discount: t.discount }, 200, origin);
      }
      if (url.pathname === "/capture-order") {
        if (!body.orderID) return json({ error: "orderID mancante" }, 400, origin);
        if (enabled(env)) {
          const saved = await beforeCapture(env, String(body.orderID));
          if (saved) return json(saved, 200, origin);
        }
        const d = await captureOrder(env, body.orderID);
        if (enabled(env)) await complete(env, String(body.orderID), d);
        return json(d, 200, origin);
      }
      return json({ error: "not found" }, 404, origin);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, origin);
    }
  }
};
export {
  worker_default as default
};
