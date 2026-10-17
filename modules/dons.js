'use strict';
/* ============================================================
   OASIS — Faire un don (passerelle PLOP PLOP)

   Les particuliers — avec ou sans compte — peuvent soutenir
   l'institution. Le flux reprend celui des abonnements :
     1. POST /api/dons                 → commande DON-… + URL PLOP PLOP
     2. le donateur paie sur la passerelle
     3. POST /api/dons/verifier/:id    → confirmation (trans_status 'ok')
   Un donateur sans compte prouve qu'il est l'auteur du don avec la
   « clé de suivi » renvoyée à l'étape 1 (conservée dans son navigateur).

   Administration (administrateur principal) :
     GET  /api/admin-dons               → dons, totaux, paramètres
     PUT  /api/admin-dons/parametres    → campagne, objectif, montants
     POST /api/admin-dons/:id/verifier  → revérifier un don en attente
   ============================================================ */
const crypto = require('crypto');
const PP = require('../lib/plopplop');
const { principal } = require('./administration-comptes');

const DEFAUTS = {
  actif: true,
  titre: 'Soutenez OASIS',
  message: 'Votre don aide à enrichir la bibliothèque, à numériser des ouvrages et à offrir l’accès aux apprenants qui n’en ont pas les moyens.',
  objectif: 0,                       // 0 = pas d'objectif affiché
  montantsSuggeres: [100, 250, 500, 1000, 2500],
  montantMax: 1000000,
  afficherDonateurs: true
};
const AFFECTATIONS = {
  general: 'Là où le besoin est le plus grand',
  livres: 'Achat et numérisation de livres',
  bourses: 'Abonnements offerts aux apprenants',
  equipement: 'Équipement et connexion'
};
const verrous = new Set();
const tentativesParIP = new Map();   // anti-abus : créations de dons par adresse

const parametres = (db) => ({ ...DEFAUTS, ...((db.parametres || {}).dons || {}) });
const texte = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const memeCle = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

function limiteIP(req) {
  const ip = req.socket?.remoteAddress || req.headers?.['x-forwarded-for'] || 'local';
  const maintenant = Date.now(), fenetre = 10 * 60 * 1000;
  const liste = (tentativesParIP.get(ip) || []).filter(t => maintenant - t < fenetre);
  if (liste.length >= 8) return false;
  liste.push(maintenant); tentativesParIP.set(ip, liste);
  if (tentativesParIP.size > 5000) tentativesParIP.clear();
  return true;
}

/** Valide le formulaire de don ; lève une erreur lisible. */
function valider(b, u, p) {
  const montant = Number(b.montant);
  if (!Number.isSafeInteger(montant) || montant < PP.PLOP.montantMinHTG || montant > p.montantMax) {
    throw Error(`Le montant doit être un nombre entier de ${PP.PLOP.montantMinHTG} à ${p.montantMax.toLocaleString('fr-FR')} HTG.`);
  }
  const nom = texte(b.nom || u?.nom, 120);
  const email = texte(b.email || u?.email, 160).toLowerCase();
  if (!nom) throw Error('Indiquez votre nom (il peut rester masqué si vous donnez anonymement).');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw Error('Indiquez une adresse email valide pour recevoir votre reçu.');
  const telephone = texte(b.telephone, 30).replace(/[^\d+ ]/g, '');
  const affectation = Object.hasOwn(AFFECTATIONS, b.affectation) ? b.affectation : 'general';
  return { montant, nom, email, telephone, affectation, message: texte(b.message, 500), anonyme: b.anonyme === true };
}

/** Données d'un don visibles par son auteur (reçu). */
const vueDon = (db, d) => ({
  id: d.id, montant: d.montant, statut: d.statut, nom: d.nom, email: d.email, anonyme: d.anonyme,
  affectation: AFFECTATIONS[d.affectation] || AFFECTATIONS.general, message: d.message,
  creeLe: d.creeLe, payeLe: d.payeLe || null, numeroRecu: d.numeroRecu || null,
  transaction: d.transactionConfirmee || null, methode: d.methode || null,
  institution: (db.parametres || {}).nom || 'OASIS Bibliothèque Numérique'
});

function statistiques(db) {
  const payes = (db.dons || []).filter(d => d.statut === 'paye');
  const donateurs = new Set(payes.map(d => d.utilisateurId || d.email));
  return { total: payes.reduce((s, d) => s + d.montant, 0), nombre: payes.length, donateurs: donateurs.size };
}

async function confirmer(db, d, sauverDB) {
  if (d.statut === 'paye') return { paye: true };
  if (verrous.has(d.id)) return { paye: false };
  verrous.add(d.id);
  try {
    const r = await PP.verifierPaiement(d.id);
    if (!r.ok) return { erreur: r.error || 'Passerelle injoignable.' };
    if (!r.paye) return { paye: false };
    const annee = new Date().getUTCFullYear();
    db.compteurRecusDons ||= {};
    db.compteurRecusDons[annee] = (db.compteurRecusDons[annee] || 0) + 1;
    d.numeroRecu = `REC-DON-${annee}-${String(db.compteurRecusDons[annee]).padStart(4, '0')}`;
    d.statut = 'paye'; d.payeLe = new Date().toISOString();
    d.transactionConfirmee = r.infos?.transactionId || null; d.methode = r.infos?.methode || null;
    sauverDB();
    return { paye: true };
  } finally { verrous.delete(d.id); }
}

async function route(req, res, c) {
  const { db, utilisateur: u, json, lireCorps, sauverDB, uid, journal } = c;
  const url = new URL(req.url, 'http://localhost');
  const s = url.pathname.split('/').filter(Boolean), m = req.method;
  const envoyer = (code, data) => { json(res, code, data); return true; };
  if (s[0] !== 'api' || !['dons', 'admin-dons'].includes(s[1])) return false;
  db.dons ||= [];
  const p = parametres(db);

  /* ---------------- Public ---------------- */
  if (s[1] === 'dons') {
    if (s.length === 3 && s[2] === 'infos' && m === 'GET') {
      const st = statistiques(db);
      const recents = p.afficherDonateurs ? db.dons.filter(d => d.statut === 'paye').sort((a, b) => b.payeLe.localeCompare(a.payeLe)).slice(0, 8)
        .map(d => ({ nom: d.anonyme ? 'Donateur anonyme' : d.nom, message: d.anonyme ? '' : d.message, date: d.payeLe })) : [];
      return envoyer(200, { actif: p.actif, configure: PP.passerelleActive(), titre: p.titre, message: p.message,
        objectif: p.objectif, montantsSuggeres: p.montantsSuggeres, montantMin: PP.PLOP.montantMinHTG, montantMax: p.montantMax,
        affectations: AFFECTATIONS, ...st, recents });
    }
    if (s.length === 2 && m === 'POST') {
      if (!p.actif) return envoyer(403, { erreur: 'Les dons sont momentanément suspendus.' });
      if (!PP.passerelleActive()) return envoyer(503, { erreur: 'Les paiements ne sont pas encore configurés par l’administration.' });
      if (!limiteIP(req)) return envoyer(429, { erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' });
      let donnees;
      try { donnees = valider(await lireCorps(req), u, p); } catch (e) { return envoyer(400, { erreur: e.message }); }
      const don = { id: 'DON-' + uid().toUpperCase(), cle: crypto.randomBytes(18).toString('hex'), ...donnees,
        utilisateurId: u?.id || null, statut: 'en_attente', creeLe: new Date().toISOString() };
      db.dons.push(don); sauverDB();
      const r = await PP.initierPaiement({ reference: don.id, montant: don.montant, methode: 'all' });
      if (!r.ok) { don.statut = 'erreur'; don.erreur = r.error; sauverDB(); return envoyer(502, { erreur: r.error }); }
      try { if (new URL(r.urlPaiement).protocol !== 'https:') throw Error(); }
      catch { don.statut = 'erreur'; sauverDB(); return envoyer(502, { erreur: 'Adresse de paiement invalide.' }); }
      don.transactionId = r.transactionId; sauverDB();
      journal?.('Don initié', u, `${don.id} — ${don.montant} HTG`);
      return envoyer(201, { id: don.id, cle: don.cle, url: r.urlPaiement, montant: don.montant });
    }
    if (s.length === 2 && m === 'GET' && url.searchParams.get('mes') === '1') {
      if (!u) return envoyer(401, { erreur: 'Connexion requise.' });
      return envoyer(200, db.dons.filter(d => d.utilisateurId === u.id && d.statut !== 'erreur').slice(-20).reverse().map(d => vueDon(db, d)));
    }
    const autorise = (d, cle) => d && ((u && d.utilisateurId === u.id) || memeCle(cle, d.cle) || principal(u));
    if (s[2] === 'verifier' && s[3] && m === 'POST') {
      const b = await lireCorps(req).catch(() => ({}));
      const d = db.dons.find(x => x.id === s[3]);
      if (!autorise(d, b.cle)) return envoyer(404, { erreur: 'Don introuvable.' });
      if (d.statut === 'erreur') return envoyer(409, { erreur: 'Ce don n’a pas pu être ouvert sur la passerelle.' });
      const r = await confirmer(db, d, sauverDB);
      if (r.erreur) return envoyer(502, { erreur: r.erreur });
      if (r.paye) journal?.('Don confirmé', u, `${d.id} — ${d.montant} HTG`);
      return envoyer(200, { paye: !!r.paye, don: vueDon(db, d) });
    }
    if (s.length === 3 && m === 'GET') {
      const d = db.dons.find(x => x.id === s[2]);
      if (!autorise(d, url.searchParams.get('cle'))) return envoyer(404, { erreur: 'Don introuvable.' });
      return envoyer(200, vueDon(db, d));
    }
    return envoyer(404, { erreur: 'Route introuvable.' });
  }

  /* ---------------- Administration ---------------- */
  if (!principal(u)) return envoyer(403, { erreur: 'Réservé à l’administrateur principal.' });
  if (s.length === 2 && m === 'GET') {
    const dons = db.dons.slice().sort((a, b) => (b.payeLe || b.creeLe).localeCompare(a.payeLe || a.creeLe)).map(d => ({
      id: d.id, nom: d.nom, email: d.email, telephone: d.telephone || '', montant: d.montant, statut: d.statut,
      anonyme: d.anonyme, affectation: AFFECTATIONS[d.affectation] || AFFECTATIONS.general, message: d.message,
      date: d.payeLe || d.creeLe, numeroRecu: d.numeroRecu || '', transaction: d.transactionConfirmee || '', compte: !!d.utilisateurId }));
    return envoyer(200, { parametres: p, configure: PP.passerelleActive(), affectations: AFFECTATIONS, statistiques: statistiques(db), dons });
  }
  if (s[2] === 'parametres' && m === 'PUT') {
    const b = await lireCorps(req);
    const montants = Array.isArray(b.montantsSuggeres) ? [...new Set(b.montantsSuggeres.map(Number))].filter(n => Number.isSafeInteger(n) && n >= PP.PLOP.montantMinHTG).sort((a, b) => a - b).slice(0, 8) : p.montantsSuggeres;
    const objectif = Number(b.objectif ?? p.objectif), max = Number(b.montantMax ?? p.montantMax);
    if (!Number.isSafeInteger(objectif) || objectif < 0 || objectif > 1e10) return envoyer(400, { erreur: 'Objectif invalide (entier en HTG, 0 pour aucun).' });
    if (!Number.isSafeInteger(max) || max < PP.PLOP.montantMinHTG || max > 1e8) return envoyer(400, { erreur: 'Montant maximal invalide.' });
    if (!montants.length) return envoyer(400, { erreur: 'Indiquez au moins un montant suggéré d’au moins 20 HTG.' });
    db.parametres ||= {};
    db.parametres.dons = { actif: b.actif !== false, titre: texte(b.titre ?? p.titre, 120) || DEFAUTS.titre, message: texte(b.message ?? p.message, 800),
      objectif, montantMax: max, montantsSuggeres: montants.filter(n => n <= max), afficherDonateurs: b.afficherDonateurs !== false };
    journal?.('Paramètres des dons modifiés', u, JSON.stringify({ actif: db.parametres.dons.actif, objectif }));
    sauverDB();
    return envoyer(200, db.parametres.dons);
  }
  if (s[3] === 'verifier' && m === 'POST') {
    const d = db.dons.find(x => x.id === s[2]);
    if (!d) return envoyer(404, { erreur: 'Don introuvable.' });
    const r = await confirmer(db, d, sauverDB);
    if (r.erreur) return envoyer(502, { erreur: r.erreur });
    return envoyer(200, { paye: !!r.paye });
  }
  return envoyer(404, { erreur: 'Route introuvable.' });
}

module.exports = { route, parametres, statistiques, AFFECTATIONS, DEFAUTS };
