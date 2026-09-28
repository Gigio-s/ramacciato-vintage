/* oggetti3d.js - oggetti 3D leggeri in puro CSS per Ramacciato Vintage
   Nessun file da scaricare: ogni oggetto e' fatto di facce HTML in 3D.
   Uso:  <div class="o3d-host" data-o3d="vinile" data-o3d-label="Metal"></div>
         RV3D.monta(document)   (monta tutti gli host nella pagina)
   Tipi: vinile, cd, cassetta, cuffie, libri, dvd, ciak, gioco, giochi, carte, radio, fotocamera */
(function(){
'use strict';
if(window.RV3D)return;

var CSS=[
'.o3d-host{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;perspective:560px;overflow:visible}',
'.o3d-stage{position:relative;width:120px;height:120px;flex:0 0 120px;transform:scale(var(--k,1));transform-style:preserve-3d}',
'.o3d-rot{position:absolute;inset:0;transform-style:preserve-3d;animation:o3d-sway 7s ease-in-out infinite;will-change:transform}',
'.o3d-shadow{position:absolute;left:18px;right:18px;bottom:-4px;height:18px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.35),rgba(0,0,0,0) 70%);transform:translateZ(-40px);filter:blur(2px)}',
'.o3d-b{position:absolute;left:50%;top:50%;transform-style:preserve-3d}',
'.o3d-b>i{position:absolute;display:block;left:0;top:0;overflow:hidden}',
'.o3d-p{position:absolute;left:50%;top:50%;transform-style:preserve-3d}',
'@keyframes o3d-sway{0%{transform:rotateX(-10deg) rotateY(-32deg)}50%{transform:rotateX(-14deg) rotateY(32deg)}100%{transform:rotateX(-10deg) rotateY(-32deg)}}',
'@keyframes o3d-spin{from{transform:rotateX(-12deg) rotateY(0deg)}to{transform:rotateX(-12deg) rotateY(360deg)}}',
'.cat-item:hover .o3d-rot,.cat-item.active .o3d-rot,.subcat-tile:hover .o3d-rot,.o3d-host.gira .o3d-rot{animation:o3d-spin 5s linear infinite}',
'.o3d-t{position:absolute;left:0;right:0;text-align:center;font-family:Archivo,Arial,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:.06em;line-height:1;white-space:nowrap;overflow:hidden}',
'@media(prefers-reduced-motion:reduce){.o3d-rot{animation:none!important;transform:rotateX(-12deg) rotateY(-24deg)}}'
].join('\n');

function inietta(){if(document.getElementById('o3d-css'))return;var s=document.createElement('style');s.id='o3d-css';s.textContent=CSS;document.head.appendChild(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];});}
function scuro(bg,a){return 'linear-gradient(rgba(0,0,0,'+a+'),rgba(0,0,0,'+a+')),'+bg;}
function chiaro(bg,a){return 'linear-gradient(rgba(255,255,255,'+a+'),rgba(255,255,255,'+a+')),'+bg;}

/* parallelepipedo: w,h,d dimensioni; x,y,z posizione del centro; r rotazioni extra; f facce */
function box(o){
  var w=o.w,h=o.h,d=o.d,f=o.f||{},base=o.bg||'#888';
  var tr='translate3d('+(o.x||0)+'px,'+(o.y||0)+'px,'+(o.z||0)+'px) '+(o.r||'');
  function faccia(nome,W,H,t,sh){var v=f[nome];var bg=(v&&v.bg)||(sh===0?base:(sh>0?scuro(base,sh):chiaro(base,-sh)));
    return '<i style="width:'+W+'px;height:'+H+'px;'+t+';background:'+bg+';'+((v&&v.css)||'')+'">'+((v&&v.html)||'')+'</i>';}
  return '<div class="o3d-b" style="width:'+w+'px;height:'+h+'px;margin:'+(-h/2)+'px 0 0 '+(-w/2)+'px;transform:'+tr+'">'
    +faccia('front',w,h,'transform:translateZ('+d/2+'px)',0)
    +faccia('back',w,h,'transform:rotateY(180deg) translateZ('+d/2+'px)',.25)
    +faccia('right',d,h,'left:'+(w-d)/2+'px;transform:rotateY(90deg) translateZ('+w/2+'px)',.18)
    +faccia('left',d,h,'left:'+(w-d)/2+'px;transform:rotateY(-90deg) translateZ('+w/2+'px)',.28)
    +faccia('top',w,d,'top:'+(h-d)/2+'px;transform:rotateX(90deg) translateZ('+h/2+'px)',-.12)
    +faccia('bottom',w,d,'top:'+(h-d)/2+'px;transform:rotateX(-90deg) translateZ('+h/2+'px)',.35)
    +'</div>';
}
/* piano singolo (con retro opzionale) */
function piano(o){
  var tr='translate3d('+(o.x||0)+'px,'+(o.y||0)+'px,'+(o.z||0)+'px) '+(o.r||'');
  var st='position:absolute;left:0;top:0;width:'+o.w+'px;height:'+o.h+'px;'+(o.css||'');
  return '<div class="o3d-p" style="width:'+o.w+'px;height:'+o.h+'px;margin:'+(-o.h/2)+'px 0 0 '+(-o.w/2)+'px;transform:'+tr+'">'
    +'<i style="'+st+';background:'+o.bg+';backface-visibility:hidden">'+(o.html||'')+'</i>'
    +'<i style="'+st+';background:'+(o.bgRetro||o.bg)+';transform:rotateY(180deg);backface-visibility:hidden">'+(o.htmlRetro||'')+'</i></div>';
}

var PAL={blu:['#1d4f91','#4a90e0','#bfdcfa'],rosso:['#7a1d1d','#d0453b','#f6c1a8'],verde:['#1f4d3a','#3f9b6e','#cdebd9'],viola:['#3a1f5c','#8a4fd0','#e0c9fa'],
  oro:['#6b4a12','#d29b2e','#f6e2b0'],nero:['#141414','#3a3a3a','#bdbdbd'],teal:['#0f4a4f','#2aa3a8','#c6f0ef'],rosa:['#6d1f4a','#e05599','#fbd0e6'],arancio:['#7a3b0c','#e87d2a','#fbd9b8']};
function pal(n){return PAL[n]||PAL.blu;}

function copertina(c,testo,tsize){
  return 'radial-gradient(circle at 28% 30%,'+c[2]+' 0,rgba(255,255,255,0) 38%),radial-gradient(circle at 75% 78%,'+c[1]+' 0,rgba(0,0,0,0) 45%),linear-gradient(135deg,'+c[0]+','+c[1]+')';
}
function etichetta(testo,px,col,y){return testo?'<b class="o3d-t" style="top:'+y+'px;font-size:'+px+'px;color:'+col+'">'+esc(testo)+'</b>':'';}

var TIPI={
vinile:function(o){var c=pal(o.colore||'viola');
  var disco='radial-gradient(circle,'+c[1]+' 0 16%,#0d0d0d 16.5% 18%,rgba(0,0,0,0) 18%),repeating-radial-gradient(circle,#101010 0 1.2px,#222 1.2px 2.4px)';
  var riflesso='<span style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,rgba(255,255,255,0) 0 12%,rgba(255,255,255,.18) 16%,rgba(255,255,255,0) 22% 62%,rgba(255,255,255,.14) 66%,rgba(255,255,255,0) 72%)"></span>';
  return piano({w:84,h:84,x:30,y:0,z:-1,bg:disco,css:'border-radius:50%',html:riflesso,htmlRetro:riflesso})
    +box({w:88,h:88,d:3,x:-10,bg:copertina(c),f:{front:{bg:copertina(c),html:etichetta(o.label,9,'#fff',72)},back:{bg:scuro(c[0],.1)}}});},
cd:function(o){var c=pal(o.colore||'blu');
  var disco='radial-gradient(circle,rgba(0,0,0,0) 0 9%,#e8e8e8 9.5% 12%,rgba(255,255,255,.2) 12.5% 30%,rgba(0,0,0,0) 30%),conic-gradient(from 20deg,#cfd8e0,#f4d9f0,#d6f2ff,#fff3c4,#e2d6ff,#cfd8e0)';
  var cerniera='<span style="position:absolute;left:0;top:0;bottom:0;width:13%;background:linear-gradient(90deg,#2a2c30,#5c6066 20%,#1e1f22 40%,#45484d 70%,#18191b)"></span>';
  var plastica='<span style="position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.35) 0,rgba(255,255,255,0) 30%,rgba(255,255,255,0) 60%,rgba(255,255,255,.12) 68%,rgba(255,255,255,0) 78%)"></span>';
  var fronte='<span style="position:absolute;right:2px;top:2px;bottom:2px;width:84%;background:'+copertina(c)+'">'+etichetta(o.label,8,'#fff',58)+'</span>'+cerniera+plastica;
  return piano({w:72,h:72,x:22,y:-2,z:-1,bg:disco,css:'border-radius:50%'})
    +box({w:92,h:80,d:7,x:-6,bg:'rgba(170,185,200,.55)',f:{front:{bg:'#111',html:fronte},back:{bg:scuro(c[0],.2)},left:{bg:c[0]}}});},
cassetta:function(o){var c=pal(o.colore||'arancio');
  var fronte='<span style="position:absolute;left:8%;right:8%;top:10%;height:52%;border-radius:4px;background:linear-gradient(180deg,#f6efe0 0 30%,'+c[1]+' 30% 44%,#f6efe0 44%)">'+etichetta(o.label||'C-60',7,'#222',4)+'</span>'
    +'<span style="position:absolute;left:30%;right:30%;top:36%;height:16%;border-radius:3px;background:#2a2a2a;box-shadow:inset 0 0 0 1px #555"></span>'
    +'<span style="position:absolute;left:24%;top:34%;width:13px;height:13px;border-radius:50%;background:radial-gradient(circle,#ddd 0 30%,#555 32% 40%,#eee 42%)"></span>'
    +'<span style="position:absolute;right:24%;top:34%;width:13px;height:13px;border-radius:50%;background:radial-gradient(circle,#ddd 0 30%,#555 32% 40%,#eee 42%)"></span>'
    +'<span style="position:absolute;left:18%;right:18%;bottom:6%;height:16%;background:#1b1b1b;clip-path:polygon(8% 0,92% 0,100% 100%,0 100%)"></span>';
  return box({w:100,h:64,d:12,bg:'#2b2b2b',f:{front:{bg:'#2e2e2e',html:fronte},back:{bg:'#262626'}}});},
cuffie:function(o){
  var arco='<span style="position:absolute;inset:0;border:7px solid #222;border-bottom:0;border-radius:40px 40px 0 0"></span>';
  return piano({w:76,h:50,y:-16,bg:'transparent',html:arco,htmlRetro:arco})
    +box({w:14,h:32,d:26,x:-38,y:14,bg:'#2a2a2a',f:{right:{bg:'radial-gradient(circle,#555,#222)'}}})
    +box({w:14,h:32,d:26,x:38,y:14,bg:'#2a2a2a',f:{left:{bg:'radial-gradient(circle,#555,#222)'}}});},
libri:function(o){
  var pagine='repeating-linear-gradient(0deg,#f3ecd9 0 1.5px,#d9cfb5 1.5px 2.5px)';
  var pagineV='repeating-linear-gradient(90deg,#f3ecd9 0 1.5px,#d9cfb5 1.5px 2.5px)';
  function libro(w,d,y,col,r){var c=pal(col);var dorso='<span style="position:absolute;left:0;right:0;top:30%;height:2px;background:#e8c46a"></span><span style="position:absolute;left:0;right:0;bottom:30%;height:2px;background:#e8c46a"></span>';
    return box({w:w,h:14,d:d,y:y,r:r,bg:c[1],f:{front:{bg:c[0],html:dorso},back:{bg:pagine},left:{bg:pagineV},right:{bg:pagineV},top:{bg:c[1]},bottom:{bg:c[0]}}});}
  return libro(86,60,20,'rosso','rotateY(4deg)')+libro(78,56,5,'verde','rotateY(-8deg)')+libro(70,52,-10,'blu','rotateY(10deg)');},
dvd:function(o){var c=pal(o.colore||'rosso');
  var pellicola='<span style="position:absolute;left:0;right:0;top:0;height:10px;background:repeating-linear-gradient(90deg,#111 0 5px,#eee 5px 7px,#111 7px 10px)"></span>';
  var fronte=pellicola+'<span style="position:absolute;inset:10px 0 0;background:'+copertina(c)+'"></span>'+etichetta(o.label||'DVD',8,'#fff',80)
    +'<span style="position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.28) 0,rgba(255,255,255,0) 32%)"></span>';
  return box({w:68,h:96,d:10,bg:'#141414',f:{front:{bg:'#141414',html:fronte},left:{bg:c[0],html:'<b class="o3d-t" style="top:44px;font-size:6px;color:#fff;transform:rotate(90deg)">DVD</b>'}}});},
gioco:function(o){var c=pal(o.colore||'blu');
  var fronte='<span style="position:absolute;left:0;right:0;top:0;height:16px;background:'+c[0]+'">'+etichetta(o.label||'GAME',8,'#fff',4)+'</span>'
    +'<span style="position:absolute;inset:16px 0 0;background:'+copertina(c)+'"></span>'
    +'<span style="position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.3) 0,rgba(255,255,255,0) 32%)"></span>';
  return box({w:66,h:84,d:9,bg:c[0],f:{front:{bg:'#111',html:fronte},back:{bg:scuro(c[0],.15)}}});},
giochi:function(o){
  return TIPI.gioco({colore:'blu',label:'GAME'}).replace('translate3d(0px,0px,0px) ','translate3d(-26px,4px,-10px) rotateY(18deg) ')
    +TIPI.gioco({colore:'verde',label:'RETRO'}).replace('translate3d(0px,0px,0px) ','translate3d(0px,0px,0px) ')
    +TIPI.gioco({colore:'rosso',label:'PLAY'}).replace('translate3d(0px,0px,0px) ','translate3d(26px,4px,-10px) rotateY(-18deg) ');},
carte:function(o){
  function carta(x,z,rz,col){var c=pal(col);
    var fronte='<span style="position:absolute;inset:4px;border-radius:4px;background:'+copertina(c)+';box-shadow:inset 0 0 0 2px rgba(255,255,255,.6)"></span>'
      +'<span style="position:absolute;left:50%;top:40%;width:22px;height:22px;margin:-11px 0 0 -11px;background:#fff6c9;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"></span>'
      +'<span style="position:absolute;left:8px;right:8px;bottom:10px;height:10px;border-radius:2px;background:rgba(255,255,255,.75)"></span>';
    var retro='repeating-linear-gradient(45deg,#1d4f91 0 4px,#16407a 4px 8px)';
    return piano({w:54,h:76,x:x,z:z,r:'rotateZ('+rz+'deg)',bg:'#f4f4f4',css:'border-radius:6px',html:fronte,bgRetro:retro});}
  return carta(-20,-6,-14,'viola')+carta(0,0,0,'oro')+carta(20,6,14,'teal');},
ciak:function(o){
  var righe='repeating-linear-gradient(-45deg,#111 0 8px,#f2f2f2 8px 16px)';
  var fronte='<span style="position:absolute;left:6px;right:6px;top:8px;height:1px;background:rgba(255,255,255,.5)"></span>'
    +'<span style="position:absolute;left:6px;right:6px;top:26px;height:1px;background:rgba(255,255,255,.5)"></span>'
    +'<b class="o3d-t" style="top:12px;font-size:7px;color:#fff;opacity:.85">SCENA · CIAK</b>'+etichetta(o.label||'FILM',9,'#fff',34);
  return box({w:92,h:60,d:6,y:8,bg:'#1a1a1a',f:{front:{bg:'#1a1a1a',html:fronte}}})
    +box({w:92,h:13,d:6,y:-30,r:'rotateZ(-14deg)',bg:righe,f:{front:{bg:righe},back:{bg:righe}}})
    +box({w:92,h:10,d:6,y:-17,bg:righe,f:{front:{bg:righe}}});},
radio:function(o){
  var griglia='radial-gradient(circle,#2a2a2a 0 1.2px,rgba(0,0,0,0) 1.4px) 0 0/5px 5px,#8a8a8a';
  var fronte='<span style="position:absolute;left:8px;top:10px;width:44px;height:44px;border-radius:50%;background:'+griglia+';box-shadow:inset 0 0 0 3px #555"></span>'
    +'<span style="position:absolute;right:8px;top:12px;width:38px;height:18px;border-radius:3px;background:linear-gradient(#f5e9c8,#e6d3a0);box-shadow:inset 0 0 0 1px #9a8a60">'
    +'<span style="position:absolute;left:3px;right:3px;top:8px;height:1px;background:repeating-linear-gradient(90deg,#6b5a2a 0 1px,rgba(0,0,0,0) 1px 4px)"></span><span style="position:absolute;left:55%;top:2px;bottom:2px;width:1px;background:#c0392b"></span></span>'
    +'<span style="position:absolute;right:30px;bottom:10px;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#eee,#666)"></span>'
    +'<span style="position:absolute;right:10px;bottom:10px;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#eee,#666)"></span>';
  var legno='linear-gradient(90deg,#6b3f1f,#8a5a2f 40%,#5e3519)';
  return box({w:104,h:64,d:32,y:6,bg:legno,f:{front:{bg:'#b99a6a',html:fronte}}})
    +box({w:70,h:5,d:6,y:-32,bg:'#2a2a2a'})+box({w:5,h:10,d:6,x:-33,y:-28,bg:'#2a2a2a'})+box({w:5,h:10,d:6,x:33,y:-28,bg:'#2a2a2a'});},
fotocamera:function(o){
  var pelle='radial-gradient(circle,#2a2a2a 0 .8px,rgba(0,0,0,0) 1px) 0 0/3px 3px,#1d1d1d';
  var fronte='<span style="position:absolute;left:0;right:0;top:0;height:14px;background:linear-gradient(#e8e8e8,#a9a9a9)"></span>'
    +'<span style="position:absolute;right:10px;top:3px;width:14px;height:8px;border-radius:2px;background:linear-gradient(#bfe0f5,#6a8ea6)"></span>';
  var lente='radial-gradient(circle,#0c1522 0 30%,#2e4a6b 34%,#0c1522 44%,#777 48% 56%,#2a2a2a 58% 70%,#bdbdbd 72% 100%)';
  return box({w:96,h:58,d:30,y:6,bg:pelle,f:{front:{bg:pelle,html:fronte},top:{bg:'linear-gradient(#e8e8e8,#b5b5b5)'}}})
    +box({w:40,h:40,d:14,y:10,z:22,bg:'#2a2a2a',f:{front:{bg:lente,css:'border-radius:50%'}},r:''})
    +box({w:22,h:10,d:12,x:-26,y:-26,bg:'linear-gradient(#e8e8e8,#a9a9a9)'});}
};

function html(tipo,opz){opz=opz||{};var f=TIPI[tipo]||TIPI.cd;
  return '<div class="o3d-stage"><div class="o3d-shadow"></div><div class="o3d-rot">'+f(opz)+'</div></div>';}

function scala(host){var st=host.querySelector('.o3d-stage');if(!st)return;var r=host.getBoundingClientRect();var m=Math.min(r.width,r.height)||88;st.style.setProperty('--k',(m/150).toFixed(3));}
function monta(root){inietta();(root||document).querySelectorAll('.o3d-host[data-o3d]').forEach(function(h){
  if(!h.firstElementChild)h.innerHTML=html(h.getAttribute('data-o3d'),{label:h.getAttribute('data-o3d-label')||'',colore:h.getAttribute('data-o3d-colore')||''});
  scala(h);});}
var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){document.querySelectorAll('.o3d-host').forEach(scala);},150);});

window.RV3D={html:html,monta:monta,tipi:Object.keys(TIPI),host:function(tipo,label,colore){return '<div class="o3d-host" data-o3d="'+esc(tipo)+'" data-o3d-label="'+esc(label||'')+'" data-o3d-colore="'+esc(colore||'')+'"></div>';}};
if(document.readyState!=='loading')monta(document);else document.addEventListener('DOMContentLoaded',function(){monta(document);});
})();
