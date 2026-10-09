'use strict';
const fs=require('fs'); const path=require('path');
module.exports=async function diffusion(req,res,ctx){
 const {db,utilisateur:u,json,lireCorps,sauverDB,uid}=ctx;
 const url=new URL(req.url,'http://localhost'); const seg=url.pathname.split('/').filter(Boolean);
 if(seg[1]!=='diffusion')return false;
 const send=(code,data)=>{json(res,code,data);return true};
 if(!u)return send(401,{erreur:'Connexion requise.'});
 if(!db.diffusion){db.diffusion={ressources:JSON.parse(fs.readFileSync(path.join(__dirname,'../seed/diffusion.json'),'utf8')),suivis:[],plans:[]};sauverDB()}
 const d=db.diffusion; const admin=u.role==='bibliothecaire'; const m=req.method;const id=seg[3];
 const visible=r=>admin||['publie','exemple'].includes(r.statut)||r.auteurId===u.id;
 const suivi=r=>d.suivis.find(s=>s.utilisateurId===u.id&&s.ressourceId===r.id)||{favori:false,termine:false,note:''};
 const projection=r=>({...r,suivi:suivi(r)});
 if(seg[2]==='ressources'&&!id&&m==='GET')return send(200,d.ressources.filter(visible).map(projection));
 if(seg[2]==='suivi'&&id&&m==='PUT'){
  const r=d.ressources.find(r=>r.id===id&&visible(r));if(!r)return send(404,{erreur:'Ressource introuvable.'});
  if(seg.length!==4)return send(404,{erreur:'Route introuvable.'});
  const b=await lireCorps(req);if(b.termine===true&&!r.contenu&&!r.lien)return send(400,{erreur:'Cette fiche ne contient pas encore de document à étudier.'});
  let s=d.suivis.find(s=>s.utilisateurId===u.id&&s.ressourceId===id);if(!s){s={utilisateurId:u.id,ressourceId:id,favori:false,termine:false,note:''};d.suivis.push(s)}
  for(const k of ['favori','termine'])if(typeof b[k]==='boolean')s[k]=b[k];if(typeof b.note==='string')s.note=b.note.slice(0,5000);s.majLe=new Date().toISOString();sauverDB();return send(200,s);
 }
 if(seg[2]==='plans'){
  if(m==='GET')return send(200,d.plans.filter(p=>p.utilisateurId===u.id));
  if(m==='POST'&&!id){const b=await lireCorps(req);if(!b.titre?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||isNaN(Date.parse(b.date)))return send(400,{erreur:'Un titre et une date valide sont requis.'});const p={id:uid(),utilisateurId:u.id,titre:String(b.titre).trim().slice(0,200),date:b.date,termine:false};d.plans.push(p);sauverDB();return send(201,p)}
  const p=d.plans.find(p=>p.id===id&&p.utilisateurId===u.id);if(!p)return send(404,{erreur:'Séance introuvable.'});if(m==='PUT'){const b=await lireCorps(req);p.termine=b.termine===true;sauverDB();return send(200,p)}if(m==='DELETE'){d.plans=d.plans.filter(x=>x!==p);sauverDB();return send(200,{ok:true})}
 }
 if(seg[2]==='ressources'&&['POST','PUT'].includes(m)){
  const b=await lireCorps(req);
  if(!admin&&!['soumis','brouillon'].includes(b.statut))return send(403,{erreur:'Votre contribution doit être soumise à validation.'});if(typeof b.titre!=='string'||!b.titre.trim())return send(400,{erreur:'Le titre est requis.'});
  if(!['pedagogie','methodes','td'].includes(b.categorie)||!['tous','eleves','enseignants'].includes(b.public)||!['brouillon','publie','exemple','soumis','rejete'].includes(b.statut))return send(400,{erreur:'Catégorie, public ou statut invalide.'});
  if(b.lien){try{const link=new URL(b.lien);if(!['https:','http:'].includes(link.protocol)||link.username||link.password)throw Error()}catch{return send(400,{erreur:'Utilisez un lien HTTP ou HTTPS valide.'})}}
  if(['publie','soumis'].includes(b.statut)&&!String(b.contenu||'').trim()&&!b.lien)return send(400,{erreur:'Ajoutez un contenu ou un lien avant de publier.'});
  let r;if(m==='PUT'){r=d.ressources.find(r=>r.id===id);if(!r)return send(404,{erreur:'Ressource introuvable.'});if(!admin&&(r.auteurId!==u.id||r.statut==='publie'))return send(403,{erreur:'Vous ne pouvez modifier que vos contributions non publiées.'})}else{if(id)return send(400,{erreur:'Route de création invalide.'});r={id:uid(),auteurId:u.id,auteur:u.nom,source:'OASIS',creeLe:new Date().toISOString(),image:''};d.ressources.unshift(r)}
  for(const k of ['titre','discipline','niveau','type','format','theme','description','contenu','lien','categorie','public','statut'])r[k]=String(b[k]||'').slice(0,k==='contenu'?100000: k==='description'?5000:1000);
  r.majLe=new Date().toISOString();sauverDB();return send(m==='POST'?201:200,projection(r));
 }
 return send(404,{erreur:'Route Diffusion introuvable.'});
};
