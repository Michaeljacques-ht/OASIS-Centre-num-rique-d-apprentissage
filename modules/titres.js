'use strict';
/* OASIS 1.28.0 — Correction des titres du catalogue.
   Repère les défauts fréquents des titres importés (Gutenberg, Wikisource, fichiers) et propose
   une version corrigée. Rien n'est modifié sans validation du bibliothécaire. */

const PETITS_MOTS = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'et', 'ou', 'à', 'au', 'aux', 'en', 'sur', 'pour', 'par', 'dans', 'un', 'une', 'd', 'l']);
// Mots qui gardent une majuscule quand un titre en capitales passe en minuscules.
const NOMS_PROPRES = ['Haïti', 'Haïtien', 'Haïtienne', 'Haïtiens', 'Haïtiennes', 'Dessalines', 'Toussaint', 'Louverture', 'Christophe', 'Pétion', 'Boyer', 'Port-au-Prince', 'Saint-Domingue', 'Saint-Marc', 'Cap-Haïtien', 'Jacmel', 'Gonaïves', 'Jérémie', 'France', 'Paris', 'Amérique', 'Afrique', 'Europe', 'Caraïbe', 'Caraïbes', 'Antilles', 'Dieu', 'Constitution', 'République', 'État', 'Moniteur', 'Ardouin', 'Madiou', 'Price-Mars', 'Roumain', 'Alexis', 'Napoléon', 'Bible', 'Code', 'Tome', 'Créole', 'Kreyòl'];
const PROPRES = new Map(NOMS_PROPRES.map(m => [m.toLocaleLowerCase('fr'), m]));
const SIGLES = new Set(['MENFP', 'UNESCO', 'ONU', 'OMS', 'BNF', 'UEH', 'FOKAL', 'CNE', 'ISPAN', 'OEA', 'CARICOM', 'USA', 'UNICEF', 'PNUD', 'FAO', 'BID', 'IHSI', 'MSPP', 'MPCE', 'NECTAR', 'AFD', 'TIC', 'TICE', 'IA', 'HTG', 'BRH', 'OFATMA', 'ONA', 'EDH', 'PIB', 'SIDA', 'VIH', 'ADN', 'XIXE', 'XXE', 'XVIIIE']);
const ROMAIN = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

function majusculeInitiale(s) { return s.replace(/^(\P{L}*)(\p{L})/u, (_, a, b) => a + b.toLocaleUpperCase('fr')); }

/** Titre ENTIÈREMENT EN CAPITALES → casse française normale (majuscule initiale + noms propres connus). */
function casseFrancaise(titre) {
  let debutPhrase = true;
  const morceaux = titre.split(/(\s+|[-–—:;.!?«»"()[\]/'’])/);
  return morceaux.map((mot, i) => {
    if (!/\p{L}/u.test(mot)) { if (/[.!?:]/.test(mot)) debutPhrase = true; return mot; }
    const bas = mot.toLocaleLowerCase('fr');
    let res;
    if (mot.length === 1 && morceaux[i + 1] === '.' && /\p{L}/u.test(mot) && bas !== 'a') res = mot.toUpperCase(); // initiale : B. Ardouin
    else if (ROMAIN.test(mot) && mot.length <= 6 && !['mi', 'di', 'ci', 'mil', 'vil', 'dix', 'mix'].includes(bas) && !(PETITS_MOTS.has(bas))) res = mot.toUpperCase();
    else if (SIGLES.has(mot.toUpperCase()) && !/^(XIXE|XXE|XVIIIE)$/.test(mot.toUpperCase())) res = mot.toUpperCase();
    else if (/^(X{0,3}(IX|IV|V?I{0,3}))E$/i.test(mot) && mot.length > 1 && /^si[eè]cles?$/i.test(morceaux[i + 2] || '')) res = mot.slice(0, -1).toUpperCase() + 'e'; // XIXe siècle
    else if (/^[A-Z]{2,5}$/.test(mot) && !/[AEIOUY]/.test(mot)) res = mot; // sigles sans voyelle
    else if (PROPRES.has(bas)) res = PROPRES.get(bas);
    else res = bas;
    if (debutPhrase) { res = majusculeInitiale(res); debutPhrase = false; }
    return res;
  }).join('');
}

/** Corrige un mojibake UTF-8 lu comme Latin-1 (« Ã© » → « é »). */
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';
function reparerEncodage(s) {
  if (!/[ÃÂÅÆ][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œžŸ]|â€/.test(s)) return s;
  const octets = [];
  for (const c of s) { const n = c.codePointAt(0); const k = CP1252.indexOf(c); if (n < 0x80 || (n >= 0xA0 && n <= 0xFF)) octets.push(n); else if (k >= 0) octets.push(0x80 + k); else return s; }
  const r = Buffer.from(octets).toString('utf8');
  return r.includes('�') ? s : r;
}
const ENTITES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&rsquo;': '’', '&laquo;': '«', '&raquo;': '»', '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç' };

/**
 * Propose une correction pour un titre.
 * @returns {{ titre: string, raisons: string[] }} raisons vide si rien à corriger.
 */
function proposer(original, auteur = '') {
  let t = String(original ?? ''), raisons = [];
  const etape = (raison, fn) => { const avant = t; t = fn(t); if (t !== avant) raisons.push(raison); };

  etape('Encodage des accents', reparerEncodage);
  etape('Caractères HTML', s => s.replace(/&(?:[a-z]+|#\d+);/gi, e => ENTITES[e.toLowerCase()] ?? (/^&#\d+;$/.test(e) ? String.fromCharCode(+e.slice(2, -1)) : e)));
  etape('Mentions d’import retirées', s => s
    .replace(/^\s*(?:the\s+)?project\s+gutenberg(?:'s)?\s+(?:e-?book|etext)\s+of\s+/i, '')
    .replace(/\s*[-–—|:]\s*(?:wikisource|project gutenberg|gutenberg|feedbooks|ebooks libres et gratuits|bibebook|gallica)\s*$/i, '')
    .replace(/\s*\((?:french|français|francais|fr|epub|pdf|ebook|e-book|version numérique)\)\s*$/i, '')
    .replace(/\.(?:epub|pdf|docx?|txt|html?)\s*$/i, ''));
  if (auteur) etape('Nom de l’auteur répété dans le titre', s => {
    const a = String(auteur).trim(); if (a.length < 4 || /^anonyme$/i.test(a)) return s;
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return s.replace(new RegExp(`\\s*(?:[-–—|/,]|\\bpar\\b|\\bby\\b)\\s*${esc}\\s*$`, 'i'), '').replace(new RegExp(`^${esc}\\s*[-–—|:]\\s*`, 'i'), '');
  });
  etape('Tirets bas remplacés par des espaces', s => /_/.test(s) && !/\s/.test(s.replace(/_/g, '')) ? s.replace(/_+/g, ' ') : s);
  etape('Espaces superflues', s => s.replace(/[   \t\r\n]+/g, ' ').replace(/ {2,}/g, ' ').replace(/ +([,.)\]])/g, '$1').replace(/([(\[]) +/g, '$1').trim());
  etape('Point final retiré', s => /[^.]\.$/.test(s) && !/\b(?:etc|cie|vol|t|p|éd|ed|av|J\.-C|[A-Z])\.$/i.test(s) ? s.slice(0, -1) : s);
  etape('Titre en capitales', s => {
    const lettres = s.replace(/[^\p{L}]/gu, '');
    return lettres.length >= 6 && lettres === lettres.toLocaleUpperCase('fr') && /\p{Lu}{4}/u.test(lettres) ? casseFrancaise(s) : s;
  });
  etape('Majuscule initiale', s => /^\P{L}*\p{Ll}/u.test(s) && !/^[a-z]+[A-Z]/.test(s) ? majusculeInitiale(s) : s);
  if (!t) return { titre: String(original ?? ''), raisons: [] };
  return { titre: t, raisons };
}

/** Clé de comparaison pour les titres en double. */
const cle = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Analyse tout le catalogue. */
function analyser(livres) {
  const corrections = [];
  for (const l of livres) {
    const p = proposer(l.titre, l.auteur);
    if (p.raisons.length && p.titre !== l.titre) corrections.push({ id: l.id, titre: l.titre, auteur: l.auteur || '', categorie: l.categorie || '', propose: p.titre, raisons: p.raisons });
  }
  const groupes = new Map();
  for (const l of livres) { const k = cle(proposer(l.titre, l.auteur).titre) + '|' + cle(l.auteur); if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push({ id: l.id, titre: l.titre, auteur: l.auteur || '', annee: l.annee || '', edition: l.edition || '' }); }
  const doublons = [...groupes.values()].filter(g => g.length > 1);
  return { total: livres.length, corrections, doublons };
}

module.exports = { proposer, analyser, casseFrancaise, reparerEncodage };
