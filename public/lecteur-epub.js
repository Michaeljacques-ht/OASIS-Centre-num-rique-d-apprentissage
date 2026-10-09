window.OasisEpub=(()=>{
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const resolve=(base,href)=>{const parts=(base.slice(0,base.lastIndexOf('/')+1)+decodeURIComponent(href.split('#')[0])).split('/'),out=[];for(const p of parts){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p)}return out.join('/')};
 let cleanup=()=>{};
 return {close(){cleanup()},async open(livre,token,mount,onclose){cleanup();let stopped=false,zip,index=0,size=18,chapters=[],urls=[];cleanup=()=>{stopped=true;urls.forEach(u=>URL.revokeObjectURL(u));urls=[]};
 mount.innerHTML=`<div class="voile"><div class="modale epub-lecteur" role="dialog" aria-modal="true" aria-label="Lecteur EPUB"><div class="epub-entete"><h3>${E(livre.titre)}</h3><button class="fermer" id="epubClose" aria-label="Fermer">✕</button></div><div class="epub-commandes"><button class="mini-btn" id="epubPrev">← Précédent</button><select id="epubChapitres" aria-label="Chapitre"></select><button class="mini-btn" id="epubNext">Suivant →</button><button class="mini-btn" id="epubSmall" aria-label="Réduire le texte">A−</button><button class="mini-btn" id="epubBig" aria-label="Agrandir le texte">A+</button></div><p id="epubStatus" role="status">Chargement de l’EPUB…</p><iframe id="epubFrame" title="Contenu du chapitre" sandbox="" referrerpolicy="no-referrer"></iframe></div></div>`;
 const $=id=>mount.querySelector('#'+id);$('epubClose').onclick=()=>{cleanup();onclose()};
 try{
 const response=await fetch('/api/livres/'+encodeURIComponent(livre.id)+'/epub',{headers:token?{Authorization:'Bearer '+token}:{}});if(!response.ok){const d=await response.json().catch(()=>({}));throw Error(d.erreur||'EPUB indisponible.')}
 zip=await JSZip.loadAsync(await response.arrayBuffer());if(stopped)return;
 let total=0;for(const entry of Object.values(zip.files)){total+=entry._data?.uncompressedSize||0;if(total>80*1024*1024)throw Error('Ce document est trop volumineux pour le lecteur en ligne.')}
 const read=async path=>{const f=zip.file(path);if(!f)throw Error('Fichier EPUB incomplet : '+path);if((f._data?.uncompressedSize||0)>10*1024*1024)throw Error('Chapitre trop volumineux.');return f.async('string')};
 const xml=s=>new DOMParser().parseFromString(s,'application/xml');const container=xml(await read('META-INF/container.xml'));const opfPath=container.getElementsByTagNameNS('*','rootfile')[0]?.getAttribute('full-path');if(!opfPath)throw Error('Structure EPUB invalide.');
 const opf=xml(await read(opfPath)),items=new Map([...opf.getElementsByTagNameNS('*','item')].map(x=>[x.getAttribute('id'),x]));
 chapters=[...opf.getElementsByTagNameNS('*','itemref')].filter(x=>x.getAttribute('linear')!=='no').map(x=>items.get(x.getAttribute('idref'))).filter(Boolean).map(x=>resolve(opfPath,x.getAttribute('href')));if(!chapters.length)throw Error('Aucun chapitre lisible.');
 $('epubChapitres').innerHTML=chapters.map((p,i)=>`<option value="${i}">Chapitre ${i+1}</option>`).join('');
 let serial=0;async function render(){const task=++serial;const current=index;const path=chapters[current];$('epubStatus').textContent='Chargement du chapitre…';try{
 const doc=new DOMParser().parseFromString(await read(path),'text/html');doc.querySelectorAll('script,iframe,object,embed,form,input,button,meta,base,audio,video,svg').forEach(n=>n.remove());
 const css=[];for(const link of [...doc.querySelectorAll('link')]){const href=link.getAttribute('href');if(link.rel==='stylesheet'&&href&&!/^(?:[a-z]+:|\/\/)/i.test(href)){const f=zip.file(resolve(path,href));if(f&&(f._data?.uncompressedSize||0)<1048576)css.push(await f.async('string'))}link.remove()}
 for(const node of doc.querySelectorAll('*'))for(const a of [...node.attributes])if(/^on/i.test(a.name)||['srcset','action','formaction','target','xlink:href'].includes(a.name))node.removeAttribute(a.name);
 for(const img of doc.querySelectorAll('img')){const href=img.getAttribute('src')||'';img.removeAttribute('src');if(!/^(?:[a-z]+:|\/\/)/i.test(href)){const f=zip.file(resolve(path,href));if(f&&(f._data?.uncompressedSize||0)<5*1024*1024){const u=URL.createObjectURL(await f.async('blob'));urls.push(u);img.src=u}}}
 doc.querySelectorAll('a').forEach(a=>{const h=a.getAttribute('href')||'';if(!h.startsWith('#'))a.removeAttribute('href')});
 if(stopped||task!==serial)return;const policy="default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; font-src 'none';";
 $('epubFrame').srcdoc=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join('\n').replace(/<\/style/gi,'') } body{margin:0;padding:24px;line-height:1.8;color:#10243e;background:white;font-size:${size}px!important;overflow-wrap:anywhere}p,li{font-size:inherit!important}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${doc.body.innerHTML}</body></html>`;
 $('epubChapitres').value=current;$('epubPrev').disabled=current===0;$('epubNext').disabled=current===chapters.length-1;$('epubStatus').textContent=`Chapitre ${current+1} sur ${chapters.length}`;
 }catch(e){if(!stopped)$('epubStatus').textContent=e.message}}
 $('epubPrev').onclick=()=>{if(index>0){index--;render()}};$('epubNext').onclick=()=>{if(index<chapters.length-1){index++;render()}};$('epubChapitres').onchange=e=>{index=Number(e.target.value);render()};$('epubSmall').onclick=()=>{size=Math.max(14,size-2);render()};$('epubBig').onclick=()=>{size=Math.min(32,size+2);render()};await render();
 }catch(e){if(!stopped)$('epubStatus').textContent=e.message}
 }};
})();
