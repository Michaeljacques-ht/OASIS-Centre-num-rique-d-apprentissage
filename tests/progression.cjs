// 1.26.0 : la progression validée suit le temps de lecture réel, pas le défilement.
const assert = require('node:assert/strict');
const P = require('../modules/progression-lecture');
const livre = { contenu: 'mot '.repeat(2000) }; // 10 min à 200 mots/min, 4 min à 500 mots/min
const p = { pourcentage: 0, termine: false, secondesLecture: 0 };

// Défilement jusqu'à la fin sans lire : seule la marge initiale est comptée
let e = P.appliquer(p, livre, 100);
assert.equal(e.position, 100); assert.equal(e.positionMax, 100); assert.equal(e.pourcentage, 2); assert.equal(e.limiteParTemps, true);

// Une minute de lecture active : au plus 2 % + 25 %
p.secondesLecture = 60; e = P.appliquer(p, livre);
assert.equal(e.pourcentage, 27);

// Retour en arrière : la position change, la progression validée ne recule pas
e = P.appliquer(p, livre, 10); assert.equal(e.position, 10); assert.equal(e.pourcentage, 27);

// Lecture honnête : la progression suit la position quand le temps est suffisant
const q = { pourcentage: 0, secondesLecture: 0 };
q.secondesLecture = 120; e = P.appliquer(q, livre, 30); assert.equal(e.pourcentage, 30); assert.equal(e.limiteParTemps, false);
q.secondesLecture = 240; e = P.appliquer(q, livre, 100); assert.equal(e.pourcentage, 100);

// Livre de taille inconnue : 3 % par minute active
assert.equal(P.plafond({}, 600), 32);

// Migration des anciennes progressions gonflées
const ancienne = { pourcentage: 90, secondesLecture: 30 };
assert.equal(P.migrer(ancienne, livre), true); assert.equal(ancienne.positionMax, 90); assert.equal(ancienne.pourcentage, 14);
assert.equal(P.migrer(ancienne, livre), false);
const finie = { pourcentage: 100, termine: true };
P.migrer(finie, livre); assert.equal(finie.pourcentage, 100);
console.log('Progression 1.26.0 : défilement sans lecture plafonné, temps réel requis, recul sans perte, migration vérifiés.');
