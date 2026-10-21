#!/usr/bin/env node
/* OASIS — génère manifeste.json : la liste de tous les fichiers de l'application
   avec leur empreinte. Le serveur s'en sert pour signaler, dans l'espace
   bibliothécaire, les fichiers manquants ou restés à une ancienne version.
   Usage : npm run manifeste   (à lancer avant de préparer une livraison) */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
const EXCLUS = new Set(['data', 'node_modules', '.git', 'manifeste.json', '.DS_Store']);

function lister(dossier, prefixe = '') {
  const res = [];
  for (const nom of fs.readdirSync(dossier).sort()) {
    if (EXCLUS.has(nom) || nom.startsWith('.')) continue;
    const complet = path.join(dossier, nom), relatif = prefixe + nom;
    if (fs.statSync(complet).isDirectory()) res.push(...lister(complet, relatif + '/'));
    else res.push(relatif);
  }
  return res;
}
const empreinte = f => crypto.createHash('sha1').update(fs.readFileSync(path.join(RACINE, f))).digest('hex').slice(0, 16);

const version = require(path.join(RACINE, 'package.json')).version;
const fichiers = {};
for (const f of lister(RACINE)) fichiers[f] = empreinte(f);
const manifeste = { version, genereLe: new Date().toISOString(), nombre: Object.keys(fichiers).length, fichiers };
fs.writeFileSync(path.join(RACINE, 'manifeste.json'), JSON.stringify(manifeste, null, 1) + '\n');
console.log(`manifeste.json : version ${version}, ${manifeste.nombre} fichiers.`);
