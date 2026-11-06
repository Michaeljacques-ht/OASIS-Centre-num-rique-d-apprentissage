// 1.24.0 : paliers de don des établissements (le don ouvre l'accès pour un an, selon l'effectif)
module.exports={
 petite:{id:'petite',nom:'Petite école',montant:50000,limiteEleves:100},
 moyenne:{id:'moyenne',nom:'École moyenne',montant:100000,limiteEleves:300},
 grande:{id:'grande',nom:'Grande école',montant:150000,limiteEleves:600},
 tres_grande:{id:'tres_grande',nom:'Très grande école',montant:250000,limiteEleves:1200},
 reseau:{id:'reseau',nom:'Réseau scolaire / université',montant:500000,limiteEleves:3000}
};
