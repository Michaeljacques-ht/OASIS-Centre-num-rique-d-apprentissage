window.OasisApercuDocument=(()=>{
 let fermer=()=>{};
 return {close(){fermer()},async open(livre,token,mount){fermer();let closed=false,doc;fermer=()=>{closed=true;doc?.destroy();window.OasisEpub?.close()};
 if(!livre.pdf&&livre.epub){const chargement=OasisEpub.open(livre,token,mount,()=>{mount.innerHTML='';});const voile=mount.querySelector('.voile');if(voile)voile.className='epub-apercu-integre';await chargement;return;}
 if(!livre.pdf)return;
 mount.innerHTML='<div class="apercu-commandes"><button class="mini-btn" id="docPrev">← Page précédente</button><span id="docPage" role="status">Chargement…</span><button class="mini-btn" id="docNext">Page suivante →</button></div><div class="apercu-defilement"><canvas id="docCanvas" aria-label="Page du document"></canvas></div>';
 const $=id=>mount.querySelector('#'+id);let index=1,busy=false;
 try{pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.js';const r=await fetch('/api/livres/'+encodeURIComponent(livre.id)+'/pdf',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Document indisponible.');doc=await pdfjsLib.getDocument({data:await r.arrayBuffer(),isEvalSupported:false}).promise;if(closed){doc.destroy();return}
 async function render(){if(busy||closed)return;busy=true;$('docPrev').disabled=true;$('docNext').disabled=true;try{const page=await doc.getPage(index);if(closed)return;const vp=page.getViewport({scale:1.3}),canvas=$('docCanvas');canvas.width=vp.width;canvas.height=vp.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;if(!closed){$('docPage').textContent='Page '+index+' / '+doc.numPages;mount.querySelector('.apercu-defilement').scrollTop=0}}finally{busy=false;if(!closed){$('docPrev').disabled=index===1;$('docNext').disabled=index===doc.numPages}}}
 $('docPrev').onclick=()=>{if(!busy&&index>1){index--;render()}};$('docNext').onclick=()=>{if(!busy&&index<doc.numPages){index++;render()}};await render();
 }catch(e){if(!closed)$('docPage').textContent=e.message}
 }};
})();
