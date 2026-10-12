const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),B=require('../modules/base-json');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'oasis-db-')),file=path.join(root,'db.json'),data=n=>({utilisateurs:[{id:'u'}],livres:[{id:'l',titre:n}],sessions:{}});
try{
 assert.equal(B.charger(file),null);B.sauver(file,data('initial'));B.sauver(file,data('nouveau'));assert.equal(B.charger(file).livres[0].titre,'nouveau');assert.equal(B.lire(file+'.bak').livres[0].titre,'initial');
 fs.writeFileSync(file,'{"livres":[{"titre":"diffi');assert.equal(B.charger(file).livres[0].titre,'initial');assert(fs.readdirSync(root).some(x=>x.includes('corrompu')));
 const rename=fs.renameSync;fs.renameSync=(a,b)=>{if(b===file)throw Error('Écriture interrompue');return rename(a,b)};try{assert.throws(()=>B.sauver(file,data('interrompu')))}finally{fs.renameSync=rename}assert.equal(B.lire(file).livres[0].titre,'initial');
 fs.unlinkSync(file);assert.equal(B.charger(file).livres[0].titre,'interrompu');
 for(const name of [file,file+'.tmp',file+'.bak',file+'.bak.2',file+'.bak.3'])fs.writeFileSync(name,'invalid');assert.throws(()=>B.charger(file),/Aucune copie valide/);assert.equal(fs.readFileSync(file,'utf8'),'invalid');
 console.log('Base JSON : écritures atomiques, interruption, restauration et conservation des fichiers corrompus vérifiées.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
