const assert=require('node:assert/strict');const E=require('../modules/ecoles'),A=require('../modules/abonnement'),PP=require('../lib/plopplop');
(async()=>{
let serial=0,paid=false,montant;
const db={ecoles:[],utilisateurs:[],sessions:{},livres:[{id:'book',titre:'Livre scolaire'}],progressions:[],progressionsMedias:[],medias:[],commandesAbonnement:[]};
async function call(path,method='GET',body={},user=null){let r;assert(await E.route({url:'/api/ecoles/'+path,method,headers:{}},{},{db,utilisateur:user,json:(res,code,data)=>r={code,data},lireCorps:async()=>body,lireBinaire:async()=>Buffer.from('invalid'),sauverDB:()=>{},uid:()=>String(++serial),hashMdp:p=>({hash:p})}));return r}
async function abo(path,body={},user){let r;assert(await A.route({url:'/api/abonnement/'+path,method:'POST'},{},{db,utilisateur:user,json:(res,code,data)=>r={code,data},lireCorps:async()=>body,sauverDB:()=>{},uid:()=>String(++serial)}));return r}
const school=async(n)=>{const r=await call('inscription','POST',{nom:'Responsable '+n,nomEcole:'École '+n,email:n+'@ecole.ht',motDePasse:'secret123',role:'bibliothecaire'});assert.equal(r.code,201);const u=db.utilisateurs.find(x=>x.id===r.data.utilisateur.id);assert.equal(u.role,'admin_etablissement');return u};
const u=await school('alpha'),v=await school('beta');const e=db.ecoles.find(x=>x.id===u.ecoleId),f=db.ecoles.find(x=>x.id===v.ecoleId);
assert.equal((await call('membres')).code,401);assert.equal((await call('membres','GET',{},u)).code,402);
assert.equal((await call('parametres','PUT',{nom:'Nouvelle école',ecoleId:f.id},u)).code,200);assert.equal(f.nom,'École beta');
PP.passerelleActive=()=>true;PP.initierPaiement=async c=>{montant=c.montant;return{ok:true,urlPaiement:'https://plopplop.solutionip.app/test'}};PP.verifierPaiement=async()=>({ok:true,paye:paid});
assert.equal((await abo('payer',{plan:'etablissement'},v)).code,201);
const cmd=await abo('payer',{plan:'etablissement',montant:1},u);assert.equal(cmd.code,201);assert.equal(montant,50000);
assert(!A.actif(db,u));assert.equal((await abo('verifier/'+cmd.data.id,{},u)).data.paye,false);
paid=true;assert.equal((await abo('verifier/'+cmd.data.id,{},v)).code,404);
const confirmed=await abo('verifier/'+cmd.data.id,{},u);assert.equal(confirmed.data.suite,'/ecole');assert(E.active(e));const end=e.abonnementFin;await abo('verifier/'+cmd.data.id,{},u);assert.equal(e.abonnementFin,end);assert.equal(u.abonnementFin,undefined);
const child=await call('membres','POST',{nom:'Élève A',email:'enfant@ecole.ht',classe:'NS1',motDePasse:'secret123',role:'bibliothecaire'},u);assert.equal(child.code,201);assert.equal(child.data.role,'apprenant');const pupil=db.utilisateurs.find(x=>x.id===child.data.id);assert(A.actif(db,pupil));
const lib=(await call('membres','POST',{nom:'Bibliothécaire',email:'biblio@ecole.ht',motDePasse:'secret123',role:'bibliothecaire_ecole'},u)).data;assert.equal(lib.role,'bibliothecaire_ecole');assert.equal((await call('membres','POST',{nom:'Autre',email:'autre@ecole.ht',motDePasse:'secret123',role:'bibliothecaire_ecole'},lib)).code,403);
f.abonnementFin=e.abonnementFin;assert.equal((await call('membres/'+pupil.id,'PUT',{actif:false},v)).code,404);assert.equal((await call('membres','GET',{},v)).data.length,1);
assert.equal((await call('membres','GET',{},pupil)).code,403);assert.equal((await abo('payer',{plan:'etablissement'},pupil)).code,403);
assert.equal((await call('catalogue','PUT',{livresIds:['unknown']},u)).code,400);assert.equal((await call('catalogue','PUT',{livresIds:['book']},u)).code,200);
const t=(await call('travaux','POST',{titre:'Lire le premier chapitre',livreId:'book',classe:'NS1'},u)).data;assert.equal((await call('travaux/'+t.id,'DELETE',{},v)).code,404);assert.equal((await call('mon-espace','GET',{},pupil)).data.travaux.length,1);
db.progressions.push({utilisateurId:pupil.id,livreId:'book',pourcentage:75});assert.equal((await call('lectures','GET',{},u)).data.lectures,1);assert.equal((await call('lectures','GET',{},v)).data.lectures,0);
assert.equal((await call('image/logo','POST',{},u)).code,400);
assert.equal((await call('membres/'+pupil.id,'PUT',{actif:false},u)).code,200);assert(!A.actif(db,pupil));
pupil.actif=true;e.abonnementFin='2000-01-01';assert(!A.actif(db,pupil));assert.equal((await call('lectures','GET',{},u)).code,402);
console.log('Établissements : création, rôles, séparation des écoles, élèves, lectures, tarif 50 000 HTG, activation et expiration vérifiés.');
})().catch(e=>{console.error(e);process.exitCode=1});
