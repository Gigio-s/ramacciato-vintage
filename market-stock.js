/* Enable only after ramacciato-sconti uses worker/worker.js + shared D1.
   No token: this endpoint returns public catalogue data only. */
window.RV_MARKET_STOCK_ENABLED = true;
window.rvMarketStock = async function(products) {
  if (!window.RV_MARKET_STOCK_ENABLED) return;
  let notice=document.getElementById('market-stock-notice');
  if(!notice){notice=document.createElement('p');notice.id='market-stock-notice';notice.setAttribute('role','status');notice.style.cssText='padding:16px;background:#fff1d6;color:#613700;text-align:center';document.body.prepend(notice)}
  try {
    const response = await fetch('https://ramacciato-sconti.ramacciatoluca.workers.dev/products?channel=rv',
      {cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error('Disponibilità non verificata');
    const data=await response.json();
    if(!Array.isArray(data.products)) throw new Error('Inventario non valido');
    const stock=new Map(data.products.map(p=>[String(p.id),Math.max(0,Number(p.copie)||0)]));
    products.forEach(p=>{p.copie=stock.get(String(p.id))||0;p.sold=p.copie===0;p._stockUnavailable=false});
    notice.hidden=true;
  } catch(_) {
    products.forEach(p=>{p.copie=0;p.sold=true;p._stockUnavailable=true});
    notice.textContent='Disponibilità momentaneamente non verificabile. Riprova tra poco.';
    notice.hidden=false;
  }
};
