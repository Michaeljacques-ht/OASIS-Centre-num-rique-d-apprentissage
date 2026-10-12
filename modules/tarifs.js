const defauts={mensuel:500,annuel:5000,petite:50000,moyenne:100000,grande:150000};
const lire=db=>({...defauts,...db.parametres?.tarifsAbonnement});
const formules=db=>Object.values(require('./formules-ecoles')).map(f=>({...f,montant:lire(db)[f.id]}));
const valide=t=>t&&typeof t==='object'&&!Array.isArray(t)&&Object.keys(t).length===5&&Object.keys(defauts).every(k=>Object.hasOwn(t,k)&&Number.isSafeInteger(t[k])&&t[k]>0&&t[k]<=10000000);
module.exports={lire,formules,valide};
