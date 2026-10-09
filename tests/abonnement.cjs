const assert=require('node:assert/strict');const PP=require('../lib/plopplop');const A=require('../modules/abonnement');
(async()=>{let serial=0,paid=false,amount;const db={commandesAbonnement:[],livres:[]},user={id:'alice',role:'apprenant'};
PP.passerelleActive=()=>true;PP.initierPaiement=async c=>{amount=c.montant;return {ok:true,urlPaiement:'https://plopplop.solutionip.app/test',transactionId:'test'}};PP.verifierPaiement=async()=>({ok:true,paye:paid});
async function call(route,body={},u=user){let result;assert(await A.route({url:'/api/abonnement/'+route,method:route==='statut'?'GET':'POST'},{},{db,utilisateur:u,json:(r,code,data)=>result={code,data},lireCorps:async()=>body,sauverDB:()=>{},uid:()=>String(++serial)}));return result}
assert.equal((await call('payer',{plan:'mensuel'},null)).code,401);assert.equal((await call('payer',{plan:'gratuit'})).code,400);
const cmd=await call('payer',{plan:'mensuel',montant:1});assert.equal(cmd.code,201);assert.equal(amount,500);assert(!A.actif(db,user));
assert.equal((await call('verifier/'+cmd.data.id,{}, {id:'bob'})).code,404);assert.equal((await call('verifier/'+cmd.data.id)).data.paye,false);assert(!A.actif(db,user));
paid=true;assert.equal((await call('verifier/'+cmd.data.id)).data.paye,true);assert(A.actif(db,user));const end=user.abonnementFin;await call('verifier/'+cmd.data.id);assert.equal(user.abonnementFin,end);
const annual=await call('payer',{plan:'annuel',montant:0});assert.equal(amount,5000);await call('verifier/'+annual.data.id);assert(new Date(user.abonnementFin)>new Date(end));
assert(!A.actif(db,{role:'apprenant',abonnementFin:'2000-01-01'}));assert(A.actif(db,{role:'bibliothecaire'}));
PP.verifierPaiement=async()=>({ok:false,error:'Échec passerelle'});const fail=await call('payer',{plan:'mensuel'});const last=user.abonnementFin;assert.equal((await call('verifier/'+fail.data.id)).code,502);assert.equal(user.abonnementFin,last);
console.log('Abonnements : tarifs, accès, isolation, confirmation et idempotence vérifiés.');})().catch(e=>{console.error(e);process.exitCode=1});
