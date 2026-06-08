/* ═══════════════════════════════════════════════════════
   Ramacciato Vintage — Cart Widget
   Floating, draggable, persistent (localStorage)
   Easter egg: scuotimi → shake → fall animation
═══════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var KEY = 'rv_cart_v1';

  /* ── Storage ───────────────────────────────────────── */
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
  function save(c){ localStorage.setItem(KEY, JSON.stringify(c)); }
  function getAll(){ return load(); }
  function addItem(item){ var c=load(); if(!c.find(function(x){return x.id===item.id})){ c.push(item); save(c); } refresh(); }
  function removeItem(id){ save(load().filter(function(x){return x.id!==id})); refresh(); }
  function hasItem(id){ return !!load().find(function(x){return x.id===id}); }
  function cartCount(){ return load().length; }
  function cartTotal(){ return load().reduce(function(s,p){return s+p.price},0); }

  /* ── Public API ────────────────────────────────────── */
  window.rvCart = {
    add: addItem,
    remove: removeItem,
    has: hasItem,
    get: getAll,
    refresh: function(){ refresh(); },
    open: function(){ openPanel(); }
  };

  /* ── State ─────────────────────────────────────────── */
  var isOpen = false;
  var shakeReady = false;
  var scuotiTimer = null;
  var el = {};

  /* ── CSS ────────────────────────────────────────────── */
  var CSS = [
    '#rv-w{position:fixed;bottom:28px;right:28px;z-index:9999;font-family:"Archivo",Arial,sans-serif;}',
    /* override cursor:none from shop.html */
    '#rv-w,#rv-w *{cursor:auto !important;}',
    '.rv-bubble,.rv-ib,.rv-irm,.rv-chk,.rv-tip,.rv-ph{cursor:pointer !important;}',

    /* bubble */
    '.rv-bubble{width:54px;height:54px;border-radius:50%;background:#0e0c0a;color:#faf6f0;',
    'display:flex;align-items:center;justify-content:center;cursor:pointer;',
    'box-shadow:0 8px 28px rgba(14,12,10,.24);position:relative;user-select:none;',
    'font-size:22px;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s;}',
    '.rv-bubble:hover{transform:scale(1.09);box-shadow:0 12px 36px rgba(14,12,10,.32);}',
    '.rv-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;',
    'padding:0 4px;background:#c07030;color:#fff;font-size:10px;font-weight:900;',
    'display:flex;align-items:center;justify-content:center;border:2px solid #f0ebe3;pointer-events:none;}',
    '.rv-badge.rv-hide{display:none;}',

    /* scuotimi hint inside panel header */
    '.rv-hint{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;',
    'color:var(--accent2,#c07030);background:none;border:none;cursor:pointer !important;',
    'padding:2px 6px;border-radius:4px;transition:color .2s;animation:rv-bob .7s ease infinite alternate;',
    'font-family:inherit;margin-left:6px;white-space:nowrap;}',
    '.rv-hint:hover{color:#8b3e10;}',
    '@keyframes rv-bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}',

    /* panel */
    '.rv-panel{width:340px;background:#faf6f0;border:1px solid rgba(255,255,255,.88);',
    'border-radius:20px;overflow:hidden;display:flex;flex-direction:column;',
    'box-shadow:0 28px 72px rgba(14,12,10,.18),0 1px 0 rgba(255,255,255,.8) inset;',
    'animation:rv-pop .26s cubic-bezier(.22,1,.36,1);}',
    '@keyframes rv-pop{from{transform:scale(.9) translateY(14px);opacity:0}to{transform:none;opacity:1}}',

    '.rv-ph{padding:14px 16px 10px;border-bottom:1px solid rgba(14,12,10,.07);',
    'display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none;}',
    '.rv-pt{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#0e0c0a;}',
    '.rv-pa{display:flex;gap:5px;}',
    '.rv-ib{width:26px;height:26px;border-radius:50%;background:rgba(14,12,10,.07);border:none;',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;',
    'font-size:12px;transition:background .15s;color:#0e0c0a;}',
    '.rv-ib:hover{background:rgba(14,12,10,.13);}',

    '.rv-pb{flex:1;overflow-y:auto;padding:10px 14px;max-height:300px;}',
    '.rv-empty{text-align:center;padding:36px 16px;color:rgba(30,27,23,.45);font-size:13px;}',
    '.rv-item{display:flex;align-items:center;gap:10px;padding:9px 0;',
    'border-bottom:1px solid rgba(14,12,10,.06);}',
    '.rv-item:last-child{border-bottom:none;}',
    '.rv-ie{font-size:22px;width:32px;text-align:center;flex-shrink:0;}',
    '.rv-ib2{flex:1;min-width:0;}',
    '.rv-in{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#0e0c0a;}',
    '.rv-ip{font-size:11px;color:#7a7168;}',
    '.rv-irm{width:22px;height:22px;border-radius:50%;background:rgba(14,12,10,.06);border:none;',
    'cursor:pointer;font-size:11px;color:#7a7168;display:flex;align-items:center;justify-content:center;',
    'transition:background .15s;flex-shrink:0;}',
    '.rv-irm:hover{background:rgba(14,12,10,.13);color:#0e0c0a;}',

    '.rv-pf{padding:12px 16px 14px;border-top:1px solid rgba(14,12,10,.07);}',
    '.rv-tot{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;}',
    '.rv-tl{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#7a7168;}',
    '.rv-ta{font-family:"Cormorant Garamond",Georgia,serif;font-size:24px;font-weight:600;',
    'letter-spacing:-.03em;color:#0e0c0a;}',
    '.rv-chk{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;',
    'min-height:42px;border-radius:999px;background:#0070ba;color:#fff;border:none;',
    'font-family:inherit;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;',
    'cursor:pointer;transition:background .2s;}',
    '.rv-chk:hover{background:#005c9e;}',

    /* shake + fall */
    '.rv-panel.rv-shaking{animation:rv-shake .13s linear 3;}',
    '@keyframes rv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}',
    '.rv-item.rv-fall{animation:rv-falling var(--dur,.55s) cubic-bezier(.55,.05,.67,.19) var(--del,0s) both;}',
    '@keyframes rv-falling{0%{transform:translateY(0) rotate(0deg);opacity:1;}',
    '100%{transform:translateY(600px) rotate(var(--rot,25deg));opacity:0;}}',

    /* dust particles */
    '.rv-dust{position:absolute;width:var(--s,6px);height:var(--s,6px);border-radius:50%;',
    'background:var(--c,rgba(192,112,48,.55));pointer-events:none;',
    'animation:rv-dust-fly var(--dur,.9s) ease-out var(--del,0s) both;}',
    '@keyframes rv-dust-fly{',
    '0%{transform:translate(0,0) scale(1);opacity:.8;}',
    '60%{opacity:.5;}',
    '100%{transform:translate(var(--tx,0px),var(--ty,-40px)) scale(0);opacity:0;}}'
  ].join('');

  /* ── Build ──────────────────────────────────────────── */
  function inject(){
    if(document.getElementById('rv-w')) return;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    var w = document.createElement('div');
    w.id = 'rv-w';

    var b = document.createElement('div');
    b.className = 'rv-bubble';
    b.setAttribute('role','button');
    b.setAttribute('aria-label','Carrello');
    b.setAttribute('tabindex','0');
    b.innerHTML = '🛒<span class="rv-badge rv-hide" id="rv-badge">0</span>';
    b.addEventListener('click', openPanel);
    b.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' ') openPanel(); });

    makeDraggable(w, b);
    w.appendChild(b);
    document.body.appendChild(w);
    el.wrap = w; el.bubble = b; el.badge = b.querySelector('#rv-badge');

    refresh();
    scheduleScuotimi();
  }

  /* ── Panel open/close ───────────────────────────────── */
  function openPanel(){
    if(isOpen) return;
    isOpen = true;
    cancelScuotimi(); // clear any pending timer

    var p = buildPanel();
    el.wrap.appendChild(p);
    el.panel = p;
    el.bubble.style.display = 'none';
  }

  function closePanel(){
    isOpen = false;
    cancelScuotimi();
    if(el.panel){ el.panel.remove(); el.panel = null; }
    el.bubble.style.display = '';
  }

  function buildPanel(){
    var p = document.createElement('div');
    p.className = 'rv-panel';
    p.innerHTML =
      '<div class="rv-ph" id="rv-drag-h">'
        +'<span class="rv-pt" style="display:flex;align-items:center;gap:4px">'
          +'🛒 Carrello'
          +'<button class="rv-hint" id="rv-hint" style="display:none">clicca</button>'
        +'</span>'
        +'<div class="rv-pa">'
          +'<button class="rv-ib" id="rv-min" title="Minimizza">&#x2013;</button>'
          +'<button class="rv-ib" id="rv-cls" title="Chiudi">&#x2715;</button>'
        +'</div>'
      +'</div>'
      +'<div class="rv-pb" id="rv-body"></div>'
      +'<div class="rv-pf" id="rv-foot" style="display:none">'
        +'<div class="rv-tot"><span class="rv-tl">Totale</span><span class="rv-ta" id="rv-ta">€ 0</span></div>'
        +'<button class="rv-chk" id="rv-chk">&#x1F4B3; Acquista con PayPal</button>'
      +'</div>';

    p.querySelector('#rv-min').addEventListener('click', closePanel);
    p.querySelector('#rv-cls').addEventListener('click', closePanel);
    p.querySelector('#rv-chk').addEventListener('click', function(){ window.location.href='checkout.html'; });

    /* hint: show "clicca" after 5s if cart has items */
    var hintBtn = p.querySelector('#rv-hint');
    if(hintBtn && cartCount() > 0){
      scuotiTimer = setTimeout(function(){
        if(el.panel && el.panel.querySelector('#rv-hint')){
          hintBtn.style.display = '';
        }
      }, 5000);
      hintBtn.addEventListener('click', function(){
        hintBtn.textContent = 'scuoti';
        enableShake();
      });
    }

    makePanelDraggable(p, p.querySelector('#rv-drag-h'));
    renderItems(p);
    return p;
  }

  function renderItems(panel){
    if(!panel) panel = el.panel;
    if(!panel) return;
    var body = panel.querySelector('#rv-body');
    var foot = panel.querySelector('#rv-foot');
    if(!body) return;

    var cart = load();
    if(cart.length === 0){
      body.innerHTML = '<div class="rv-empty"><p style="font-size:30px">🛒</p><p>Il carrello è vuoto</p></div>';
      if(foot) foot.style.display = 'none';
    } else {
      body.innerHTML = cart.map(function(p, i){
        var rot = (Math.random()*50-25).toFixed(1);
        return '<div class="rv-item" data-rvid="'+p.id+'" style="--rot:'+rot+'deg;--del:'+(i*.07)+'s">'
          +'<div class="rv-ie">'+(p.emoji||'📦')+'</div>'
          +'<div class="rv-ib2"><div class="rv-in">'+escHtml(p.name)+'</div><div class="rv-ip">€ '+p.price+'</div></div>'
          +'<button class="rv-irm" data-rm="'+p.id+'" aria-label="Rimuovi">×</button>'
          +'</div>';
      }).join('');
      body.querySelectorAll('[data-rm]').forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          removeItem(parseInt(btn.dataset.rm));
          // notify shop.html if open
          if(window.__rvShopCartUpdated) window.__rvShopCartUpdated();
        });
      });
      if(foot){
        foot.style.display = 'block';
        var ta = panel.querySelector('#rv-ta');
        if(ta) ta.textContent = '€ ' + cartTotal();
      }
    }
  }

  function refresh(){
    var n = cartCount();
    if(el.badge){
      el.badge.textContent = n;
      el.badge.className = 'rv-badge' + (n === 0 ? ' rv-hide' : '');
    }
    /* sync shop.html nav count button */
    var sc = document.getElementById('cartCount');
    if(sc){ sc.textContent = n; sc.classList.toggle('zero', n===0); }
    renderItems();
  }

  /* ── Scuotimi helpers ───────────────────────────────── */
  function scheduleScuotimi(){ /* timer now managed inside buildPanel */ }

  function cancelScuotimi(){
    clearTimeout(scuotiTimer);
    scuotiTimer = null;
  }

  function enableShake(){
    cancelScuotimi();
    shakeReady = true;

    /* visual cue: panel shakes briefly */
    if(el.panel){
      el.panel.classList.add('rv-shaking');
      setTimeout(function(){ if(el.panel) el.panel.classList.remove('rv-shaking'); }, 400);
    }

    /* mobile: device motion */
    function onMotion(e){
      if(!shakeReady) return;
      var a = e.accelerationIncludingGravity;
      if(a && Math.abs(a.x || 0) > 12){
        shakeReady = false;
        window.removeEventListener('devicemotion', onMotion);
        triggerFall();
      }
    }
    if(window.DeviceMotionEvent) window.addEventListener('devicemotion', onMotion);

    /* auto-reset after 8s se non viene scosso */
    setTimeout(function(){
      if(shakeReady){
        shakeReady = false;
        window.removeEventListener('devicemotion', onMotion);
      }
    }, 8000);
  }

  function spawnDust(){
    if(!el.bubble) return;
    var colors = ['rgba(192,112,48,.6)','rgba(139,62,16,.5)','rgba(212,180,140,.7)','rgba(160,90,30,.5)','rgba(230,200,160,.6)'];
    for(var i = 0; i < 18; i++){
      (function(i){
        var d = document.createElement('div');
        d.className = 'rv-dust';
        var angle = (Math.random() * 360) * Math.PI / 180;
        var dist = 18 + Math.random() * 32;
        var size = 3 + Math.random() * 7;
        var dur = 0.6 + Math.random() * 0.7;
        var del = Math.random() * 0.3;
        d.style.cssText = [
          '--s:'+size+'px',
          '--c:'+colors[Math.floor(Math.random()*colors.length)],
          '--tx:'+(Math.cos(angle)*dist).toFixed(1)+'px',
          '--ty:'+(Math.sin(angle)*dist - 20).toFixed(1)+'px',
          '--dur:'+dur.toFixed(2)+'s',
          '--del:'+del.toFixed(2)+'s',
          'left:50%','top:50%',
          'margin-left:'+(-size/2).toFixed(1)+'px',
          'margin-top:'+(-size/2).toFixed(1)+'px'
        ].join(';');
        el.bubble.appendChild(d);
        setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, (dur+del+0.1)*1000);
      })(i);
    }
  }

  function triggerFall(){
    if(!el.panel) return;
    el.panel.querySelectorAll('.rv-item').forEach(function(item){
      item.classList.add('rv-fall');
    });
    /* dust effect on bubble — appears when items "land" */
    setTimeout(spawnDust, 600);
    setTimeout(function(){
      var body = el.panel && el.panel.querySelector('#rv-body');
      if(body) body.innerHTML =
        '<div class="rv-empty" style="animation:rv-pop .4s ease">'
        +'<p style="font-size:30px">💫</p>'
        +'<p style="font-size:12px">Tutto a terra!<br>'
        +'<span style="font-size:10px;opacity:.55">I tuoi articoli sono ancora nel carrello</span></p>'
        +'</div>';
      var foot = el.panel && el.panel.querySelector('#rv-foot');
      if(foot) foot.style.display = 'none';
    }, 900);
  }

  /* ── PayPal ─────────────────────────────────────────── */
  function doPaypal(){
    var cart = load();
    if(!cart.length) return;
    var names = cart.map(function(p){ return p.name; }).join(', ');
    var tot = cart.reduce(function(s,p){ return s + p.price; }, 0);
    window.open(
      'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick'
      +'&business='+encodeURIComponent('ramacciatoluca@gmail.com')
      +'&item_name='+encodeURIComponent('Ramacciato Vintage: '+names)
      +'&amount='+tot+'&currency_code=EUR',
      '_blank','noopener'
    );
  }

  /* ── Draggable bubble ───────────────────────────────── */
  function makeDraggable(wrap, handle){
    var startX, startY, startR, startB, moved;
    handle.addEventListener('mousedown', function(e){
      startX = e.clientX; startY = e.clientY; moved = false;
      var r = wrap.getBoundingClientRect();
      startR = window.innerWidth - r.right;
      startB = window.innerHeight - r.bottom;
      function mm(e2){
        var dx = e2.clientX-startX, dy = e2.clientY-startY;
        if(Math.abs(dx)>5||Math.abs(dy)>5) moved = true;
        wrap.style.right = Math.max(8, Math.min(window.innerWidth-60, startR-dx))+'px';
        wrap.style.bottom = Math.max(8, Math.min(window.innerHeight-60, startB-dy))+'px';
      }
      function mu(){ document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu); }
      document.addEventListener('mousemove',mm);
      document.addEventListener('mouseup',mu);
    });
    /* prevent click when dragged */
    handle.addEventListener('click', function(e){ if(moved){ e.stopPropagation(); moved=false; } });
  }

  /* ── Draggable panel header ─────────────────────────── */
  function makePanelDraggable(panel, handle){
    var startX, startY, startR, startB;
    handle.addEventListener('mousedown', function(e){
      if(e.target.closest('button')) return;
      startX = e.clientX; startY = e.clientY;
      var wr = el.wrap.getBoundingClientRect();
      startR = window.innerWidth - wr.right;
      startB = window.innerHeight - wr.bottom;

      /* shake detection durante il drag */
      var dragHist = [], shakeTriggered = false;

      function mm(e2){
        var dx = e2.clientX-startX, dy = e2.clientY-startY;
        el.wrap.style.right  = Math.max(8, Math.min(window.innerWidth-350,  startR-dx))+'px';
        el.wrap.style.bottom = Math.max(8, Math.min(window.innerHeight-100, startB-dy))+'px';

        /* rileva scuotimento solo se l'easter egg è attivo */
        if(shakeReady && !shakeTriggered){
          var now = Date.now();
          dragHist.push({ x: e2.clientX, t: now });
          dragHist = dragHist.filter(function(h){ return now - h.t < 700; });
          if(dragHist.length >= 4){
            var rev = 0;
            for(var i = 2; i < dragHist.length; i++){
              var d1 = dragHist[i-1].x - dragHist[i-2].x;
              var d2 = dragHist[i].x   - dragHist[i-1].x;
              if(d1 * d2 < 0 && Math.abs(d2) > 5) rev++;
            }
            if(rev >= 3){
              shakeTriggered = true;
              shakeReady = false;
              document.removeEventListener('mousemove', mm);
              document.removeEventListener('mouseup', mu);
              triggerFall();
            }
          }
        }
      }
      function mu(){ document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu); }
      document.addEventListener('mousemove',mm);
      document.addEventListener('mouseup',mu);
      e.preventDefault();
    });
  }

  /* ── Utils ──────────────────────────────────────────── */
  function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ── Init ───────────────────────────────────────────── */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

})();
