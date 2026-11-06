const fs=require('fs');const path=require('path');const PP=require('../lib/plopplop');const {PDFDocument,PDFName}=require('./pdf-lib');const locks=new Set();
const E=require('./ecoles');const formules=require('./formules-ecoles');
const actif=(db,u)=>!!u&&u.actif!==false&&(u.role==='bibliothecaire'||require('./essai').actif(u)||new Date(u.abonnementFin||0)>new Date()||new Date(u.accesOffertFin||0)>new Date()||E.active((db.ecoles||[]).find(e=>e.id===u.ecoleId)));
module.exports.actif=actif;
// 1.24.0 : chaque don d'accès confirmé apparaît aussi dans la liste des dons (reçu, totaux, tableau de bord)
function enregistrerDon(db,cmd,u,school){db.dons ||= [];if(db.dons.some(d=>d.id===cmd.id))return;const annee=new Date().getUTCFullYear();db.compteurRecusDons ||= {};db.compteurRecusDons[annee]=(db.compteurRecusDons[annee]||0)+1;
 db.dons.push({id:cmd.id,montant:cmd.montant,nom:cmd.plan==='etablissement'?(school?.nom||u.nom):u.nom,email:u.email,telephone:'',affectation:'acces',message:cmd.plan==='etablissement'?'Don d’établissement — '+(formules[cmd.formule]?.nom||cmd.formule):'Don d’accès '+(cmd.plan==='mensuel'?'mensuel':'annuel'),anonyme:false,utilisateurId:u.id,statut:'paye',creeLe:cmd.creeLe,payeLe:cmd.payeLe,numeroRecu:`REC-DON-${annee}-${String(db.compteurRecusDons[annee]).padStart(4,'0')}`,transactionConfirmee:cmd.transactionConfirmee,donAcces:true});}
module.exports.enregistrerDon=enregistrerDon;
module.exports.route=async(req,res,c)=>{
 const {db,utilisateur:u,json,lireCorps,sauverDB,uid}=c;const url=new URL(req.url,'http://localhost'),s=url.pathname.split('/').filter(Boolean);const m=req.method;
 const school=(db.ecoles||[]).find(e=>e.id===u?.ecoleId);
 const owner=u?.role==='admin_etablissement'&&school;
 const send=(status,data)=>{json(res,status,data);return true};
 if(s[1]==='abonnement'){
  if(!u)return send(401,{erreur:'Créez un compte ou connectez-vous pour faire votre don d’accès.'});
  db.commandesAbonnement ||= [];
  if(s[2]==='statut'&&m==='GET')return send(200,{offre:require('./profils-abonnement').offre(db,u),...require('./essai').info(school||u),actif:actif(db,u),fin:(owner?school.abonnementFin:(u.abonnementFin||school?.abonnementFin))||school?.essaiFin||u.essaiFin||null,etablissement:!!owner,configure:PP.passerelleActive(),commandes:db.commandesAbonnement.filter(x=>x.utilisateurId===u.id).slice(-10).map(x=>({id:x.id,statut:x.statut,plan:x.plan,formule:x.formule,montant:x.montant}))});
  if(s[2]==='payer'&&m==='POST'){
   const b=await lireCorps(req);if(!['mensuel','annuel','etablissement'].includes(b.plan))return send(400,{erreur:'Choisissez un don d’accès mensuel ou annuel.'});
   if(b.plan==='etablissement'&&!owner)return send(403,{erreur:'Seul l’administrateur de l’établissement peut faire le don de l’établissement.'});
   const formule=b.plan==='etablissement'?(b.formule||school.formule||'petite'):null;
   const offre=Object.hasOwn(formules,formule)?formules[formule]:null;
   if(b.plan==='etablissement'&&!offre)return send(400,{erreur:'Choisissez un palier de don valide.'});
   if(offre&&E.effectif(db,school)>offre.limiteEleves)return send(409,{erreur:'Ce palier ne couvre pas tous vos élèves actifs.'});
   if(offre&&E.active(school)&&offre.limiteEleves<E.quota(school))return send(409,{erreur:'Un palier inférieur est possible après expiration, avec un effectif compatible.'});
   const offreProfil=require('./profils-abonnement').offre(db,u);
   if(b.plan!=='etablissement'&&u.role==='apprenant'&&!u.ecoleId&&!offreProfil)return send(409,{erreur:'Complétez votre situation avant de faire votre don d’accès.'});
   // 1.24.0 : l'accès s'obtient par un don ; le montant indiqué est un minimum, le donateur peut donner davantage
   const minimum=b.plan!=='etablissement'&&offreProfil?offreProfil[b.plan]:require('./tarifs').lire(db)[b.plan==='etablissement'?formule:b.plan];
   const montantDon=b.montant===undefined||b.montant===''||b.montant===null?minimum:Number(b.montant);
   if(!Number.isSafeInteger(montantDon)||montantDon<minimum||montantDon>10000000)return send(400,{erreur:'Le don doit être un nombre entier d’au moins '+minimum.toLocaleString('fr-FR')+' HTG pour ouvrir l’accès choisi.'});
   const commande={type:'don-acces',profilTarif:offreProfil?.categorie||null,id:'ABO-'+uid(),utilisateurId:u.id,plan:b.plan,ecoleId:b.plan==='etablissement'?school.id:null,formule,limiteEleves:offre?.limiteEleves,minimum,montant:montantDon,statut:'en_attente',creeLe:new Date().toISOString()};
   if(!PP.passerelleActive())return send(503,{erreur:'Les dons en ligne ne sont pas encore configurés par l’administration.'});
   db.commandesAbonnement.push(commande);sauverDB();
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
    const start=new Date(Math.max(Date.now(),new Date(target.essaiFin||0).getTime()||0,new Date(target.abonnementFin||0).getTime()||0));const debutPeriode=start.toISOString();const day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()+(cmd.plan==='mensuel'?1:12));const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();start.setUTCDate(Math.min(day,last));
    if(offreConfirmee){target.formule=offreConfirmee.id;target.limiteEleves=offreConfirmee.limiteEleves;}
    target.abonnementDebut=target.abonnementDebut||debutPeriode;target.abonnementFin=start.toISOString();cmd.abonnementDebut=debutPeriode;cmd.abonnementFin=target.abonnementFin;cmd.statut='paye';cmd.payeLe=new Date().toISOString();cmd.transactionConfirmee=r.infos?.transactionId||null;enregistrerDon(db,cmd,u,school);sauverDB();return send(200,{paye:true,fin:target.abonnementFin,suite});
   }finally{locks.delete(cmd.id)}
  }
  return send(404,{erreur:'Route introuvable.'});
 }
 if(s[1]==='livres'&&s[2]&&s[3]==='apercu'&&m==='GET'){
  const l=db.livres.find(l=>l.id===s[2]);if(!l)return send(404,{erreur:'Livre introuvable.'});
  if(l.pdf){const file=path.join(__dirname,'../data/pdfs',l.id+'.pdf');try{const source=await PDFDocument.load(fs.readFileSync(file));const out=await PDFDocument.create();const indices=Array.from({length:Math.min(5,source.getPageCount())},(_,i)=>i);indices.forEach(i=>source.getPage(i).node.delete(PDFName.of('Annots')));const pages=await out.copyPages(source,indices);pages.forEach(p=>out.addPage(p));const bytes=await out.save();res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store','X-Apercu':'5-pages'});res.end(Buffer.from(bytes));return true}catch{return send(422,{erreur:'Aperçu indisponible pour ce PDF. Un abonnement permet d’accéder au document original.'})}}
  if(l.contenu){const pages=String(l.contenu).match(/[\s\S]{1,2500}/g)||[];return send(200,{titre:l.titre,auteur:l.auteur,contenu:pages.slice(0,5).join('\n\n'),apercu:true,pages:Math.min(5,pages.length)})}
  return send(402,{erreur:'Pour consulter cet EPUB, faites un don d’accès. L’aperçu de cinq pages est disponible pour les PDF et les documents texte.',abonnement:true});
 }
 if(s[1]==='livres'&&s[2]&&['pdf','epub','lire'].includes(s[3])&&m==='GET'&&!actif(db,u))return send(402,{erreur:'Un don d’accès est requis pour lire le document complet.',abonnement:true});
 return false;
};
