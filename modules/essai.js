const jours=30;
function initialiser(x){if(!x||x.essaiFin||x.essaiAccorde||new Date(x.abonnementFin||0)>new Date())return false;x.essaiAccorde=true;x.essaiDebut=new Date().toISOString();x.essaiFin=new Date(Date.now()+jours*86400000).toISOString();return true}
const actif=x=>!!x&&new Date(x.essaiFin||0)>new Date();
function info(x){const reste=Math.max(0,Math.ceil((new Date(x?.essaiFin||0)-Date.now())/86400000));return {essaiActif:actif(x),essaiFin:x?.essaiFin||null,joursEssaiRestants:reste}}
function notification(x){if(!x?.essaiFin||new Date(x.abonnementFin||0)>new Date())return [];const reste=info(x).joursEssaiRestants;if(reste>7)return [];return [{type:'abonnement',date:x.essaiFin,texte:reste?`Votre accès gratuit se termine dans ${reste} jour(s). Réglez votre abonnement pour continuer sans interruption.`:'Votre accès gratuit de 30 jours est terminé. Réglez votre abonnement pour retrouver l’accès complet.'}]}
module.exports={initialiser,actif,info,notification};
