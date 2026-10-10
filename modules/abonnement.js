const fs=require('fs');const path=require('path');const PP=require('../lib/plopplop');const {PDFDocument,PDFName}=require('./pdf-lib');const locks=new Set();
const E=require('./ecoles');const formules=require('./formules-ecoles');
const actif=(db,u)=>!!u&&u.actif!==false&&(u.role==='bibliothecaire'||new Date(u.abonnementFin||0)>new Date()||E.active((db.ecoles||[]).find(e=>e.id===u.ecoleId)));
module.exports.actif=actif;
module.exports.route=async(req,res,c)=>{
 const {db,utilisateur:u,json,lireCorps,sauverDB,uid}=c;const url=new URL(req.url,'http://localhost'),s=url.pathname.split('/').filter(Boolean);const m=req.method;
 const school=(db.ecoles||[]).find(e=>e.id===u?.ecoleId);
 const owner=u?.role==='admin_etablissement'&&school;
 const send=(status,data)=>{json(res,status,data);return true};
 if(s[1]==='abonnement'){
  if(!u)return send(401,{erreur:'Créez un compte ou connectez-vous pour vous abonner.'});
  db.commandesAbonnement ||= [];
  if(s[2]==='statut'&&m==='GET')return send(200,{actif:actif(db,u),fin:(owner?school.abonnementFin:(u.abonnementFin||school?.abonnementFin))||null,etablissement:!!owner,configure:PP.passerelleActive(),commandes:db.commandesAbonnement.filter(x=>x.utilisateurId===u.id).slice(-10).map(x=>({id:x.id,statut:x.statut,plan:x.plan,formule:x.formule,montant:x.montant}))});
  if(s[2]==='payer'&&m==='POST'){
   const b=await lireCorps(req);if(!['mensuel','annuel','etablissement'].includes(b.plan))return send(400,{erreur:'Choisissez un abonnement mensuel ou annuel.'});
   if(b.plan==='etablissement'&&!owner)return send(403,{erreur:'Seul l’administrateur de l’établissement peut régler son abonnement.'});
   const formule=b.plan==='etablissement'?(b.formule||school.formule||'petite'):null;
   const offre=Object.hasOwn(formules,formule)?formules[formule]:null;
   if(b.plan==='etablissement'&&!offre)return send(400,{erreur:'Choisissez une formule établissement valide.'});
   if(offre&&E.effectif(db,school)>offre.limiteEleves)return send(409,{erreur:'Cette formule ne couvre pas tous vos élèves actifs.'});
   if(offre&&E.active(school)&&offre.limiteEleves<E.quota(school))return send(409,{erreur:'Une baisse de formule est possible après expiration, avec un effectif compatible.'});
   if(!PP.passerelleActive())return send(503,{erreur:'Les paiements ne sont pas encore configurés par l’administration.'});
   const commande={id:'ABO-'+uid(),utilisateurId:u.id,plan:b.plan,ecoleId:b.plan==='etablissement'?school.id:null,formule,limiteEleves:offre?.limiteEleves,montant:b.plan==='etablissement'?offre.montant:b.plan==='mensuel'?500:5000,statut:'en_attente',creeLe:new Date().toISOString()};db.commandesAbonnement.push(commande);sauverDB();
   const r=await PP.initierPaiement({reference:commande.id,montant:commande.montant,methode:'all'});
   if(!r.ok){commande.statut='erreur';sauverDB();return send(502,{erreur:r.error})}
   try{if(new URL(r.urlPaiement).protocol!=='https:')throw Error()}catch{commande.statut='erreur';sauverDB();return send(502,{erreur:'Adresse de paiement invalide.'})}
   commande.transactionId=r.transactionId;sauverDB();return send(201,{id:commande.id,url:r.urlPaiement});
  }
  if(s[2]==='verifier'&&s[3]&&m==='POST'){
   const cmd=db.commandesAbonnement.find(x=>x.id===s[3]&&x.utilisateurId===u.id);if(!cmd)return send(404,{erreur:'Commande introuvable.'});
   const target=cmd.plan==='etablissement'?(db.ecoles||[]).find(e=>e.id===cmd.ecoleId):u;
   if(!target)return send(404,{erreur:'Établissement introuvable.'});
   const suite=cmd.plan==='etablissement'?'/ecole':'/?espace=1';
   if(cmd.statut==='paye')return send(200,{paye:true,fin:target.abonnementFin,suite});
   const offreConfirmee=cmd.plan==='etablissement'?formules[cmd.formule||'petite']:null;
   if(offreConfirmee&&E.active(target)&&offreConfirmee.limiteEleves<E.quota(target))return send(409,{erreur:'Une formule plus élevée est déjà active. Contactez OASIS pour régulariser ce paiement.'});
   if(offreConfirmee&&E.effectif(db,target)>offreConfirmee.limiteEleves)return send(409,{erreur:'Effectif supérieur à la formule payée. Contactez OASIS pour régulariser ce paiement.'});
   if(locks.has(cmd.id))return send(200,{paye:false});locks.add(cmd.id);
   try{const r=await PP.verifierPaiement(cmd.id);if(!r.ok)return send(502,{erreur:r.error});if(!r.paye)return send(200,{paye:false});
    const start=new Date(Math.max(Date.now(),new Date(target.abonnementFin||0).getTime()||0));const day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()+(cmd.plan==='mensuel'?1:12));const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();start.setUTCDate(Math.min(day,last));
    if(offreConfirmee){target.formule=offreConfirmee.id;target.limiteEleves=offreConfirmee.limiteEleves;}
    target.abonnementFin=start.toISOString();cmd.statut='paye';cmd.payeLe=new Date().toISOString();cmd.transactionConfirmee=r.infos?.transactionId||null;sauverDB();return send(200,{paye:true,fin:target.abonnementFin,suite});
   }finally{locks.delete(cmd.id)}
  }
  return send(404,{erreur:'Route introuvable.'});
 }
 if(s[1]==='livres'&&s[2]&&s[3]==='apercu'&&m==='GET'){
  const l=db.livres.find(l=>l.id===s[2]);if(!l)return send(404,{erreur:'Livre introuvable.'});
  if(l.pdf){const file=path.join(__dirname,'../data/pdfs',l.id+'.pdf');try{const source=await PDFDocument.load(fs.readFileSync(file));const out=await PDFDocument.create();const indices=Array.from({length:Math.min(5,source.getPageCount())},(_,i)=>i);indices.forEach(i=>source.getPage(i).node.delete(PDFName.of('Annots')));const pages=await out.copyPages(source,indices);pages.forEach(p=>out.addPage(p));const bytes=await out.save();res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store','X-Apercu':'5-pages'});res.end(Buffer.from(bytes));return true}catch{return send(422,{erreur:'Aperçu indisponible pour ce PDF. Un abonnement permet d’accéder au document original.'})}}
  if(l.contenu){const pages=String(l.contenu).match(/[\s\S]{1,2500}/g)||[];return send(200,{titre:l.titre,auteur:l.auteur,contenu:pages.slice(0,5).join('\n\n'),apercu:true,pages:Math.min(5,pages.length)})}
  return send(402,{erreur:'Pour consulter cet EPUB, prenez un abonnement. L’aperçu de cinq pages est disponible pour les PDF et les documents texte.',abonnement:true});
 }
 if(s[1]==='livres'&&s[2]&&['pdf','epub','lire'].includes(s[3])&&m==='GET'&&!actif(db,u))return send(402,{erreur:'Abonnement requis pour lire le document complet.',abonnement:true});
 return false;
};
