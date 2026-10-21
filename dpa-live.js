/* Banner "concerti dal vivo" collegato a deadpeopleactivity.com
   - mostrato solo per la musica (CD, vinili, cassette)
   - per band sciolte o artisti scomparsi (artisti-storici.json) cerca tribute e cover band
   API: rvDpa.mount(target, prodotto, 'before'|'after'|'append')
        oppure <div data-dpa-artist="Nome"></div> (montato in automatico) */
(function () {
  'use strict';
  var BASE = 'https://deadpeopleactivity.com/mappa.html';
  var LOGO = '/img/dpa/dpa-logo.webp';
  var TXT = {
    it: { live: 'Vedi se {a} suona dal vivo vicino a te', trib: 'Cerca tribute e cover band di {a} vicino a te', cta: 'Apri la mappa dei concerti →' },
    en: { live: 'See if {a} is playing live near you', trib: 'Find {a} tribute and cover bands near you', cta: 'Open the gig map →' },
    es: { live: 'Mira si {a} toca en directo cerca de ti', trib: 'Busca bandas tributo y de versiones de {a} cerca de ti', cta: 'Abre el mapa de conciertos →' }
  };
  var CSS = '.dpa-live{position:relative;z-index:2;display:flex;flex-direction:column;gap:6px;flex:0 0 auto;align-self:stretch;margin:12px;padding:12px 14px 11px;background:#0f0f11;border:2px dashed #ff2a2a;border-radius:14px;color:#fff;text-decoration:none;font-family:inherit;font-size:14px;line-height:1.3;text-align:left;transition:transform .15s,box-shadow .15s;box-sizing:border-box}'
    + '.dpa-live:hover,.dpa-live:focus-visible{transform:translateY(-2px);box-shadow:0 8px 22px rgba(255,42,42,.25);outline:none}'
    + '.dpa-live img{height:24px!important;width:auto!important;max-width:100%!important;min-height:0!important;object-fit:contain!important;position:static!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;display:block!important;align-self:flex-start;flex:0 0 auto!important;filter:drop-shadow(0 0 .35px rgba(255,255,255,.85))}'
    + '.dpa-live.dpa-inline{margin:14px 0 0}'
    + '.dpa-live b{font-size:14px;font-weight:800;letter-spacing:.01em}'
    + '.dpa-live span{font-size:12px;font-weight:700;color:#ff4f5e;letter-spacing:.03em}';

  var dati = null, attesa = null;
  function carica() {
    if (dati) return Promise.resolve(dati);
    if (!attesa) {
      attesa = fetch('/artisti-storici.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (j) {
          var low = function (a) { return (a || []).map(function (x) { return String(x).toLowerCase(); }); };
          var al = {};
          Object.keys(j.alias || {}).forEach(function (k) { al[k.toLowerCase()] = j.alias[k]; });
          dati = { storici: low(j.storici), escludi: low(j.escludi), alias: al };
          return dati;
        });
    }
    return attesa;
  }

  function lingua() {
    var l = (window.rvLang && window.rvLang.get && window.rvLang.get()) || document.documentElement.lang || 'it';
    l = String(l).slice(0, 2);
    return TXT[l] ? l : 'it';
  }

  function pulisci(nome, d) {
    var a = String(nome || '').trim();
    if (!a || /colonne?\s+sonore?/i.test(a)) return '';
    a = a.replace(/\s*\(\d+\)\s*$/, '').trim();
    var k = a.toLowerCase();
    if (d.alias[k]) a = d.alias[k];
    if (d.escludi.indexOf(a.toLowerCase()) >= 0) return '';
    return a;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function stile() {
    if (document.getElementById('dpaLiveCss')) return;
    var s = document.createElement('style'); s.id = 'dpaLiveCss'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function banner(artista, d) {
    var a = pulisci(artista, d);
    if (!a) return null;
    var trib = d.storici.indexOf(a.toLowerCase()) >= 0;
    var l = lingua(), t = TXT[l];
    var url = BASE + '?q=' + encodeURIComponent(a) + (trib ? '&tribute=1' : '') + (l !== 'it' ? '&lang=' + l : '')
      + '&utm_source=ramacciatovintage&utm_medium=banner';
    var el = document.createElement('a');
    el.className = 'dpa-live';
    el.href = url; el.target = '_blank'; el.rel = 'noopener';
    el.setAttribute('translate', 'no');
    el.innerHTML = '<img src="' + LOGO + '" alt="Dead People Activity" width="305" height="49" loading="lazy">'
      + '<b>🎸 ' + esc((trib ? t.trib : t.live).replace('{a}', a)) + '</b><span>' + esc(t.cta) + '</span>';
    return el;
  }

  function mount(target, p, dove) {
    if (!target || !p) return;
    /* solo dischi: CD, vinili e musicassette (non gadget musicali ne colonne sonore) */
    var art = typeof p === 'string' ? p : ((p._colonnaSonora || (p.cat && p.cat !== 'musica') || (p.subcat && !/^(cd|vinil|musicassett)/i.test(p.subcat))) ? '' : p.artist);
    if (!art) return;
    var host = (dove === 'before' || dove === 'after') ? target.parentNode : target;
    if (!host) return;
    var vecchio = host.querySelector(':scope > .dpa-live'); if (vecchio) vecchio.remove();
    stile();
    carica().then(function (d) {
      var el = banner(art, d);
      if (!el) return;
      if (dove === 'before' || dove === 'after') { el.classList.add('dpa-inline'); if (target.parentNode) target.parentNode.insertBefore(el, dove === 'after' ? target.nextSibling : target); }
      else target.appendChild(el);
    });
  }

  function auto() {
    [].forEach.call(document.querySelectorAll('[data-dpa-artist]'), function (n) {
      if (n.dataset.dpaDone) return; n.dataset.dpaDone = '1';
      mount(n, n.getAttribute('data-dpa-artist'));
    });
  }

  window.rvDpa = { mount: mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
