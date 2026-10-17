'use strict';
/* ============================================================
   OASIS — Surlignages en couleurs (rangés avec les notes)

   Un surlignage est une note de type « surlignage » :
     { type, couleur, texte (passage), commentaire, page, unite,
       debut, fin }  — debut/fin : positions dans le texte de la page
       (PDF), du chapitre (EPUB) ou du livre entier (texte intégré).
   Le passage est conservé : s'il a bougé, le lecteur le retrouve
   par sa citation ; sinon il reste visible dans « Mes notes ».
   ============================================================ */
const COULEURS = ['jaune', 'vert', 'bleu', 'rose', 'orange'];
const UNITES = ['page', 'chapitre', 'partie'];
const entier = (v, min, max, nom) => { const n = Number(v); if (!Number.isSafeInteger(n) || n < min || n > max) throw Error(`${nom} invalide.`); return n; };

function valider(b) {
  const couleur = COULEURS.includes(b.couleur) ? b.couleur : 'jaune';
  const unite = UNITES.includes(b.unite) ? b.unite : null;
  if (!unite) throw Error('Emplacement du surlignage invalide.');
  const texte = String(b.texte || '').replace(/\s+/g, ' ').trim();
  if (texte.length < 2) throw Error('Sélectionnez au moins quelques lettres.');
  if (texte.length > 2000) throw Error('Passage trop long : 2 000 caractères au maximum.');
  const page = entier(b.page, 1, 100000, 'Page');
  const debut = entier(b.debut, 0, 2e7, 'Position'), fin = entier(b.fin, 1, 2e7, 'Position');
  if (fin <= debut || fin - debut > 6000) throw Error('Position du passage invalide.');
  return { type: 'surlignage', couleur, texte, commentaire: String(b.commentaire || '').trim().slice(0, 2000), page, unite, debut, fin,
    pourcentage: Number.isFinite(Number(b.pourcentage)) ? Math.max(0, Math.min(100, Math.round(Number(b.pourcentage)))) : null };
}

/** Champs modifiables : couleur et commentaire d'un surlignage, texte d'une note. */
function modification(n, b) {
  const m = {};
  if (n.type === 'surlignage') {
    if (b.couleur !== undefined) { if (!COULEURS.includes(b.couleur)) throw Error('Couleur invalide.'); m.couleur = b.couleur; }
    if (b.commentaire !== undefined) m.commentaire = String(b.commentaire || '').trim().slice(0, 2000);
  } else if (b.texte !== undefined) {
    const t = String(b.texte || '').trim();
    if (!t) throw Error('Le texte de la note est requis.');
    m.texte = t.slice(0, 2000);
  }
  if (!Object.keys(m).length) throw Error('Rien à modifier.');
  return m;
}
module.exports = { valider, modification, COULEURS };
