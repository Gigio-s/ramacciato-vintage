/* Disponibilità in diretta dall'inventario condiviso (Worker Cloudflare + D1).
   Usato da Libreria e pagine prodotto: quando un pezzo viene segnato venduto nel gestionale
   (e sincronizzato), la pagina mostra VENDUTO senza aspettare il push su GitHub.
   rvStockLive(function(mappa){ ... })  mappa: Map id -> copie disponibili. Ricontrolla ogni 30 s.
   Se il Worker non risponde non cambia nulla (resta lo stato del catalogo). */
(function () {
  'use strict';
  var URL_INV = 'https://ramacciato-sconti.ramacciatoluca.workers.dev/products?channel=rv';
  var cbs = [], avviato = false;
  function leggi() {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : 0;
    fetch(URL_INV, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        if (!d || !Array.isArray(d.products)) return;
        var m = new Map(d.products.map(function (p) { return [String(p.id), Math.max(0, Number(p.copie) || 0)]; }));
        cbs.forEach(function (cb) { try { cb(m); } catch (e) {} });
      })
      .catch(function () {})
      .then(function () { clearTimeout(t); });
  }
  window.rvStockLive = function (cb) {
    cbs.push(cb);
    if (avviato) return;
    avviato = true;
    leggi();
    setInterval(function () { if (!document.hidden) leggi(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) leggi(); });
  };
})();
