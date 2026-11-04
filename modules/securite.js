'use strict';
/* ============================================================
   OASIS — Sécurité (correctif 1.13.1, suite à l'audit du 3 novembre 2026)

   - Limite des tentatives de connexion (5 par compte et par adresse IP, 20 par adresse IP, sur 15 minutes).
   - Mots de passe publics (admin123, demo123) refusés en production.
   - Mot de passe administrateur fixé par la variable OASIS_ADMIN_MDP.
   - Icône et couleur des livres et catégories : valeurs sûres seulement.
   - En-têtes de sécurité HTTP.
   ============================================================ */
const crypto = require('crypto');

/* ---------- Limite des tentatives de connexion ---------- */
const FENETRE = 15 * 60 * 1000;          // 15 minutes
const MAX_PAR_EMAIL = 5, MAX_PAR_IP = 20;
const echecs = new Map();                // clé → { n, debut }

/** Adresse IP du visiteur. Derrière Render, le dernier élément de X-Forwarded-For est ajouté par Render lui-même. */
function ipDe(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : (req.socket?.remoteAddress || 'inconnue');
}
function compte(cle) {
  const e = echecs.get(cle);
  if (!e || Date.now() - e.debut > FENETRE) { echecs.delete(cle); return 0; }
  return e.n;
}
/** Minutes d'attente restantes si la connexion est bloquée, sinon 0. */
function bloque(email, ip) {
  // clé email + IP : un attaquant ne peut pas bloquer le vrai titulaire du compte depuis une autre adresse
  const cles = [['e:' + email + '|' + ip, MAX_PAR_EMAIL], ['i:' + ip, MAX_PAR_IP]];
  for (const [cle, max] of cles) if (compte(cle) >= max) return Math.max(1, Math.ceil((echecs.get(cle).debut + FENETRE - Date.now()) / 60000));
  return 0;
}
function noterEchec(email, ip) {
  for (const cle of ['e:' + email + '|' + ip, 'i:' + ip]) {
    const n = compte(cle);
    echecs.set(cle, n ? { n: n + 1, debut: echecs.get(cle).debut } : { n: 1, debut: Date.now() });
  }
  if (echecs.size > 50000) for (const k of [...echecs.keys()].slice(0, 10000)) echecs.delete(k);   // borne mémoire
}
function noterSucces(email, ip) { echecs.delete('e:' + email + '|' + ip); }

/* ---------- Mots de passe publics ---------- */
// Publiés dans le code et la documentation des versions précédentes : jamais acceptés en production.
const MDP_PUBLICS = ['admin123', 'demo123'];
const modeDemo = () => process.env.OASIS_DEMO === '1';
const mdpPublicRefuse = mdp => !modeDemo() && MDP_PUBLICS.includes(String(mdp));

/**
 * Au démarrage : si OASIS_ADMIN_MDP est définie, elle devient le mot de passe de l'administrateur principal
 * (OASIS_ADMIN_EMAIL, par défaut admin@oasis.ht). Ses anciennes sessions sont fermées quand le mot de passe change.
 */
function appliquerMdpAdmin(db, hashMdp, verifMdp) {
  const mdp = process.env.OASIS_ADMIN_MDP;
  if (!mdp) return null;
  if (mdp.length < 10) { console.warn('OASIS_ADMIN_MDP ignorée : 10 caractères minimum.'); return null; }
  const email = String(process.env.OASIS_ADMIN_EMAIL || 'admin@oasis.ht').trim().toLowerCase();
  const u = (db.utilisateurs || []).find(x => String(x.email).toLowerCase() === email && x.role === 'bibliothecaire' && !x.adminDelegue);
  if (!u) { console.warn('OASIS_ADMIN_MDP : aucun administrateur principal avec l’email', email); return null; }
  if (verifMdp(mdp, u)) return false;
  Object.assign(u, hashMdp(mdp));
  for (const [jeton, id] of Object.entries(db.sessions || {})) if (id === u.id) delete db.sessions[jeton];
  console.log('Mot de passe de l’administrateur principal mis à jour depuis OASIS_ADMIN_MDP.');
  return true;
}
/** Mot de passe initial d'une base neuve : OASIS_ADMIN_MDP, admin123 en mode démo, sinon aléatoire. */
function mdpInitialAdmin() {
  if (process.env.OASIS_ADMIN_MDP && process.env.OASIS_ADMIN_MDP.length >= 10) return { mdp: process.env.OASIS_ADMIN_MDP, affiche: false };
  if (modeDemo()) return { mdp: 'admin123', affiche: true };
  return { mdp: crypto.randomBytes(9).toString('base64url'), affiche: true };
}

/* ---------- Icône et couleur ---------- */
const COULEUR = /^#[0-9a-fA-F]{3,8}$/;
const couleurValide = c => typeof c === 'string' && COULEUR.test(c);
const iconeValide = i => typeof i === 'string' && i.length >= 1 && i.length <= 16 && !/[<>"'`&\\=;(){}]/.test(i);
/** Vérifie les champs fournis ; renvoie un message d'erreur ou null. */
function verifierApparence(c) {
  if (c.couleur !== undefined && c.couleur !== '' && !couleurValide(c.couleur)) return 'Couleur invalide : utilisez un code comme #1e4fa3.';
  if (c.icone !== undefined && c.icone !== '' && !iconeValide(c.icone)) return 'Icône invalide : un emoji ou quelques caractères simples.';
  return null;
}
/** Au démarrage : remplace les valeurs dangereuses déjà enregistrées. Renvoie le nombre de corrections. */
function nettoyerApparence(db) {
  let n = 0;
  for (const liste of [db.livres || [], db.categories || []]) for (const x of liste) {
    if (x.couleur !== undefined && x.couleur !== '' && !couleurValide(x.couleur)) { x.couleur = '#1e4fa3'; n++; }
    if (x.icone !== undefined && x.icone !== '' && !iconeValide(x.icone)) { x.icone = '📘'; n++; }
  }
  for (const r of db.ressources || []) {
    if (r.lien && !/^https?:\/\//i.test(r.lien)) { r.lien = ''; n++; }
    if (r.icone && !iconeValide(r.icone)) { r.icone = ''; n++; }
  }
  return n;
}

/* ---------- En-têtes HTTP ---------- */
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' reste nécessaire tant que l'interface utilise des onclick="…" dans ses gabarits
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",            // empêche un script injecté d'envoyer des données vers un autre site
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'"
].join('; ');
function entetes(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', CSP);
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}

module.exports = { ipDe, bloque, noterEchec, noterSucces, mdpPublicRefuse, appliquerMdpAdmin, mdpInitialAdmin, modeDemo,
  couleurValide, iconeValide, verifierApparence, nettoyerApparence, entetes, CSP, _echecs: echecs };
