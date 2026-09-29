/* Ramacciato Vintage - Ordini nel weekend di mercatino
   Gli ordini fatti da sabato alle 18:00 a lunedi alle 9:00 (ora italiana) nei primi 3 weekend del mese
   vengono confermati lunedi mattina tra le 9 e le 10: la domenica sono ai mercatini e l'inventario puo cambiare.
   Il weekend conta in base alla domenica: 1a, 2a o 3a domenica del mese (giorno 1-21).
   Per cambiare la regola modifica solo le costanti qui sotto. */
(function(){
  'use strict';
  var WEEKEND_ATTIVI = [1, 2, 3];   // domeniche del mese in cui c'e il mercatino
  var INIZIO_SABATO = 18;           // ora di inizio (sabato)
  var FINE_LUNEDI = 9;              // ora di fine (lunedi)
  var CONFERMA = 'tra le 9 e le 10';
  var MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];

  function oraRoma(d){
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false });
    var o = {};
    f.formatToParts(d).forEach(function(p){ o[p.type] = p.value; });
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, min: +o.minute, wd: wd };
  }
  function spostaGiorni(y, m, d, n){ var t = new Date(Date.UTC(y, m - 1, d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }

  /* Restituisce null fuori dalla finestra, altrimenti { lunedi: 'lunedì 5 ottobre', ... } */
  function finestra(data){
    var r = oraRoma(data || new Date()), t = r.h * 60 + r.min, dom = null;
    if(r.wd === 6 && t >= INIZIO_SABATO * 60) dom = spostaGiorni(r.y, r.m, r.d, 1);
    else if(r.wd === 0) dom = { y: r.y, m: r.m, d: r.d };
    else if(r.wd === 1 && t < FINE_LUNEDI * 60) dom = spostaGiorni(r.y, r.m, r.d, -1);
    if(!dom) return null;
    var n = Math.ceil(dom.d / 7);
    if(WEEKEND_ATTIVI.indexOf(n) < 0) return null;
    var lun = spostaGiorni(dom.y, dom.m, dom.d, 1);
    return { lunedi: 'lunedì ' + lun.d + ' ' + MESI[lun.m - 1], orario: CONFERMA, domenica: n };
  }

  var CSS = '.rvw{display:flex;gap:12px;align-items:flex-start;background:#fff8e6;border:1.5px solid rgba(192,120,0,.45);color:#0b2545;border-radius:14px;padding:12px 16px;margin:0 0 18px;font-family:Archivo,Arial,sans-serif;font-size:13px;line-height:1.5;box-shadow:0 6px 18px rgba(11,37,69,.08);text-align:left}'
    + '.rvw b{font-weight:800}.rvw a{color:#0d3b75;text-decoration:underline}.rvw-ico{font-size:20px;line-height:1.1}'
    + '.rvw.compatto{font-size:12px;padding:10px 12px;margin:10px 0 0}';

  function testo(f){
    return '<b>Ordini del weekend di mercatino:</b> la domenica sono ai mercatini e alcuni pezzi possono essere venduti di persona. '
      + 'Gli ordini fatti da sabato alle 18 a lunedì alle 9 vengono confermati <b>' + f.lunedi + ' ' + f.orario + '</b>. '
      + 'Se un articolo non è più disponibile ti rimborso subito il suo importo (tutto l\'ordine, spedizione compresa, se non resta niente); '
      + 'i tempi di accredito dipendono da PayPal o dalla tua banca. <a href="/faq.html#weekend">Maggiori info</a>';
  }

  /* Anteprima: aggiungi ?provaweekend all'indirizzo per vedere l'avviso anche fuori orario */
  function prossimo(){
    var t = Date.now();
    for(var i = 0; i < 45; i++){ var d = new Date(t + i * 864e5); var f = finestra(d); if(f && oraRoma(d).wd === 0) return f; }
    return null;
  }
  function monta(){
    var f = finestra();
    if(!f && /[?&]provaweekend/.test(location.search)) f = prossimo();
    var slot = document.querySelectorAll('[data-rv-weekend]');
    if(!slot.length) return;
    if(!document.getElementById('rvw-css')){ var st = document.createElement('style'); st.id = 'rvw-css'; st.textContent = CSS; document.head.appendChild(st); }
    slot.forEach(function(el){
      if(!f){ el.innerHTML = ''; el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<div class="rvw' + (el.getAttribute('data-rv-weekend') === 'compatto' ? ' compatto' : '') + '" role="note"><span class="rvw-ico" aria-hidden="true">&#x1F4C5;</span><div>' + testo(f) + '</div></div>';
    });
  }

  window.rvWeekend = { finestra: finestra, testo: testo, monta: monta };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();
  setInterval(monta, 5 * 60 * 1000);
})();
