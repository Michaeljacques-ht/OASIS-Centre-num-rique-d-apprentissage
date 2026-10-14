const normaliser=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function cle(l,type){if(type==='livres')return [normaliser(l.titre),normaliser(l.auteur),normaliser(l.edition),normaliser(l.langue||'Français')].join('|');return [normaliser(l.titre),normaliser(type==='medias'?l.type:l.genre),normaliser(l.auteur||l.source)].join('|')}
function meme(a,b,type){if(type==='livres'&&a.isbn&&b.isbn&&String(a.isbn).replace(/[^0-9X]/gi,'').length>=10&&String(a.isbn).replace(/[^0-9X]/gi,'')===String(b.isbn).replace(/[^0-9X]/gi,''))return true;return cle(a,type)===cle(b,type)}
const trouver=(liste,l,type)=>liste.find(x=>x.id!==l.id&&meme(x,l,type));
function groupes(db){const out=[];for(const type of ['livres','medias','ressources']){const groupes=[];for(const l of db[type]||[]){const g=groupes.find(g=>meme(g[0],l,type));if(g)g.push(l);else groupes.push([l])}for(const g of groupes.filter(g=>g.length>1))out.push({type,documents:g.map(l=>({id:l.id,titre:l.titre,auteur:l.auteur||l.source||'',edition:l.edition||'',isbn:l.isbn||''}))})}return out}
function fusionner(db,type,conserve,retire){const liste=db[type];const a=liste.find(x=>x.id===conserve),b=liste.find(x=>x.id===retire);if(!a||!b||a.id===b.id||!meme(a,b,type))throw Error('Ces documents ne sont pas des doublons identifiés.');db.doublonsArchives ||= [];db.doublonsArchives.push({type,document:b,conserve:a.id,date:new Date().toISOString()});
 const key=type==='livres'?'livreId':type==='medias'?'mediaId':null;
 if(key){for(const val of Object.values(db))if(Array.isArray(val))for(const row of val)if(row&&row[key]===b.id)row[key]=a.id;}
 if(type==='livres'){for(const e of db.ecoles||[])e.livresIds=[...new Set((e.livresIds||[]).map(id=>id===b.id?a.id:id))];a.notes=[...(a.notes||[]),...(b.notes||[])];a.nbLectures=(a.nbLectures||0)+(b.nbLectures||0);}
 for(const col of ['favoris','listeLecture','progressions','progressionsMedias']){const map=new Map();db[col]=(db[col]||[]).filter(row=>{const key=[row.utilisateurId,row.livreId||row.mediaId].join('|');const prev=map.get(key);if(!prev){map.set(key,row);return true}if(col==='progressions'){prev.pourcentage=Math.max(prev.pourcentage||0,row.pourcentage||0);prev.secondesLecture=(prev.secondesLecture||0)+(row.secondesLecture||0);prev.termine=!!(prev.termine||row.termine)}if(col==='progressionsMedias')prev.secondes=Math.max(prev.secondes||0,row.secondes||0);return false})}
 db[type]=liste.filter(x=>x.id!==b.id);return a;
}
module.exports={normaliser,meme,trouver,groupes,fusionner};
