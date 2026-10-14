/* Documents partagés : stockage local, aucune publication automatique. */
(function(scope){
 const ouvrir=()=>new Promise((ok,non)=>{const r=indexedDB.open('oasis-partages',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>non(r.error)});
 async function operation(mode,action){const db=await ouvrir();return new Promise((ok,non)=>{const tx=db.transaction('documents',mode);let result;const r=action(tx.objectStore('documents'));r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();ok(result)};tx.onerror=tx.onabort=()=>{db.close();non(tx.error)}})}
 const liste=async()=>{const rows=await operation('readonly',s=>s.getAll());const now=Date.now();for(const r of rows)if(now-r.date>86400000)await supprimer(r.id);return rows.filter(r=>now-r.date<=86400000)};
 const supprimer=id=>operation('readwrite',s=>s.delete(id));
 async function ajouter(files){if(!files.length||files.length>10)throw Error('Partagez entre 1 et 10 documents.');for(const f of files)if(!/\.(pdf|epub)$/i.test(f.name)||!f.size||f.size>50*1024*1024)throw Error('PDF ou EPUB uniquement, 50 Mo maximum par fichier.');const rows=await liste();if(rows.reduce((n,r)=>n+r.file.size,0)+files.reduce((n,f)=>n+f.size,0)>200*1024*1024)throw Error('La file de partage est limitée à 200 Mo. Importez ou retirez les documents en attente.');const db=await ouvrir();await new Promise((ok,non)=>{const tx=db.transaction('documents','readwrite');for(const file of files)tx.objectStore('documents').put({id:crypto.randomUUID(),file,date:Date.now()});tx.oncomplete=ok;tx.onerror=tx.onabort=()=>non(tx.error)}).finally(()=>db.close());}
 scope.OasisPartages={liste,supprimer,ajouter};
})(typeof window==='undefined'?self:window);
