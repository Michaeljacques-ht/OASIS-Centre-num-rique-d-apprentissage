'use strict';
/* ============================================================
   OASIS — Quiz de lecture à plusieurs niveaux

   L'administrateur publie des quiz rattachés à une catégorie du
   catalogue (et, au besoin, à un livre précis), chacun à un niveau :
     1 Débutant · 2 Intermédiaire · 3 Avancé · 4 Expert
   Dans une catégorie, un niveau se débloque quand le lecteur a
   réussi un quiz du niveau existant juste en dessous.

   La correction se fait uniquement sur le serveur : les bonnes
   réponses ne quittent jamais le serveur avant la soumission.

   Récompenses à la première réussite d'un quiz :
     - un badge (nom et emoji configurables) et des points ;
     - en option, des jours d'accès complet offerts ;
     - le badge « Maître » d'une catégorie quand ses 4 niveaux sont réussis.

   Lecteur :  GET  /api/quiz
              POST /api/quiz/:id/commencer
              POST /api/quiz/tentatives/:tid/soumettre
              GET  /api/quiz/recompenses
              GET  /api/quiz/classement
   Admin :    GET/POST /api/admin-quiz · PUT/DELETE /api/admin-quiz/:id
   ============================================================ */
const crypto = require('crypto');
const { principal } = require('./administration-comptes');

const NIVEAUX = [
  { niveau: 1, nom: 'Débutant', emoji: '🌱', badge: 'Bronze', points: 10 },
  { niveau: 2, nom: 'Intermédiaire', emoji: '📘', badge: 'Argent', points: 20 },
  { niveau: 3, nom: 'Avancé', emoji: '🚀', badge: 'Or', points: 35 },
  { niveau: 4, nom: 'Expert', emoji: '🏆', badge: 'Diamant', points: 50 }
];
const POINTS_MAITRISE = 100;
const RANGS = [
  { min: 0, nom: 'Lecteur curieux', emoji: '🔎' },
  { min: 50, nom: 'Explorateur des pages', emoji: '🧭' },
  { min: 150, nom: 'Érudit', emoji: '🎓' },
  { min: 400, nom: 'Sage d’OASIS', emoji: '🦉' }
];
const MARGE_SECONDES = 30;

const niveauInfo = (n) => NIVEAUX.find(x => x.niveau === n) || NIVEAUX[0];
const texte = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
const melange = (n) => { const t = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [t[i], t[j]] = [t[j], t[i]]; } return t; };
const entier = (v, defaut, min, max) => { const n = v === undefined || v === '' ? defaut : Number(v); if (!Number.isSafeInteger(n) || n < min || n > max) throw Error(`Valeur hors limites (${min} à ${max}).`); return n; };

function init(db) {
  db.quiz ||= []; db.quizTentatives ||= []; db.quizBadges ||= [];
}

/* ---------- Validation d'un quiz saisi par l'administrateur ---------- */
function validerQuiz(b, db, uid, existant) {
  const titre = texte(b.titre, 160);
  if (titre.length < 3) throw Error('Le titre du quiz doit contenir au moins 3 caractères.');
  const categorie = texte(b.categorie, 80);
  const categories = (db.categories || []).map(c => c.nom);
  if (!categorie || (!categories.includes(categorie) && categorie !== existant?.categorie)) throw Error('Choisissez une catégorie existante du catalogue.');
  const niveau = entier(b.niveau, 1, 1, NIVEAUX.length);
  let livreId = b.livreId ? String(b.livreId) : null;
  if (livreId && !(db.livres || []).some(l => l.id === livreId)) throw Error('Le livre associé est introuvable.');
  if (!Array.isArray(b.questions) || b.questions.length < 1 || b.questions.length > 50) throw Error('Un quiz contient de 1 à 50 questions.');
  const ids = new Set();
  const questions = b.questions.map((q, i) => {
    const enonce = texte(q?.enonce, 500);
    if (enonce.length < 3) throw Error(`Question ${i + 1} : énoncé manquant.`);
    const choix = Array.isArray(q.choix) ? q.choix.map(c => texte(c, 200)).filter(Boolean) : [];
    if (choix.length < 2 || choix.length > 6) throw Error(`Question ${i + 1} : de 2 à 6 réponses possibles.`);
    if (new Set(choix.map(c => c.toLowerCase())).size !== choix.length) throw Error(`Question ${i + 1} : deux réponses sont identiques.`);
    const bonne = Number(q.bonne);
    if (!Number.isInteger(bonne) || bonne < 0 || bonne >= choix.length) throw Error(`Question ${i + 1} : indiquez la bonne réponse.`);
    let id = /^[a-z0-9]{4,32}$/.test(q.id || '') && !ids.has(q.id) ? q.id : uid();
    ids.add(id);
    return { id, enonce, choix, bonne, explication: texte(q.explication, 500) };
  });
  const info = niveauInfo(niveau);
  const r = b.recompense || {};
  const emoji = texte(r.badgeEmoji, 8) || info.emoji;
  return {
    titre, description: texte(b.description, 600), categorie, niveau, livreId, questions,
    seuil: entier(b.seuil, 70, 50, 100),
    dureeMinutes: entier(b.dureeMinutes, 0, 0, 180),
    tentativesMax: entier(b.tentativesMax, 0, 0, 50),
    melanger: b.melanger !== false,
    afficherCorrection: b.afficherCorrection !== false,
    publie: b.publie === true,
    recompense: {
      badgeNom: texte(r.badgeNom, 80) || `${info.badge} · ${categorie}`,
      badgeEmoji: emoji,
      points: entier(r.points, info.points, 0, 1000),
      joursOfferts: entier(r.joursOfferts, 0, 0, 90)
    }
  };
}

/* ---------- Progression d'un lecteur ---------- */
const reussites = (db, uId) => new Set(db.quizBadges.filter(x => x.utilisateurId === uId && x.type === 'quiz').map(x => x.quizId));
const pointsDe = (db, uId) => db.quizBadges.filter(x => x.utilisateurId === uId).reduce((s, x) => s + (x.points || 0), 0);
const rangDe = (points) => {
  const i = RANGS.reduce((k, r, j) => points >= r.min ? j : k, 0);
  return { ...RANGS[i], prochain: RANGS[i + 1] || null };
};
const publies = (db) => db.quiz.filter(q => q.publie);

/** Niveaux réussis par catégorie : { categorie: Set(niveaux) } */
function niveauxReussis(db, uId) {
  const faits = reussites(db, uId), carte = {};
  for (const q of db.quiz) if (faits.has(q.id)) (carte[q.categorie] ||= new Set()).add(q.niveau);
  for (const b of db.quizBadges) if (b.utilisateurId === uId && b.type === 'quiz') (carte[b.categorie] ||= new Set()).add(b.niveau);
  return carte;
}

/** Un quiz est-il accessible ? Le niveau publié juste en dessous doit être réussi. */
function verrou(db, q, carte) {
  const inferieurs = [...new Set(publies(db).filter(x => x.categorie === q.categorie && x.niveau < q.niveau).map(x => x.niveau))];
  if (!inferieurs.length) return null;
  const requis = Math.max(...inferieurs);
  return carte[q.categorie]?.has(requis) ? null : `Réussissez d’abord un quiz « ${niveauInfo(requis).nom} » de cette catégorie.`;
}

const tentativesFaites = (db, uId, qId) => db.quizTentatives.filter(t => t.utilisateurId === uId && t.quizId === qId && t.statut === 'terminee');

function vueQuizLecteur(db, q, u, carte, faits) {
  const faites = tentativesFaites(db, u.id, q.id);
  const meilleur = faites.reduce((m, t) => Math.max(m, t.pourcentage), -1);
  const livre = q.livreId ? (db.livres || []).find(l => l.id === q.livreId) : null;
  return {
    id: q.id, titre: q.titre, description: q.description, categorie: q.categorie, niveau: q.niveau,
    nbQuestions: q.questions.length, dureeMinutes: q.dureeMinutes, seuil: q.seuil,
    tentatives: faites.length, tentativesRestantes: q.tentativesMax ? Math.max(0, q.tentativesMax - faites.length) : null,
    meilleur: meilleur < 0 ? null : meilleur, reussi: faits.has(q.id), verrou: verrou(db, q, carte),
    livre: livre ? { id: livre.id, titre: livre.titre } : null,
    recompense: q.recompense
  };
}

/* ---------- Attribution des récompenses ---------- */
function recompenser(db, u, q, uid) {
  const nouvelles = [];
  if (db.quizBadges.some(b => b.utilisateurId === u.id && b.type === 'quiz' && b.quizId === q.id)) return nouvelles;
  const maintenant = new Date().toISOString();
  const badge = { id: uid(), type: 'quiz', utilisateurId: u.id, quizId: q.id, quizTitre: q.titre, categorie: q.categorie, niveau: q.niveau,
    nom: q.recompense.badgeNom, emoji: q.recompense.badgeEmoji, points: q.recompense.points, joursOfferts: q.recompense.joursOfferts, date: maintenant };
  db.quizBadges.push(badge); nouvelles.push(badge);
  if (q.recompense.joursOfferts > 0) {
    const depart = new Date(Math.max(Date.now(), new Date(u.accesOffertFin || 0).getTime() || 0));
    depart.setUTCDate(depart.getUTCDate() + q.recompense.joursOfferts);
    u.accesOffertFin = depart.toISOString();
  }
  // Badge de maîtrise : les quatre niveaux de la catégorie réussis.
  const carte = niveauxReussis(db, u.id);
  const deja = db.quizBadges.some(b => b.utilisateurId === u.id && b.type === 'maitrise' && b.categorie === q.categorie);
  if (!deja && NIVEAUX.every(n => carte[q.categorie]?.has(n.niveau))) {
    const m = { id: uid(), type: 'maitrise', utilisateurId: u.id, categorie: q.categorie, niveau: 4,
      nom: `Maître · ${q.categorie}`, emoji: '👑', points: POINTS_MAITRISE, joursOfferts: 0, date: maintenant };
    db.quizBadges.push(m); nouvelles.push(m);
  }
  return nouvelles;
}

function nettoyer(db) {
  const limite = Date.now() - 7 * 864e5;
  db.quizTentatives = db.quizTentatives.filter(t => t.statut === 'terminee' || new Date(t.debut).getTime() > limite);
}

/* ============================================================ */
async function route(req, res, c) {
  const { db, utilisateur: u, json, lireCorps, sauverDB, uid, journal } = c;
  const url = new URL(req.url, 'http://localhost');
  const s = url.pathname.split('/').filter(Boolean), m = req.method;
  const envoyer = (code, data) => { json(res, code, data); return true; };
  if (s[0] !== 'api' || !['quiz', 'admin-quiz'].includes(s[1])) return false;
  init(db);

  /* ---------------- Lecteur ---------------- */
  if (s[1] === 'quiz') {
    if (!u) return envoyer(401, { erreur: 'Connectez-vous pour participer aux quiz de lecture.' });

    if (s.length === 2 && m === 'GET') {
      const carte = niveauxReussis(db, u.id), faits = reussites(db, u.id);
      const parCategorie = {};
      for (const q of publies(db)) (parCategorie[q.categorie] ||= []).push(vueQuizLecteur(db, q, u, carte, faits));
      const categories = Object.entries(parCategorie).sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([nom, liste]) => ({
        nom,
        maitrise: db.quizBadges.some(b => b.utilisateurId === u.id && b.type === 'maitrise' && b.categorie === nom),
        niveaux: NIVEAUX.map(n => ({ ...n, reussi: !!carte[nom]?.has(n.niveau), quiz: liste.filter(q => q.niveau === n.niveau).sort((a, b) => a.titre.localeCompare(b.titre, 'fr')) })).filter(n => n.quiz.length)
      }));
      const points = pointsDe(db, u.id);
      return envoyer(200, { niveaux: NIVEAUX, categories, profil: { points, rang: rangDe(points), badges: db.quizBadges.filter(b => b.utilisateurId === u.id).length } });
    }

    if (s[2] === 'recompenses' && m === 'GET') {
      const points = pointsDe(db, u.id);
      return envoyer(200, { nom: u.nom, points, rang: rangDe(points), rangs: RANGS, accesOffertFin: u.accesOffertFin || null,
        badges: db.quizBadges.filter(b => b.utilisateurId === u.id).sort((a, b) => b.date.localeCompare(a.date)).map(({ utilisateurId, ...b }) => b) });
    }

    if (s[2] === 'classement' && m === 'GET') {
      const ecole = u.ecoleId || null;
      const lecteurs = (db.utilisateurs || []).filter(x => x.role === 'apprenant' && (x.ecoleId || null) === ecole)
        .map(x => ({ id: x.id, nom: x.nom, points: pointsDe(db, x.id), badges: db.quizBadges.filter(b => b.utilisateurId === x.id).length }))
        .filter(x => x.points > 0 || x.id === u.id).sort((a, b) => b.points - a.points || b.badges - a.badges).slice(0, 10)
        .map(({ id, ...x }) => ({ ...x, moi: id === u.id }));
      return envoyer(200, lecteurs);
    }

    if (s.length === 4 && s[3] === 'commencer' && m === 'POST') {
      const q = db.quiz.find(x => x.id === s[2] && x.publie);
      if (!q) return envoyer(404, { erreur: 'Quiz introuvable.' });
      const raison = verrou(db, q, niveauxReussis(db, u.id));
      if (raison) return envoyer(403, { erreur: raison });
      if (q.tentativesMax && tentativesFaites(db, u.id, q.id).length >= q.tentativesMax) return envoyer(409, { erreur: 'Vous avez utilisé toutes vos tentatives pour ce quiz.' });
      nettoyer(db);
      const ordre = q.melanger ? melange(q.questions.length) : [...q.questions.keys()];
      const questions = ordre.map(i => {
        const qu = q.questions[i];
        const perm = q.melanger ? melange(qu.choix.length) : [...qu.choix.keys()];
        return { id: qu.id, enonce: qu.enonce, choix: perm.map(k => qu.choix[k]), bonne: perm.indexOf(qu.bonne), explication: qu.explication };
      });
      const debut = new Date();
      const t = { id: uid(), quizId: q.id, utilisateurId: u.id, debut: debut.toISOString(), statut: 'en_cours',
        finPrevue: q.dureeMinutes ? new Date(debut.getTime() + q.dureeMinutes * 60000).toISOString() : null, questions };
      // une seule tentative ouverte par quiz et par lecteur
      db.quizTentatives = db.quizTentatives.filter(x => !(x.utilisateurId === u.id && x.quizId === q.id && x.statut === 'en_cours'));
      db.quizTentatives.push(t); sauverDB();
      return envoyer(201, { tentative: t.id, titre: q.titre, niveau: q.niveau, seuil: q.seuil, finPrevue: t.finPrevue, dureeMinutes: q.dureeMinutes,
        questions: questions.map(x => ({ id: x.id, enonce: x.enonce, choix: x.choix })) });
    }

    if (s[2] === 'tentatives' && s[3] && s[4] === 'soumettre' && m === 'POST') {
      const t = db.quizTentatives.find(x => x.id === s[3] && x.utilisateurId === u.id);
      if (!t) return envoyer(404, { erreur: 'Tentative introuvable.' });
      if (t.statut !== 'en_cours') return envoyer(409, { erreur: 'Cette tentative a déjà été corrigée.' });
      const q = db.quiz.find(x => x.id === t.quizId);
      if (!q) return envoyer(404, { erreur: 'Ce quiz a été retiré.' });
      const b = await lireCorps(req);
      const reponses = b && typeof b.reponses === 'object' && b.reponses ? b.reponses : {};
      const horsDelai = !!t.finPrevue && Date.now() > new Date(t.finPrevue).getTime() + MARGE_SECONDES * 1000;
      let bonnes = 0;
      const corrections = t.questions.map(x => {
        const r = Number.isInteger(reponses[x.id]) ? reponses[x.id] : null;
        const juste = r === x.bonne;
        if (juste) bonnes++;
        return { enonce: x.enonce, choix: x.choix, votre: r, bonne: x.bonne, juste, explication: x.explication };
      });
      const pourcentage = Math.round(bonnes / t.questions.length * 100);
      const reussi = !horsDelai && pourcentage >= q.seuil;
      Object.assign(t, { statut: 'terminee', fin: new Date().toISOString(), bonnes, total: t.questions.length, pourcentage, reussi, horsDelai });
      delete t.questions; // inutile de conserver les copies d'énoncés
      const nouvelles = reussi ? recompenser(db, u, q, uid) : [];
      if (nouvelles.length) journal?.('Badge de quiz obtenu', u, nouvelles.map(x => x.nom).join(', '));
      sauverDB();
      const restantes = q.tentativesMax ? Math.max(0, q.tentativesMax - tentativesFaites(db, u.id, q.id).length) : null;
      return envoyer(200, { bonnes, total: t.total, pourcentage, seuil: q.seuil, reussi, horsDelai, tentativesRestantes: restantes,
        corrections: q.afficherCorrection ? corrections : null, recompenses: nouvelles.map(({ utilisateurId, ...x }) => x),
        points: pointsDe(db, u.id), accesOffertFin: u.accesOffertFin || null });
    }
    return envoyer(404, { erreur: 'Route introuvable.' });
  }

  /* ---------------- Administration ---------------- */
  if (!principal(u)) return envoyer(403, { erreur: 'Réservé à l’administrateur principal.' });

  if (s.length === 2 && m === 'GET') {
    const stats = (q) => {
      const ts = db.quizTentatives.filter(t => t.quizId === q.id && t.statut === 'terminee');
      const ok = ts.filter(t => t.reussi).length;
      return { tentatives: ts.length, reussites: ok, lecteurs: new Set(ts.map(t => t.utilisateurId)).size,
        moyenne: ts.length ? Math.round(ts.reduce((s, t) => s + t.pourcentage, 0) / ts.length) : null };
    };
    return envoyer(200, {
      niveaux: NIVEAUX,
      categories: (db.categories || []).map(c => c.nom).sort((a, b) => a.localeCompare(b, 'fr')),
      livres: (db.livres || []).map(l => ({ id: l.id, titre: l.titre, categorie: l.categorie })).sort((a, b) => a.titre.localeCompare(b.titre, 'fr')),
      quiz: db.quiz.map(q => ({ ...q, stats: stats(q) })),
      badgesDistribues: db.quizBadges.length
    });
  }
  if (s.length === 2 && m === 'POST') {
    let q;
    try { q = validerQuiz(await lireCorps(req), db, uid); } catch (e) { return envoyer(400, { erreur: e.message }); }
    const quiz = { id: uid(), ...q, creeLe: new Date().toISOString(), auteurId: u.id };
    db.quiz.push(quiz); journal?.('Quiz créé', u, `${quiz.titre} (${quiz.categorie}, niveau ${quiz.niveau})`); sauverDB();
    return envoyer(201, quiz);
  }
  const q = s[2] && db.quiz.find(x => x.id === s[2]);
  if (s.length === 3 && !q) return envoyer(404, { erreur: 'Quiz introuvable.' });
  if (s.length === 3 && m === 'PUT') {
    const b = await lireCorps(req);
    if (Object.keys(b).length === 1 && typeof b.publie === 'boolean') {
      q.publie = b.publie; q.modifieLe = new Date().toISOString();
      journal?.(b.publie ? 'Quiz publié' : 'Quiz retiré de la publication', u, q.titre); sauverDB();
      return envoyer(200, q);
    }
    let maj;
    try { maj = validerQuiz(b, db, uid, q); } catch (e) { return envoyer(400, { erreur: e.message }); }
    Object.assign(q, maj, { modifieLe: new Date().toISOString() });
    // les tentatives ouvertes gardent leur copie des questions : on peut modifier sans les casser
    journal?.('Quiz modifié', u, q.titre); sauverDB();
    return envoyer(200, q);
  }
  if (s.length === 3 && m === 'DELETE') {
    db.quiz = db.quiz.filter(x => x.id !== q.id);
    db.quizTentatives = db.quizTentatives.filter(t => !(t.quizId === q.id && t.statut === 'en_cours'));
    journal?.('Quiz supprimé', u, q.titre + ' — les badges déjà obtenus sont conservés'); sauverDB();
    return envoyer(200, { ok: true });
  }
  return envoyer(404, { erreur: 'Route introuvable.' });
}

module.exports = { route, NIVEAUX, RANGS, validerQuiz, verrou, niveauxReussis, pointsDe, rangDe };
