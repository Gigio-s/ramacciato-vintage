/* Ramacciato Vintage: link ai marketplace (Vinted, Wallapop, Subito) nell'header e nel menu mobile.
   Un solo file per tutte le pagine: per cambiare un link si modifica solo qui. */
(function(){
  var RV_MARKET=[
    {nome:'Vinted',per:'Abbigliamento',url:'https://www.vinted.it/member/54548378-lucaramacciato',col:'#09b1ba'},
    {nome:'Wallapop',per:'Spagna e Barcellona',url:'https://www.wallapop.com/user/lucar-407171230',col:'#13c1ac'},
    {nome:'Subito',per:'Mobili e oggetti ingombranti',url:'https://www.subito.it/utente/108942323',col:'#f9423a'}
  ];
  function css(){
    if(document.getElementById('rvMkCss'))return;
    var s=document.createElement('style');s.id='rvMkCss';
    s.textContent=
      '.rv-mk{position:relative}'+
      '.rv-mk-btn{height:30px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.5);font:inherit;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(11,37,69,.85);cursor:pointer;white-space:nowrap;transition:background .2s,color .2s}'+
      '.rv-mk-btn:hover,.rv-mk.open .rv-mk-btn{background:rgba(255,255,255,.75);color:#0b2545}'+
      '.rv-mk-btn i{width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:translateY(-2px) rotate(45deg);transition:transform .2s}'+
      '.rv-mk.open .rv-mk-btn i{transform:translateY(1px) rotate(-135deg)}'+
      '.rv-mk-pan{position:absolute;top:calc(100% + 12px);right:0;width:268px;padding:8px;border-radius:18px;background:#fff;box-shadow:0 18px 44px rgba(11,37,69,.22);border:1px solid rgba(11,37,69,.08);opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility .18s;z-index:60}'+
      '.rv-mk.open .rv-mk-pan{opacity:1;visibility:visible;transform:none}'+
      '.rv-mk-tit{margin:6px 10px 6px;font-size:9.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#5b7290}'+
      '.social .rv-mk-pan a,.rv-mk-pan a{width:auto;height:auto;display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;border:none;background:none;text-align:left;letter-spacing:0;text-transform:none;font-weight:400;color:#0b2545}'+
      '.social .rv-mk-pan a:hover,.rv-mk-pan a:hover{background:#eef5fd}'+
      '.rv-mk-dot{flex:0 0 34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:900}'+
      '.rv-mk-txt{display:flex;flex-direction:column;gap:2px;min-width:0}'+
      '.rv-mk-txt b{font-size:13.5px;font-weight:800}'+
      '.rv-mk-txt small{font-size:11.5px;color:#5b7290}'+
      '.rv-mk-arr{margin-left:auto;font-size:13px;color:#5b7290}'+
      '#mobileMenu .rv-mk-mob{margin:18px 0 0;padding:0;border:none}'+
      '#mobileMenu .rv-mk-mob p{margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(11,37,69,.7)}'+
      '.rv-mk-mob div{display:flex;flex-wrap:wrap;gap:8px}'+
      '#mobileMenu .rv-mk-mob a{display:inline-flex!important;align-items:center;gap:7px;width:auto!important;padding:8px 12px!important;opacity:1!important;transform:none!important;justify-content:flex-start!important;margin:0!important;border:none!important;border-radius:999px;background:rgba(255,255,255,.88);font-size:12.5px!important;font-weight:800!important;letter-spacing:0!important;text-transform:none!important;line-height:1.2!important;color:#0b2545!important}'+'#mobileMenu .rv-mk-mob a::after,#mobileMenu .rv-mk-mob a::before{content:none!important;display:none!important}'+
      '#mobileMenu .rv-mk-mob a small{font-size:11px!important;font-weight:600;color:#5b7290}'+
      '#mobileMenu .mob-logo{width:60px!important;margin:22px auto 0!important;padding-bottom:64px!important}'+'@media(max-height:820px){#mobileMenu .mob-logo{display:none!important}#mobileMenu .rv-mk-mob{margin-bottom:60px}}'+'#mobileMenu .rv-mk-mob a span{width:9px;height:9px;border-radius:50%}';
    document.head.appendChild(s);
  }
  function link(m,inner){var a=document.createElement('a');a.href=m.url;a.target='_blank';a.rel='noopener';a.innerHTML=inner;return a;}
  function init(){
    css();
    var soc=document.querySelector('header .social');
    if(soc&&!soc.querySelector('.rv-mk')){
      var li=document.createElement('li');li.className='rv-mk';
      li.innerHTML='<button type="button" class="rv-mk-btn" aria-expanded="false" aria-haspopup="true">Anche su<i aria-hidden="true"></i></button><div class="rv-mk-pan" role="menu"><p class="rv-mk-tit">Ci trovi anche su</p></div>';
      var pan=li.querySelector('.rv-mk-pan');
      RV_MARKET.forEach(function(m){pan.appendChild(link(m,'<span class="rv-mk-dot" style="background:'+m.col+'" aria-hidden="true">'+m.nome.charAt(0)+'</span><span class="rv-mk-txt"><b>'+m.nome+'</b><small>'+m.per+'</small></span><span class="rv-mk-arr" aria-hidden="true">&#8599;</span>'));});
      var cart=soc.querySelector('.cart-btn');var ref=cart?cart.closest('li'):null;
      soc.insertBefore(li,ref);
      var btn=li.querySelector('.rv-mk-btn');
      var set=function(o){li.classList.toggle('open',o);btn.setAttribute('aria-expanded',o?'true':'false');};
      btn.addEventListener('click',function(e){e.stopPropagation();set(!li.classList.contains('open'));});
      document.addEventListener('click',function(e){if(!li.contains(e.target))set(false);});
      document.addEventListener('keydown',function(e){if(e.key==='Escape')set(false);});
    }
    var mob=document.getElementById('mobileMenu');
    if(mob&&!mob.querySelector('.rv-mk-mob')){
      var box=document.createElement('div');box.className='rv-mk-mob';box.innerHTML='<p>Ci trovi anche su</p><div></div>';
      var row=box.querySelector('div');
      RV_MARKET.forEach(function(m){row.appendChild(link(m,'<span style="background:'+m.col+'" aria-hidden="true"></span>'+m.nome+' <small>'+m.per+'</small>'));});
      var soc2=mob.querySelector('.mob-soc');if(soc2&&soc2.nextSibling)mob.insertBefore(box,soc2.nextSibling);else mob.appendChild(box);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
