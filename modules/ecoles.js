const fs=require('node:fs'),path=require('node:path');
const roles=['admin_etablissement','bibliothecaire_ecole'];
const active=e=>!!e&&new Date(e.abonnementFin||0)>new Date();
const publicUser=u=>({id:u.id,nom:u.nom,email:u.email,role:u.role,classe:u.classe||'',ecoleId:u.ecoleId||null,actif:u.actif!==false});
module.exports={active,roles,publicUser,async route(req,res,c){
 const {db,utilisateur:u,json,lireCorps,lireBinaire,sauverDB,uid,hashMdp}=c;
 const url=new URL(req.url,'http://localhost'),s=url.pathname.split('/').filter(Boolean),m=req.method;
 if(s[1]!=='ecoles')return false;
 db.ecoles ||= [];db.travauxEcoles ||= [];
 const send=(code,data)=>{json(res,code,data);return true};
 const texte=(v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
 if(s[2]==='inscription'&&m==='POST'){
  const b=await lireCorps(req),nom=texte(b.nom),nomEcole=texte(b.nomEcole),email=texte(b.email).toLowerCase();
  if(!nom||!nomEcole||!/^\S+@\S+\.\S+$/.test(email)||typeof b.motDePasse!=='string'||b.motDePasse.length<8)return send(400,{erreur:'Nom du responsable, établissement, email et mot de passe de 8 caractères minimum requis.'});
  if(db.utilisateurs.some(x=>x.email.toLowerCase()===email))return send(409,{erreur:'Cet email possède déjà un compte. Utilisez un email distinct pour le responsable de l’établissement.'});
  const e={id:uid(),nom:nomEcole,adresse:'',description:'',telephone:'',email,livresIds:[],creeLe:new Date().toISOString()};
  const user={id:uid(),nom,email,role:'admin_etablissement',ecoleId:e.id,actif:true,...hashMdp(b.motDePasse),creeLe:new Date().toISOString()};
  e.responsableId=user.id;db.ecoles.push(e);db.utilisateurs.push(user);const jeton=uid()+uid();db.sessions[jeton]=user.id;sauverDB();return send(201,{jeton,utilisateur:publicUser(user)});
 }
 // Branding is public; student lists, reading histories and settings are private.
 if(s[2]&&['logo','banniere'].includes(s[3])&&m==='GET'){
  const e=db.ecoles.find(e=>e.id===s[2]);const kind=s[3],file=path.join(__dirname,'../data/ecoles',s[2]+'-'+kind);
  if(!e||!e[kind]||!fs.existsSync(file))return send(404,{erreur:'Image introuvable.'});
  res.writeHead(200,{'Content-Type':e[kind+'Mime']||'image/png','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);return true;
 }
 if(!u)return send(401,{erreur:'Connectez-vous à votre compte établissement.'});
 const e=db.ecoles.find(e=>e.id===u.ecoleId);if(!e||u.actif===false)return send(403,{erreur:'Aucun espace établissement accessible.'});
 const gestion=roles.includes(u.role),owner=u.role==='admin_etablissement';
 const members=()=>db.utilisateurs.filter(x=>x.ecoleId===e.id);
 if(s[2]==='mon-espace'&&m==='GET')return send(200,{ecole:{...e,actif:active(e)},utilisateur:publicUser(u),gestion,catalogue:db.livres.filter(l=>(e.livresIds||[]).includes(l.id)).map(l=>({id:l.id,titre:l.titre,auteur:l.auteur,categorie:l.categorie,couverture:!!l.couverture})),travaux:db.travauxEcoles.filter(t=>t.ecoleId===e.id&&(gestion||!t.classe||t.classe===u.classe))});
 if(!gestion)return send(403,{erreur:'Réservé aux responsables de cet établissement.'});
 if(s[2]==='parametres'&&m==='PUT'){
  const b=await lireCorps(req);if(!texte(b.nom))return send(400,{erreur:'Nom de l’établissement requis.'});
  for(const k of ['nom','adresse','telephone','email','description'])if(b[k]!==undefined)e[k]=texte(b[k],k==='description'?2000:200);sauverDB();return send(200,{ok:true});
 }
 if(s[2]==='image'&&['logo','banniere'].includes(s[3])&&m==='POST'){
  const b=await lireBinaire(req);const png=b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
  if(!b.length||b.length>5*1024*1024||!png&&!jpg)return send(400,{erreur:'Image PNG ou JPEG de 5 Mo maximum requise.'});
  const folder=path.join(__dirname,'../data/ecoles');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,e.id+'-'+s[3]),b);e[s[3]]=true;e[s[3]+'Mime']=png?'image/png':'image/jpeg';sauverDB();return send(201,{ok:true});
 }
 if(!active(e))return send(402,{erreur:'Activez l’abonnement établissement annuel de 50 000 HTG pour gérer les élèves et les lectures.'});
 if(s[2]==='membres'&&m==='GET')return send(200,members().map(publicUser));
 if(s[2]==='membres'&&m==='POST'){
  const b=await lireCorps(req),nom=texte(b.nom),email=texte(b.email).toLowerCase(),role=b.role==='bibliothecaire_ecole'?'bibliothecaire_ecole':'apprenant';
  if(role!=='apprenant'&&!owner)return send(403,{erreur:'Seul l’administrateur peut créer un bibliothécaire.'});
  if(!nom||!/^\S+@\S+\.\S+$/.test(email)||typeof b.motDePasse!=='string'||b.motDePasse.length<8)return send(400,{erreur:'Nom, email et mot de passe de 8 caractères minimum requis.'});
  if(db.utilisateurs.some(x=>x.email.toLowerCase()===email))return send(409,{erreur:'Cet email est déjà utilisé.'});
  const user={id:uid(),nom,email,role,ecoleId:e.id,classe:texte(b.classe,80),actif:true,...hashMdp(b.motDePasse),creeLe:new Date().toISOString()};db.utilisateurs.push(user);sauverDB();return send(201,publicUser(user));
 }
 if(s[2]==='membres'&&s[3]&&m==='PUT'){
  const v=members().find(v=>v.id===s[3]);if(!v)return send(404,{erreur:'Membre introuvable.'});
  if(v.role==='admin_etablissement'||v.role==='bibliothecaire_ecole'&&!owner)return send(403,{erreur:'Ce compte ne peut pas être modifié ici.'});
  const b=await lireCorps(req);if(b.motDePasse!==undefined&&(typeof b.motDePasse!=='string'||b.motDePasse.length<8))return send(400,{erreur:'Mot de passe de 8 caractères minimum requis.'});if(b.nom!==undefined){if(!texte(b.nom))return send(400,{erreur:'Nom requis.'});v.nom=texte(b.nom)}
  if(b.classe!==undefined)v.classe=texte(b.classe,80);if(typeof b.actif==='boolean')v.actif=b.actif;
  if(b.motDePasse!==undefined){if(typeof b.motDePasse!=='string'||b.motDePasse.length<8)return send(400,{erreur:'Mot de passe de 8 caractères minimum requis.'});Object.assign(v,hashMdp(b.motDePasse));}
  if(b.actif===false||b.motDePasse!==undefined)for(const [key,id] of Object.entries(db.sessions))if(id===v.id)delete db.sessions[key];
  sauverDB();return send(200,publicUser(v));
 }
 if(s[2]==='catalogue'&&m==='PUT'){
  const b=await lireCorps(req);if(!Array.isArray(b.livresIds)||b.livresIds.some(id=>!db.livres.some(l=>l.id===id)))return send(400,{erreur:'Sélection de livres invalide.'});e.livresIds=[...new Set(b.livresIds)];sauverDB();return send(200,{ok:true});
 }
 if(s[2]==='travaux'&&m==='POST'){
  const b=await lireCorps(req);if(!texte(b.titre)||!db.livres.some(l=>l.id===b.livreId))return send(400,{erreur:'Titre et livre requis.'});
  const date=texte(b.echeance,10);if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(400,{erreur:'Date invalide.'});
  const t={id:uid(),ecoleId:e.id,titre:texte(b.titre),livreId:b.livreId,classe:texte(b.classe,80),echeance:date,creeLe:new Date().toISOString()};db.travauxEcoles.push(t);sauverDB();return send(201,t);
 }
 if(s[2]==='travaux'&&s[3]&&m==='DELETE'){const index=db.travauxEcoles.findIndex(t=>t.id===s[3]&&t.ecoleId===e.id);if(index<0)return send(404,{erreur:'Lecture introuvable.'});db.travauxEcoles.splice(index,1);sauverDB();return send(200,{ok:true});}
 if(s[2]==='lectures'&&m==='GET'){
  const eleves=members().filter(x=>x.role==='apprenant'),ids=new Set(eleves.map(x=>x.id));
  const filtre=texte(url.searchParams.get('classe'),80);
  const lignes=eleves.filter(x=>!filtre||x.classe===filtre).map(x=>{
   const livres=db.progressions.filter(p=>p.utilisateurId===x.id).map(p=>({livreId:p.livreId,titre:db.livres.find(l=>l.id===p.livreId)?.titre||'Document retiré',pourcentage:p.pourcentage,termine:!!p.termine,majLe:p.majLe||p.modifieLe||p.creeLe}));
   const medias=(db.progressionsMedias||[]).filter(p=>p.utilisateurId===x.id).map(p=>({titre:(db.medias||[]).find(v=>v.id===p.mediaId)?.titre||'Média retiré',secondes:p.secondes}));
   return {eleve:publicUser(x),livres,medias,termines:livres.filter(p=>p.termine).length};
  });return send(200,{eleves:eleves.length,lectures:db.progressions.filter(p=>ids.has(p.utilisateurId)).length,termines:db.progressions.filter(p=>ids.has(p.utilisateurId)&&p.termine).length,lignes});
 }
 return send(404,{erreur:'Route établissement introuvable.'});
}};
