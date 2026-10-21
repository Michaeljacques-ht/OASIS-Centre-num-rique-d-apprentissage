'use strict';
/* ============================================================
   OASIS — Diagnostic d'installation

   Compare les fichiers présents sur le serveur avec manifeste.json
   (livré avec chaque version). L'espace bibliothécaire affiche :
     - les fichiers MANQUANTS (pas encore envoyés sur GitHub) ;
     - les fichiers DIFFÉRENTS (restés à une autre version) ;
     - les éléments EN TROP à la racine (envoyés au mauvais endroit).
   Ainsi, une mise à jour incomplète se voit tout de suite, avec la
   liste exacte des fichiers à renvoyer.

   GET /api/diagnostic   → { version, complet } pour tous ;
                           détail pour l'administrateur principal.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { principal } = require('./administration-comptes');

const RACINE = path.join(__dirname, '..');
const RACINE_PERMISE = new Set(['data', 'node_modules', '.git', '.gitignore', 'manifeste.json', '.render', 'render.yaml', '.DS_Store']);
let resultat = null;

function analyser(racine = RACINE) {
  let manifeste;
  try { manifeste = JSON.parse(fs.readFileSync(path.join(racine, 'manifeste.json'), 'utf8')); }
  catch { return { version: require(path.join(racine, 'package.json')).version, manifeste: false, complet: null, manquants: [], differents: [], enTrop: [] }; }
  const manquants = [], differents = [];
  for (const [f, attendu] of Object.entries(manifeste.fichiers || {})) {
    const p = path.join(racine, f);
    if (!fs.existsSync(p)) { manquants.push(f); continue; }
    const reel = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
    if (reel !== attendu) differents.push(f);
  }
  // éléments de premier niveau inconnus du manifeste (ex. dossiers de public/ envoyés à la racine)
  const premiers = new Set(Object.keys(manifeste.fichiers || {}).map(f => f.split('/')[0]));
  const enTrop = fs.readdirSync(racine).filter(n => !premiers.has(n) && !RACINE_PERMISE.has(n) && !n.startsWith('.')).sort();
  let versionPkg = null;
  try { versionPkg = JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8')).version; } catch {}
  return { version: manifeste.version, versionPackage: versionPkg, manifeste: true, genereLe: manifeste.genereLe, attendus: manifeste.nombre,
    complet: !manquants.length && !differents.length, manquants, differents, enTrop, verifieLe: new Date().toISOString() };
}

function demarrer() {
  try {
    resultat = analyser();
    if (resultat.manifeste && !resultat.complet) console.warn(`⚠️  Installation incomplète : ${resultat.manquants.length} fichier(s) manquant(s), ${resultat.differents.length} différent(s). Voir l’espace bibliothécaire.`);
  } catch (e) { console.warn('Diagnostic indisponible :', e.message); }
}

function route(req, res, c) {
  const { utilisateur: u, json } = c;
  if (new URL(req.url, 'http://localhost').pathname !== '/api/diagnostic' || req.method !== 'GET') return false;
  if (!resultat) demarrer();
  const r = resultat || { manifeste: false };
  if (!principal(u)) { json(res, 200, { version: r.version, complet: r.complet }); return true; }
  json(res, 200, r);
  return true;
}

module.exports = { analyser, demarrer, route };
