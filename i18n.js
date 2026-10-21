/* i18n.js - lingue IT / EN / ES per Ramacciato Vintage
   Stesso principio usato su Dead People Activity:
   - l'HTML resta scritto in italiano; la traduzione avviene a dizionario
     (i18n/en.json, i18n/es.json) per corrispondenza esatta del testo;
   - le frasi non presenti nel dizionario restano in italiano (niente si rompe);
   - traduce anche i contenuti creati dopo il caricamento (shop, carrello...);
   - al primo accesso sceglie la lingua da fuso orario e lingua del browser,
     senza inviare dati a nessuno; la scelta manuale viene ricordata (rv_lang)
     e puo' arrivare dall'indirizzo (?lang=en / ?lang=es).
   Formato dizionario: { "Testo italiano": "Traduzione" }.
   Frasi con grassetti/link interni: la chiave e' il testo semplice,
   la traduzione usa segnaposto {0}...{/0} per gli elementi interni (in ordine)
   e {0/} per gli elementi vuoti come <br>.
   Compatibile con i vecchi attributi data-i18n-es / data-i18n-en,
   data-i18n-ph-*, data-show-lang / data-hide-lang.
   Per escludere un elemento: translate="no". */
(function () {
  'use strict';
  var LANGS = ['it', 'en', 'es'];
  var KEY = 'rv_lang';
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  var INLINE = { STRONG: 1, EM: 1, B: 1, I: 1, A: 1, BR: 1, SPAN: 1, SMALL: 1, U: 1, MARK: 1, SUP: 1, SUB: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

  /* cartella del sito, ricavata da dove e' caricato questo script */
  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/[^\/]*$/, '') : '/';

  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function detect() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (LANGS.indexOf(q) > -1) return { lang: q, fromUrl: true };
    } catch (e) {}
    try {
      var s = localStorage.getItem(KEY);
      if (LANGS.indexOf(s) > -1) return { lang: s };
    } catch (e) {}
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/^Europe\/(Rome|Vatican|San_Marino)$/.test(tz)) return { lang: 'it' };
    if (/^(Europe\/(Madrid|Ceuta)|Atlantic\/Canary)$/.test(tz)) return { lang: 'es' };
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'it']);
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i] || '').toLowerCase().split('-')[0];
      if (l === 'it' || l === 'es' || l === 'en') return { lang: l };
      if (l === 'ca' || l === 'gl' || l === 'eu') return { lang: 'es' };
    }
    return { lang: 'en' };
  }

  var det = detect();
  var lang = det.lang;
  var dict = null;
  var COLLECT = !!window.RV_I18N_COLLECT;   /* solo per lo sviluppo: raccoglie le frasi mancanti */
  var missing = window.__rvMissing = window.__rvMissing || {};

  document.documentElement.lang = lang;

  /* evita il "lampo" di italiano mentre si carica il dizionario */
  if (lang !== 'it') {
    var st = document.createElement('style');
    st.id = 'rv-i18n-wait';
    st.textContent = 'html.rv-i18n-wait body{visibility:hidden!important}';
    document.head.appendChild(st);
    document.documentElement.classList.add('rv-i18n-wait');
    setTimeout(reveal, 2500);
  }
  function reveal() { document.documentElement.classList.remove('rv-i18n-wait'); }

  var dictReady = lang === 'it' ? Promise.resolve({}) :
    fetch(BASE + 'i18n/' + lang + '.json?v=1').then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });

  /* regole per testi con parti variabili (prezzi, quantita', date):
     chiavi del dizionario nella forma "/^regex$/"; nella traduzione $1, $2...
     Le parti catturate passano dal dizionario e dalla mappa "@words". */
  var RULES = null, WORDS = null;
  function prepRules() {
    RULES = []; WORDS = (dict && dict['@words']) || {};
    for (var k in dict) {
      if (k.charAt(0) === '/' && k.length > 2 && k.charAt(k.length - 1) === '/') {
        try { RULES.push([new RegExp(k.slice(1, -1)), dict[k]]); } catch (e) {}
      }
    }
  }
  function words(s) {
    return s.replace(/[A-Za-zÀ-ÿ]+/g, function (w) {
      var l = w.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(WORDS, l)) return w;
      var r = WORDS[l];
      return w.charAt(0) === w.charAt(0).toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r;
    });
  }
  function exact(k) { return dict && typeof dict[k] === 'string' && Object.prototype.hasOwnProperty.call(dict, k) && k.charAt(0) !== '@' ? dict[k] : null; }
  function byRule(k, depth) {
    if (!RULES) prepRules();
    depth = depth || 0;
    for (var i = 0; i < RULES.length; i++) {
      var m = k.match(RULES[i][0]);
      if (m) return RULES[i][1].replace(/\$(\d)/g, function (_, n) {
        var g = m[+n] || '', t = norm(g), e = exact(t);
        if (e != null) return e;
        if (depth < 3 && /[A-Za-zÀ-ÿ]{2}/.test(t)) { var r = byRule(t, depth + 1); if (r != null) return g.match(/^\s*/)[0] + r + g.match(/\s*$/)[0]; }
        return /\d/.test(g) ? words(g) : g;
      });
    }
    return null;
  }
  function lookup(text) {
    var k = norm(text);
    if (!k || !/[A-Za-zÀ-ÿ]{2}/.test(k)) return null;
    var v = exact(k);
    if (v == null && dict) v = byRule(k);
    if (v != null) return v;
    if (COLLECT) missing[k] = missing[k] || '';
    return null;
  }
  function t(text) { var v = lookup(text); return v == null ? text : v; }

  function skipEl(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (SKIP[n.tagName] || n.id === 'rv-lang') return true;
      if (n.getAttribute('translate') === 'no') return true;
    }
    return false;
  }

  /* elemento con testo misto a grassetti/link: si traduce come frase intera */
  function isMixed(el) {
    if (!el.firstElementChild) return false;
    var hasText = false;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 && c.nodeValue.trim()) hasText = true;
    }
    if (!hasText) return false;
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) if (!INLINE[all[i].tagName]) return false;
    return true;
  }
  function template(el) {
    var out = '', i = 0;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1) {
        if (!c.textContent.trim()) out += '{' + i + '/}';
        else out += '{' + i + '}' + c.textContent + '{/' + i + '}';
        i++;
      }
    }
    return norm(out);
  }
  function applyMixed(el, value) {
    var kids = [];
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) kids.push(c);
    /* traduzione senza segnaposto: cambio solo il testo, gli elementi interni restano dove sono
       (es. contatori aggiornati dagli script) */
    if (!/\{\d+\/?\}/.test(value)) {
      var first = true;
      for (var t = el.firstChild; t; t = t.nextSibling) {
        if (t.nodeType === 3 && t.nodeValue.trim()) {
          if (first) { t.nodeValue = t.nodeValue.match(/^\s*/)[0] + value + t.nodeValue.match(/\s*$/)[0]; first = false; }
          else t.nodeValue = ' ';
        }
      }
      return;
    }
    /* con segnaposto: riuso gli elementi originali (non copie), cosi' gli script che li
       aggiornano continuano a funzionare */
    var used = {};
    var frag = document.createDocumentFragment();
    var re = /\{(\d+)\}([\s\S]*?)\{\/\1\}|\{(\d+)\/\}/g, last = 0, m;
    while ((m = re.exec(value))) {
      if (m.index > last) frag.appendChild(document.createTextNode(value.slice(last, m.index)));
      var idx = +(m[1] || m[3]), src = kids[idx];
      if (src) {
        var node = used[idx] ? src.cloneNode(m[3] != null) : src;
        used[idx] = true;
        if (m[1] != null && node.textContent !== m[2]) node.textContent = m[2];
        frag.appendChild(node);
      }
      last = re.lastIndex;
    }
    if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
    kids.forEach(function (k, i) { if (!used[i] && !k.textContent.trim()) frag.appendChild(k); });
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(frag);
  }

  function walk(node) {
    if (node.nodeType === 3) {
      var p = node.parentElement;
      if (!p || skipEl(p)) return;
      var raw = node.nodeValue, v = lookup(raw);
      if (v != null && v !== norm(raw)) node.nodeValue = raw.match(/^\s*/)[0] + v + raw.match(/\s*$/)[0];
      return;
    }
    if (node.nodeType !== 1 || SKIP[node.tagName] || node.id === 'rv-lang' || node.getAttribute('translate') === 'no') return;
    legacy(node);
    ATTRS.forEach(function (a) {
      if (node.hasAttribute(a)) {
        var v = lookup(node.getAttribute(a));
        if (v != null) node.setAttribute(a, v);
      }
    });
    if (node.hasAttribute('data-i18n-' + lang)) return;
    if (isMixed(node)) {
      var key = norm(node.textContent);
      var v = exact(key);
      if (v == null && dict && /[A-Za-zÀ-ÿ]{2}/.test(key)) v = byRule(key);
      if (v == null && COLLECT && /[A-Za-zÀ-ÿ]{2}/.test(key)) missing[key] = template(node);
      if (v != null) { if (norm(v.replace(/\{\/?\d+\/?\}/g, '')) !== key) applyMixed(node, v); return; }
    }
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  /* vecchio sistema ad attributi (svuotacantine) */
  function legacy(el) {
    if (lang !== 'it' && el.hasAttribute('data-i18n-' + lang)) el.innerHTML = el.getAttribute('data-i18n-' + lang);
    if (lang !== 'it' && el.hasAttribute('data-i18n-ph-' + lang)) el.setAttribute('placeholder', el.getAttribute('data-i18n-ph-' + lang));
    if (el.hasAttribute('data-show-lang')) el.style.display = inLang(el.getAttribute('data-show-lang')) ? '' : 'none';
    if (el.hasAttribute('data-hide-lang')) el.style.display = inLang(el.getAttribute('data-hide-lang')) ? 'none' : '';
  }
  function inLang(v) { return (v || '').split(/[\s,]+/).indexOf(lang) > -1; }

  function translateHead() {
    var tt = document.querySelector('title');
    if (tt) { var v = lookup(tt.textContent); if (v != null) document.title = v; }
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(function (m) {
      var v = lookup(m.getAttribute('content'));
      if (v != null) m.setAttribute('content', v);
    });
    var og = document.querySelector('meta[property="og:locale"]');
    if (og) og.setAttribute('content', lang === 'en' ? 'en_GB' : lang === 'es' ? 'es_ES' : 'it_IT');
    if (det.fromUrl && lang !== 'it') {
      var can = document.querySelector('link[rel="canonical"]');
      if (can) {
        try { var u = new URL(can.href); u.searchParams.set('lang', lang); can.href = u.href; } catch (e) {}
      }
    }
  }

  function noticeFlag() {
    var on = false;
    document.querySelectorAll('.rv-i18n-notice[data-show-lang]').forEach(function (n) { if (n.style.display !== 'none') on = true; });
    document.body.classList.toggle('rv-notice-on', on);
  }

  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    try {
      var u = new URL(location.href);
      if (l === 'it') u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
      location.replace(u.href);
    } catch (e) { location.reload(); }
  }

  function buildSelector() {
    if (document.getElementById('rv-lang')) return;
    var wrap = document.createElement('div');
    wrap.id = 'rv-lang';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Lingua / Language / Idioma');
    wrap.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:30;display:flex;gap:2px;'
      + 'background:rgba(11,37,69,.85);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'
      + 'border-radius:999px;padding:3px;font-family:Archivo,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.28)';
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.toUpperCase();
      b.setAttribute('lang', l);
      b.setAttribute('aria-pressed', l === lang ? 'true' : 'false');
      b.style.cssText = 'border:none;cursor:pointer;border-radius:999px;padding:5px 9px;'
        + 'font-size:10px;font-weight:800;letter-spacing:.08em;font-family:inherit;'
        + 'transition:background .18s,color .18s;'
        + (l === lang ? 'background:#4a90e0;color:#0b2545;' : 'background:transparent;color:#d6e6f7;');
      b.addEventListener('click', function () { if (l !== lang) setLang(l); });
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
  }

  function start() {
    dictReady.then(function (d) {
      dict = d || {};
      if (lang !== 'it' || COLLECT) {
        translateHead();
        walk(document.body);
        new MutationObserver(function (recs) {
          recs.forEach(function (r) {
            r.addedNodes.forEach(function (n) {
              if (n.nodeType === 3) { if (n.parentNode) walk(n.parentNode.nodeType === 1 && isMixed(n.parentNode) ? n.parentNode : n); }
              else walk(n);
            });
          });
        }).observe(document.body, { childList: true, subtree: true });
        /* testi negli attributi cambiati dagli script (es. segnaposto della ricerca) */
        new MutationObserver(function (recs) {
          recs.forEach(function (r) {
            var el = r.target, a = r.attributeName;
            if (skipEl(el)) return;
            var v = lookup(el.getAttribute(a));
            if (v != null && v !== el.getAttribute(a)) el.setAttribute(a, v);
          });
        }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ATTRS });
      } else {
        document.querySelectorAll('[data-show-lang],[data-hide-lang]').forEach(legacy);
      }
      noticeFlag();
      buildSelector();
      reveal();
    });
  }

  window.rvLang = { get: function () { return lang; }, set: setLang };
  window.rvT = t;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
