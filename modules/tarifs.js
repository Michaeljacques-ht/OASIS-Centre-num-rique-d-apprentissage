const defauts={mensuel:500,annuel:5000,petite:50000,moyenne:100000,grande:150000,tres_grande:250000,reseau:500000};
const lire=db=>({...defauts,...db.parametres?.tarifsAbonnement});
const formules=db=>Object.values(require('./formules-ecoles')).map(f=>({...f,montant:lire(db)[f.id]}));
const valide=t=>t&&typeof t==='object'&&!Array.isArray(t)&&Object.keys(t).every(k=>Object.hasOwn(defauts,k)&&Number.isSafeInteger(t[k])&&t[k]>0&&t[k]<=10000000)&&['mensuel','annuel','petite','moyenne','grande'].every(k=>Object.hasOwn(t,k));
module.exports={lire,formules,valide};
