const jours=30;
// 1.25.0 : la période de découverte gratuite est supprimée ; les essais déjà en cours vont à leur terme.
function initialiser(){return false}
const actif=x=>!!x&&new Date(x.essaiFin||0)>new Date();
function info(x){const reste=Math.max(0,Math.ceil((new Date(x?.essaiFin||0)-Date.now())/86400000));return {essaiActif:actif(x),essaiFin:x?.essaiFin||null,joursEssaiRestants:reste}}
function notification(x){if(!x?.essaiFin||new Date(x.abonnementFin||0)>new Date())return [];const reste=info(x).joursEssaiRestants;if(reste>7)return [];return [{type:'abonnement',date:x.essaiFin,texte:reste?`Votre accès gratuit se termine dans ${reste} jour(s). Faites votre don d’accès pour continuer sans interruption.`:'Votre accès gratuit de 30 jours est terminé. Faites votre don d’accès pour retrouver l’accès complet.'}]}
module.exports={initialiser,actif,info,notification};
