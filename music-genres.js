(function(root){
const genres=["Rock", "Metal", "Punk", "Pop", "Italiano", "Spagnolo", "Indie", "Elettronica", "Techno", "Hip hop usa", "Rap europeo", "Rap italiano", "Jazz", "Colonne sonore"];
const slugs=['rock','metal','punk','pop','italiano','spagnolo','indie','elettronica','techno','hip-hop-usa','rap-europeo','rap-italiano','jazz','colonne-sonore'];
function genre(p){
 if(genres.includes(p.primaryGenre))return p.primaryGenre;
 const g=(Array.isArray(p.genres)?p.genres:[]).map(x=>String(x).toLowerCase());
 const text=g.join(' | ');
 for(const [label,re] of [['Colonne sonore',/soundtrack|stage & screen|colonn[ae] sonor/],['Metal',/metal|thrash|doom|grindcore/],['Punk',/punk/],['Techno',/techno/],['Indie',/indie/],['Jazz',/jazz/],['Rock',/rock/],['Pop',/pop/],['Elettronica',/electronic|elettronica/]])if(re.test(text))return label;
 return '';
}
function format(p){const f=String(p.formato||p.subcat||'').toLowerCase();if(/vinyl|vinil|\blp\b|33 giri|45 giri/.test(f))return 'vinili';if(/cassett|cassetta|\bmc\b|k7/.test(f))return 'musicassette';if(/\bcd\b|^cd-/.test(f))return 'cd';return '';}
root.rvMusicGenres=genres;root.rvPrimaryGenre=genre;
root.rvApplyMusicGenre=function(p){if(p.cat!=='musica')return;const f=format(p);if(!f)return;const g=genre(p);p.subcat=g?f+'-'+slugs[genres.indexOf(g)]:f;};
})(typeof window!=='undefined'?window:globalThis);
