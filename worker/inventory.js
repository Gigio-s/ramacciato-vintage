/* RV stock integration. Shipping, discounts and PayPal credentials stay in worker.js. */
export const enabled = env => env.INVENTORY_ENABLED === '1';
const cents = n => Math.round(Number(n)*100);
function database(env){if(!env.INVENTORY_DB)throw new Error('Inventario temporaneamente non disponibile');return env.INVENTORY_DB}

export async function product(env,id){
 const p=await database(env).prepare('SELECT * FROM products WHERE id=? AND publish_rv=1').bind(String(id)).first();
 if(!p)throw new Error('Articolo non disponibile');
 const metadata=JSON.parse(p.metadata_json||'{}');
 if(metadata.nascosto)throw new Error('Articolo non disponibile');
 return {...metadata,id:p.id,name:p.name,cat:p.category,price:p.price_cents/100,copie:Math.max(0,p.stock-p.reserved),sold:p.stock<=p.reserved};
}

export async function publicProducts(env){
 const rows=await database(env).prepare('SELECT id,stock,reserved FROM products WHERE publish_rv=1').all();
 return (rows.results||[]).map(p=>({id:p.id,copie:Math.max(0,p.stock-p.reserved),sold:p.stock<=p.reserved}));
}

// Conteggio articoli disponibili per categoria (pubblicati RV, con copie libere, non nascosti).
// Usato dal Worker per decidere quali codici sconto sono attivi.
export async function categoryCounts(env){
 const rows=await database(env).prepare('SELECT category,metadata_json FROM products WHERE publish_rv=1 AND stock>reserved').all();
 const out={};
 for(const p of rows.results||[]){
   let m={};try{m=JSON.parse(p.metadata_json||'{}')}catch(_){}
   if(m.nascosto)continue;
   const c=String(p.category||'');out[c]=(out[c]||0)+1;
 }
 return out;
}

export async function expire(env){
 const db=database(env);
 const rows=await db.prepare(`SELECT r.* FROM reservations r JOIN orders o ON o.order_id=r.order_id
   WHERE r.status='active' AND o.status='created' AND datetime(r.expires_at)<=CURRENT_TIMESTAMP`).all();
 for(const r of rows.results||[])await db.batch([
   db.prepare(`UPDATE products SET reserved=MAX(0,reserved-?) WHERE id=? AND EXISTS
     (SELECT 1 FROM reservations r JOIN orders o ON o.order_id=r.order_id WHERE r.order_id=? AND r.product_id=? AND r.status='active' AND o.status='created')`).bind(r.quantity,r.product_id,r.order_id,r.product_id),
   db.prepare(`UPDATE reservations SET status='expired' WHERE order_id=? AND product_id=? AND status='active'
     AND EXISTS(SELECT 1 FROM orders WHERE order_id=? AND status='created')`).bind(r.order_id,r.product_id,r.order_id)
 ]);
 await db.prepare(`UPDATE orders SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='created'
   AND EXISTS(SELECT 1 FROM reservations WHERE reservations.order_id=orders.order_id AND status='expired')`).run();
}

export async function reserve(env,id,t){
 const db=database(env);await expire(env);
 const statements=[db.prepare(`INSERT INTO orders(order_id,source,status,shipping_zone,subtotal_cents,discount_cents,shipping_cents,total_cents,discount_code)
 VALUES(?,'rv','created',?,?,?,?,?,?)`).bind(id,t.zona,cents(t.subtotal),cents(t.discount),cents(t.shipping),cents(t.total),t.code)];
 const expires=new Date(Date.now()+30*60000).toISOString();
 for(const l of t.lines){
   // CHECK quantity>0 deliberately aborts the complete atomic batch on insufficient stock.
   statements.push(db.prepare(`INSERT INTO reservations(order_id,product_id,quantity,status,expires_at)
     VALUES(?,?,CASE WHEN EXISTS(SELECT 1 FROM products WHERE id=? AND publish_rv=1 AND stock-reserved>=?) THEN ? ELSE 0 END,'active',?)`)
     .bind(id,String(l.id),String(l.id),l.qty,l.qty,expires));
   statements.push(db.prepare('UPDATE products SET reserved=reserved+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(l.qty,String(l.id)));
   statements.push(db.prepare('INSERT INTO order_items(order_id,product_id,name,category,unit_price_cents,quantity) VALUES(?,?,?,?,?,?)')
     .bind(id,String(l.id),l.name,l.cat,cents(l.price),l.qty));
 }
 await db.batch(statements);
}

export async function beforeCapture(env,id){
 const db=database(env);
 const order=await db.prepare("SELECT * FROM orders WHERE order_id=? AND source='rv'").bind(id).first();
 if(!order)throw new Error('Ordine non riconosciuto');
 if(order.status==='captured')return JSON.parse(order.paypal_payload_json);
 if(order.status==='capturing')return null; // Retry uncertain payment with the same PayPal request ID.
 const result=await db.prepare(`UPDATE orders SET status='capturing',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND source='rv' AND status='created'
   AND EXISTS(SELECT 1 FROM reservations WHERE order_id=? AND status='active')
   AND NOT EXISTS(SELECT 1 FROM reservations WHERE order_id=? AND (status!='active' OR datetime(expires_at)<=CURRENT_TIMESTAMP))`)
   .bind(id,id,id).run();
 if(!result.meta?.changes)throw new Error('Prenotazione scaduta o ordine già in elaborazione');
 return null;
}

export async function complete(env,id,payload){
 if(payload.status!=='COMPLETED')return;
 const db=database(env);
 const rows=await db.prepare("SELECT * FROM reservations WHERE order_id=? AND status='active'").bind(id).all();
 const statements=[];
 for(const r of rows.results||[]){
   statements.push(db.prepare(`UPDATE products SET stock=stock-?,reserved=reserved-?,updated_at=CURRENT_TIMESTAMP WHERE id=?
     AND EXISTS(SELECT 1 FROM reservations WHERE order_id=? AND product_id=? AND status='active')`)
     .bind(r.quantity,r.quantity,r.product_id,id,r.product_id));
   statements.push(db.prepare("UPDATE reservations SET status='fulfilled' WHERE order_id=? AND product_id=? AND status='active'").bind(id,r.product_id));
 }
 statements.push(db.prepare("UPDATE orders SET status='captured',paypal_payload_json=?,captured_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND source='rv'").bind(JSON.stringify(payload),id));
 await db.batch(statements);
}
