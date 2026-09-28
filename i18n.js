/* i18n.js - layer lingua IT/ES/EN per Ramacciato Vintage
   Additivo: NON modifica il layout desktop italiano (default).
   - Stato lingua in localStorage 'rv_lang' + supporto parametro ?lang=
   - Traduzioni testo:        data-i18n-es="..."  data-i18n-en="..."   (innerHTML)
   - Traduzioni placeholder:  data-i18n-ph-es="..." data-i18n-ph-en="..."
   - Visibilita condizionata: data-show-lang="es en"  /  data-hide-lang="it"
   - Se un banner .rv-i18n-notice diventa visibile, aggiunge al <body> la
     classe 'rv-notice-on' (per lasciare spazio sotto l'header fisso via CSS).
   - Selettore lingua fisso (pillola in basso a sinistra) iniettato via JS.
*/
(function(){
  var LANGS=['it','es','en'];
  var KEY='rv_lang';

  function currentLang(){
    try{
      var q=new URLSearchParams(location.search).get('lang');
      if(q&&LANGS.indexOf(q)>-1){ localStorage.setItem(KEY,q); return q; }
    }catch(e){}
    try{ var s=localStorage.getItem(KEY); if(s&&LANGS.indexOf(s)>-1) return s; }catch(e){}
    return 'it';
  }
  var lang=currentLang();
  function inLang(v){ return (v||'').split(/[\s,]+/).indexOf(lang)>-1; }
  function pick(el,base){
    if(lang==='it') return el.getAttribute(base+'-it');
    return el.getAttribute(base+'-'+lang);
  }

  function apply(){
    document.documentElement.lang=lang;

    // Testo (innerHTML). L'italiano resta il testo scritto nell'HTML.
    document.querySelectorAll('[data-i18n-es],[data-i18n-en]').forEach(function(el){
      if(!el.hasAttribute('data-i18n-it')) el.setAttribute('data-i18n-it', el.innerHTML);
      var t=pick(el,'data-i18n');
      if(t===null||typeof t==='undefined') t=el.getAttribute('data-i18n-it');
      if(t!==null&&typeof t!=='undefined') el.innerHTML=t;
    });

    // Placeholder degli input/textarea
    document.querySelectorAll('[data-i18n-ph-es],[data-i18n-ph-en]').forEach(function(el){
      if(!el.hasAttribute('data-i18n-ph-it')) el.setAttribute('data-i18n-ph-it', el.getAttribute('placeholder')||'');
      var t=pick(el,'data-i18n-ph');
      if(t===null||typeof t==='undefined') t=el.getAttribute('data-i18n-ph-it');
      if(t!==null&&typeof t!=='undefined') el.setAttribute('placeholder',t);
    });

    // Visibilita condizionata + rilevamento banner
    var noticeOn=false;
    document.querySelectorAll('[data-show-lang]').forEach(function(el){
      var show=inLang(el.getAttribute('data-show-lang'));
      el.style.display = show ? '' : 'none';
      if(show && el.classList.contains('rv-i18n-notice')) noticeOn=true;
    });
    document.querySelectorAll('[data-hide-lang]').forEach(function(el){
      el.style.display = inLang(el.getAttribute('data-hide-lang')) ? 'none' : '';
    });
    document.body.classList.toggle('rv-notice-on', noticeOn);
  }

  function setLang(l){
    if(LANGS.indexOf(l)<0||l===lang) return;
    try{ localStorage.setItem(KEY,l); }catch(e){}
    location.reload();
  }
  window.rvLang={ get:function(){return lang;}, set:setLang };

  function buildSelector(){
    if(document.getElementById('rv-lang')) return;
    var wrap=document.createElement('div');
    wrap.id='rv-lang';
    wrap.setAttribute('role','group');
    wrap.setAttribute('aria-label','Lingua / Idioma / Language');
    // z-index 30: sopra i contenuti (1) e l'header (20), ma SOTTO il cursore
    // custom (50) cosi il cursore resta visibile passando sulla pillola.
    wrap.style.cssText='position:fixed;left:14px;bottom:14px;z-index:30;display:flex;gap:2px;'
      +'background:rgba(11,37,69,.85);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'
      +'border-radius:999px;padding:3px;font-family:Archivo,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.28)';
    LANGS.forEach(function(l){
      var b=document.createElement('button');
      b.type='button'; b.textContent=l.toUpperCase();
      var active=(l===lang);
      b.style.cssText='border:none;cursor:pointer;border-radius:999px;padding:5px 9px;'
        +'font-size:10px;font-weight:800;letter-spacing:.08em;font-family:inherit;'
        +'transition:background .18s,color .18s;'
        +(active?'background:#4a90e0;color:#0b2545;':'background:transparent;color:#d6e6f7;');
      b.addEventListener('click',function(){ setLang(l); });
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
  }

  function init(){ apply(); buildSelector(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
