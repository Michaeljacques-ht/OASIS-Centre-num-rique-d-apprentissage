/* OASIS 1.26.0 — Progression de lecture validée par le temps de lecture réel.
   La position (où se trouve le lecteur dans le livre) et la progression validée sont séparées :
   faire défiler un livre déplace la position, mais la progression validée ne peut pas dépasser
   ce que le temps actif de lecture rend plausible (lecture rapide : 2,5 × 200 mots/minute). */
const dureeLecture = require('./duree-lecture');

const VITESSE_MAX = 2.5;          // jusqu'à 500 mots/minute (lecture rapide / survol attentif)
const MARGE = 2;                  // % accordés d'emblée (couverture, sommaire)
const POURCENT_MINUTE_INCONNU = 3; // si la taille du livre est inconnue : 3 % par minute active

function plafond(livre, secondes) {
  const s = Math.max(0, Number(secondes) || 0);
  const est = dureeLecture.estimation(livre);
  const brut = est.minutes ? MARGE + s * 100 * VITESSE_MAX / (est.minutes * 60) : MARGE + s / 60 * POURCENT_MINUTE_INCONNU;
  return Math.max(0, Math.min(100, Math.floor(brut)));
}

/** Met à jour la progression `p` ; `position` (0–100) est facultative. */
function appliquer(p, livre, position) {
  if (position !== undefined && position !== null) {
    const pos = Math.min(100, Math.max(0, Math.round(Number(position) || 0)));
    p.position = pos;
    p.positionMax = Math.max(Number(p.positionMax) || 0, pos);
  }
  p.positionMax = Math.max(Number(p.positionMax) || 0, Number(p.position) || 0);
  p.plafond = plafond(livre, p.secondesLecture);
  if (p.termine) p.pourcentage = 100;
  else p.pourcentage = Math.max(Number(p.pourcentage) || 0, Math.min(p.positionMax, p.plafond));
  return etat(p);
}

/** Recalcule une ancienne progression (avant 1.26.0) qui comptait le simple défilement. */
function migrer(p, livre) {
  if (p.validationTemps) return false;
  p.validationTemps = 1;
  if (p.termine) return true;
  const ancienne = Number(p.pourcentage) || 0;
  if (p.position === undefined) p.position = ancienne;
  p.positionMax = Math.max(Number(p.positionMax) || 0, ancienne);
  p.pourcentage = 0;
  appliquer(p, livre);
  return true;
}

const etat = p => ({ pourcentage: p.pourcentage, position: p.position ?? p.pourcentage, positionMax: p.positionMax ?? p.pourcentage, plafond: p.plafond ?? p.pourcentage, secondesLecture: p.secondesLecture || 0, termine: !!p.termine, limiteParTemps: !p.termine && (p.positionMax || 0) > p.pourcentage });

module.exports = { VITESSE_MAX, plafond, appliquer, migrer, etat };
