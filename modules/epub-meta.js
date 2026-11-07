// 1.27.0 — Métadonnées bibliographiques d'un EPUB (éditeur, date, auteur, source) sans extraction sur disque.
// Lecture bornée des entrées ZIP, sans extraction sur le disque ni accès réseau.
const zlib=require('node:zlib'),path=require('node:path').posix;
function lireOpf(b){try{
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break}if(end<0)return null;
 const entries=new Map();let at=b.readUInt32LE(end+16),count=b.readUInt16LE(end+10);if(count>10000)return null;
 for(let j=0;j<count;j++){if(b.readUInt32LE(at)!==0x02014b50)return null;const n=b.readUInt16LE(at+28),extra=b.readUInt16LE(at+30),comment=b.readUInt16LE(at+32);entries.set(b.subarray(at+46,at+46+n).toString(),{method:b.readUInt16LE(at+10),size:b.readUInt32LE(at+24),packed:b.readUInt32LE(at+20),local:b.readUInt32LE(at+42),flags:b.readUInt16LE(at+8)});at+=46+n+extra+comment;}
 const read=(name,max)=>{const e=entries.get(name);if(!e||e.size>max||e.flags&1)return null;const a=e.local+30+b.readUInt16LE(e.local+26)+b.readUInt16LE(e.local+28);if(a+e.packed>b.length)return null;const raw=b.subarray(a,a+e.packed);return e.method===0?raw:e.method===8?zlib.inflateRawSync(raw,{maxOutputLength:max}):null;};
 const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
 const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1],decode(m[3])]));
 const container=read('META-INF/container.xml',1048576)?.toString();const packageName=attrs(container?.match(/<(?:\w+:)?rootfile\b[^>]*>/i)?.[0]||'')['full-path'];if(!packageName)return null;
 const opf=read(packageName,2097152)?.toString();return opf||null;}catch{return null}}
const DIFFUSEURS=/gutenberg|wikisource|wikimedia|feedbooks|ebooks ?libres|bibebook|ebooksgratuits|gallica|internet archive|archive\.org|ws-export|calibre|standard ?ebooks/i;
const texte=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
function dc(opf,tag){return [...opf.matchAll(new RegExp('<dc:'+tag+'\\b[^>]*>([\\s\\S]*?)</dc:'+tag+'>','gi'))].map(m=>texte(m[1])).filter(Boolean)}
/** Renvoie { editeur, sourceNumerique, annee, auteur, lieu } ; champs vides si inconnus. */
function metadonnees(b){const opf=lireOpf(b);if(!opf)return null;
 const editeurs=dc(opf,'publisher'),dates=dc(opf,'date'),auteurs=dc(opf,'creator'),sources=dc(opf,'source').concat(dc(opf,'identifier').filter(x=>/^https?:/i.test(x)));
 let editeur=editeurs.find(e=>!DIFFUSEURS.test(e))||'',lieu='';
 // Gutenberg et d'autres indiquent souvent l'édition papier d'origine : « Paris : Hachette, 1878 »
 for(const src of dc(opf,'source').filter(x=>!/^https?:/i.test(x))){const m=src.match(/^\s*([^:;,]{2,60}?)\s*:\s*([^,;]{2,120}?)\s*,\s*(?:\D{0,10})?(1[4-9]\d\d|20\d\d)/);if(m){lieu=m[1].trim();if(!editeur)editeur=m[2].trim();break}}
 let sourceNumerique=editeurs.find(e=>DIFFUSEURS.test(e))||'';
 if(!sourceNumerique){const s=sources.find(x=>DIFFUSEURS.test(x));if(s)sourceNumerique=/gutenberg/i.test(s)?'Project Gutenberg':/wikisource/i.test(s)?'Wikisource':/gallica/i.test(s)?'Gallica (BnF)':/archive\.org/i.test(s)?'Internet Archive':''}
 if(/gutenberg/i.test(sourceNumerique))sourceNumerique='Project Gutenberg';else if(/wikisource|ws-export/i.test(sourceNumerique))sourceNumerique='Wikisource';
 const an=dates.map(d=>Number((d.match(/\b(1[4-9]\d\d|20\d\d)\b/)||[])[1])).filter(Boolean);
 return {editeur:editeur.slice(0,200),sourceNumerique:sourceNumerique.slice(0,120),annee:an.length?Math.min(...an):null,auteur:(auteurs[0]||'').slice(0,200),lieu:lieu.slice(0,80)};}
module.exports={metadonnees,DIFFUSEURS};
