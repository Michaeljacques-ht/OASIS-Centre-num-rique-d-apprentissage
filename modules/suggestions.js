'use strict';
/* ============================================================
   OASIS — Recommandations enrichies (sans IA)
     GET /api/suggestions/continuer       « Continuer votre lecture »
     GET /api/livres/:id/aussi-lus        « Les lecteurs de ce livre ont aussi lu »

   Confidentialité : aucun nom n'est affiché ; une suggestion
   « aussi lu » n'apparaît que si au moins 2 lecteurs différents
   l'ont en commun. Chaque lecteur peut désactiver ses suggestions
   personnalisées (PUT /api/suggestions/preferences).
   ============================================================ */
const SEUIL_LECTEURS = 2;

function lecteursDe(db, livreId) {
  const ids = new Set();
  for (const p of db.progressions || []) if (p.livreId === livreId && (p.termine || p.pourcentage >= 10)) ids.add(p.utilisateurId);
  for (const e of db.emprunts || []) if (e.livreId === livreId) ids.add(e.utilisateurId);
  return ids;
}

async function route(req, res, c) {
  const { db, utilisateur: u, json, lireCorps, sauverDB, vueLivre } = c;
  const url = new URL(req.url, 'http://localhost');
  const s = url.pathname.split('/').filter(Boolean), m = req.method;
  const envoyer = (code, data) => { json(res, code, data); return true; };

  if (s[1] === 'suggestions') {
    if (!u) return envoyer(401, { erreur: 'Connexion requise.' });
    if (s[2] === 'preferences' && m === 'PUT') {
      const b = await lireCorps(req);
      if (typeof b.desactivees !== 'boolean') return envoyer(400, { erreur: 'Préférence invalide.' });
      u.suggestionsDesactivees = b.desactivees; sauverDB();
      return envoyer(200, { desactivees: u.suggestionsDesactivees });
    }
    if (s[2] === 'continuer' && m === 'GET') {
      if (u.suggestionsDesactivees) return envoyer(200, { desactivees: true, livres: [] });
      const enCours = (db.progressions || []).filter(p => p.utilisateurId === u.id && !p.termine && p.pourcentage > 0 && p.pourcentage < 100)
        .sort((a, b) => String(b.majLe || b.creeLe).localeCompare(String(a.majLe || a.creeLe))).slice(0, 6);
      const livres = enCours.map(p => { const l = db.livres.find(x => x.id === p.livreId); return l && { ...vueLivre(l, u), pourcentageLu: p.pourcentage, luLe: p.majLe || p.creeLe }; }).filter(Boolean);
      return envoyer(200, { desactivees: false, livres });
    }
    return envoyer(404, { erreur: 'Route introuvable.' });
  }

  if (s[1] === 'livres' && s[2] && s[3] === 'aussi-lus' && m === 'GET') {
    const l = db.livres.find(x => x.id === s[2]);
    if (!l) return envoyer(404, { erreur: 'Livre introuvable.' });
    if (u?.suggestionsDesactivees) return envoyer(200, { livres: [], desactivees: true });
    const lecteurs = lecteursDe(db, l.id);
    const compte = new Map();
    for (const p of db.progressions || []) if (lecteurs.has(p.utilisateurId) && p.livreId !== l.id && (p.termine || p.pourcentage >= 10)) (compte.get(p.livreId) || compte.set(p.livreId, new Set()).get(p.livreId)).add(p.utilisateurId);
    for (const e of db.emprunts || []) if (lecteurs.has(e.utilisateurId) && e.livreId !== l.id) (compte.get(e.livreId) || compte.set(e.livreId, new Set()).get(e.livreId)).add(e.utilisateurId);
    const livres = [...compte].map(([id, us]) => ({ id, n: [...us].filter(x => x !== u?.id).length + (us.has(u?.id) ? 1 : 0) }))
      .filter(x => x.n >= SEUIL_LECTEURS).sort((a, b) => b.n - a.n).slice(0, 6)
      .map(x => { const b = db.livres.find(y => y.id === x.id); return b && { ...vueLivre(b, u), lecteursCommuns: x.n }; }).filter(Boolean);
    // à défaut, même catégorie (métadonnées)
    const complement = livres.length < 3 ? db.livres.filter(b => b.id !== l.id && b.categorie && b.categorie === l.categorie && !livres.some(x => x.id === b.id))
      .sort((a, b) => (b.nbLectures || 0) - (a.nbLectures || 0)).slice(0, 4 - livres.length).map(b => ({ ...vueLivre(b, u), memeCategorie: true })) : [];
    return envoyer(200, { livres: [...livres, ...complement] });
  }
  return false;
}
module.exports = { route, lecteursDe, SEUIL_LECTEURS };
