/**
 * OASIS Bibliothèque Numérique — Serveur
 * Node.js pur, zéro dépendance npm. Base de données JSON.
 * (c) Oasis — Haïti
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const abonnement = require('./modules/abonnement');
const diffusion = require('./modules/diffusion');
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');

// Les règles de fonctionnement sont des paramètres modifiables dans l'espace bibliothécaire
function seedParametres() {
  return {
    nom: 'OASIS Bibliothèque Numérique',
    slogan: 'Apprendre aujourd\'hui pour un meilleur demain',
    messageAccueil: 'bienvenue dans votre bibliothèque !',
    dureeEmpruntPhysique: 14,   // jours
    dureeEmpruntNumerique: 21,  // jours
    maxEmprunts: 5,
    retraitReservationJours: 3, // délai pour retirer un livre réservé mis de côté
    nbPlacesLecture: 12,        // places assises en salle de lecture
    creneaux: ['08:00–10:00', '10:00–12:00', '13:00–15:00', '15:00–17:00'],
    adresse: '', telephone: '', email: '', horaires: '',
    piedDePage: 'OASIS Bibliothèque Numérique © 2026 — Haïti 🇭🇹',
    aPropos: "OASIS Bibliothèque Numérique est une plateforme d'apprentissage et de bibliothèque hybride (physique et numérique) au service des écoles, universités, bibliothèques et centres de formation d'Haïti. Elle offre aux apprenants l'accès aux livres, e-books, ressources documentaires et contenus multimédias, avec des outils de collaboration, de suivi de lecture et de motivation. Apprendre aujourd'hui pour un meilleur demain." 
  };
}

// ---------- Base de données JSON ----------
let db = null;
function chargerDB() {
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // Migration douce : les bases créées avant ces fonctionnalités reçoivent les nouvelles collections
    if (!db.reservations) db.reservations = [];
    if (!db.placesLecture) db.placesLecture = [];
    if (!db.ressources) { db.ressources = seedRessources(); sauverDB(); }
    if (!db.categories) { db.categories = seedCategories(); sauverDB(); }
    if (!db.parametres) db.parametres = seedParametres();
    else { const defauts = seedParametres(); Object.keys(defauts).forEach(k => { if (db.parametres[k] === undefined) db.parametres[k] = defauts[k]; }); }
    db.ressources.forEach(r => { if (r.icone === undefined) r.icone = ''; if (r.image === undefined) r.image = false; });
    if (db.parametres && !db.parametres.marqueOasis) {
      // Passage à la marque Oasis : on ne remplace que les valeurs restées à l'ancien défaut
      const p = db.parametres;
      if (!p.nom || /EDUCA/i.test(p.nom)) p.nom = 'OASIS Bibliothèque Numérique';
      if (!p.slogan || p.slogan === 'Découvrez un Monde de Savoirs !') p.slogan = 'Apprendre aujourd\'hui pour un meilleur demain';
      if (!p.piedDePage || /EDUCA Technologie/i.test(p.piedDePage)) p.piedDePage = 'OASIS Bibliothèque Numérique © 2026 — Haïti 🇭🇹';
      if (!p.aPropos || /^EDUCA Biblioth/.test(p.aPropos)) p.aPropos = "OASIS Bibliothèque Numérique est une plateforme d'apprentissage et de bibliothèque hybride (physique et numérique) au service des écoles, universités, bibliothèques et centres de formation d'Haïti. Elle offre aux apprenants l'accès aux livres, e-books, ressources documentaires et contenus multimédias, avec des outils de collaboration, de suivi de lecture et de motivation. Apprendre aujourd'hui pour un meilleur demain.";
      const pris = e => db.utilisateurs.some(u => u.email === e);
      db.utilisateurs.forEach(u => {
        if (u.email === 'admin@educa.ht' && !pris('admin@oasis.ht')) { u.email = 'admin@oasis.ht'; if (u.nom === 'Bibliothécaire EDUCA') u.nom = 'Bibliothécaire Oasis'; }
        if (u.email === 'emma@educa.ht' && !pris('emma@oasis.ht')) u.email = 'emma@oasis.ht';
      });
      p.marqueOasis = true;
      sauverDB();
    }
    ['progressions', 'notes', 'journal', 'medias', 'progressionsMedias', 'groupes', 'messagesGroupes', 'commentaires', 'invitations'].forEach(k => { if (!db[k]) db[k] = []; });
    db.livres.forEach(l => { if (l.editeur === undefined) l.editeur = ''; if (l.langue === undefined) l.langue = 'Français'; if (l.niveau === undefined) l.niveau = ''; if (l.motsCles === undefined) l.motsCles = ''; if (l.nbTelechargements === undefined) l.nbTelechargements = 0; });
    db.ressources.forEach(r => { if (r.lien === undefined) r.lien = ''; });
    if (!db.parametres.identiteBibliothequeNumerique) {
      db.parametres.nom = 'OASIS Bibliothèque Numérique';
      db.parametres.piedDePage = 'OASIS Bibliothèque Numérique © 2026 — Haïti';
      db.parametres.aPropos = (db.parametres.aPropos || '').replace(/Oasis Centre numérique d.apprentissage/gi, 'OASIS Bibliothèque Numérique');
      db.parametres.identiteBibliothequeNumerique = true;
      sauverDB();
    }
  } else {
    db = seed();
    sauverDB();
  }
}
let ecritureEnAttente = false;
function sauverDB() {
  if (ecritureEnAttente) return;
  ecritureEnAttente = true;
  setTimeout(() => {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    ecritureEnAttente = false;
  }, 50);
}
const uid = () => crypto.randomBytes(8).toString('hex');
const maintenant = () => new Date().toISOString();
const hashMdp = (mdp, sel) => {
  sel = sel || crypto.randomBytes(8).toString('hex');
  return { sel, hash: crypto.scryptSync(mdp, sel, 32).toString('hex') };
};
const verifMdp = (mdp, u) => hashMdp(mdp, u.sel).hash === u.hash;
function journal(action, utilisateur, detail) {
  db.journal.unshift({ date: maintenant(), utilisateur: utilisateur ? utilisateur.nom : 'Système', action, detail: detail || '' });
  if (db.journal.length > 500) db.journal.length = 500;
}
function toucherActivite(u) { if (u) u.derniereActivite = maintenant(); }

// ---------- Données initiales ----------
function seedCategories() {
  const C = (nom, icone, couleur) => ({ id: uid(), nom, icone, couleur, creeLe: maintenant() });
  return [
    C('Sciences', '🔬', '#1f7a4d'), C('Histoire', '🏛️', '#d1571f'), C('Littérature', '📚', '#6e4a2a'),
    C('Informatique', '💻', '#1e4fa3'), C('Roman', '📖', '#8a1c1c'), C('Mathématiques', '📐', '#14532d'),
    C('Philosophie', '🏺', '#334155')
  ];
}

function seedRessources() {
  const R = (genre, titre, contenu, source = '', lien = '') => ({ id: uid(), genre, titre, contenu, source, lien, creeLe: maintenant() });
  return [
    R('dictionnaire', 'Technopédagogie', 'Nom féminin. Discipline qui étudie l\'intégration réfléchie des technologies dans l\'enseignement et l\'apprentissage, en articulant pédagogie, contenus et outils numériques (voir modèle TPACK).'),
    R('dictionnaire', 'TICE', 'Sigle. Technologies de l\'Information et de la Communication pour l\'Enseignement : ensemble des outils numériques mobilisés à des fins pédagogiques.'),
    R('dictionnaire', 'Konbit', 'Nom (créole haïtien). Travail collectif et solidaire où la communauté unit ses forces pour accomplir une tâche commune ; symbole d\'entraide dans la culture haïtienne.'),
    R('dictionnaire', 'Lakou', 'Nom (créole haïtien). Espace de vie communautaire traditionnel regroupant plusieurs habitations autour d\'une cour commune ; unité sociale et culturelle fondamentale en Haïti.'),
    R('encyclopedie', 'Haïti', 'République caribéenne occupant le tiers occidental de l\'île d\'Hispaniola. Première république noire indépendante du monde (1er janvier 1804), issue de la révolution menée notamment par Toussaint Louverture et Jean-Jacques Dessalines. Capitale : Port-au-Prince. Langues officielles : créole haïtien et français.', 'Collection Oasis'),
    R('encyclopedie', 'Jacques Roumain', 'Écrivain, ethnologue et homme politique haïtien (1907–1944). Fondateur du Bureau d\'Ethnologie d\'Haïti, il est l\'auteur de « Gouverneurs de la Rosée » (1944), chef-d\'œuvre du roman paysan haïtien traduit dans de nombreuses langues.', 'Collection Oasis'),
    R('encyclopedie', 'Citadelle Laferrière', 'Forteresse monumentale érigée entre 1805 et 1820 sur le pic Laferrière, près de Milot, sur ordre du roi Henri Christophe pour défendre le nord d\'Haïti. Classée au patrimoine mondial de l\'UNESCO en 1982, c\'est la plus grande forteresse des Amériques.', 'Collection Oasis'),
    R('base', 'Catalogue des manuels scolaires', 'Base documentaire des manuels scolaires et ressources pédagogiques : manuels hybrides à QR codes, guides de l\'enseignant, cahiers d\'exercices conformes aux programmes du MENFP.', 'Oasis'),
    R('base', 'Base documentaire MENFP', 'Référentiel des programmes officiels, curricula et documents-cadres du Ministère de l\'Éducation Nationale et de la Formation Professionnelle d\'Haïti.', 'MENFP'),
    R('administratif', 'Règlement intérieur de la bibliothèque', 'Conditions d\'emprunt, comportement en salle de lecture, horaires et sanctions en cas de retard ou de détérioration des ouvrages.', 'Administration'),
    R('historique', 'Acte de l\'Indépendance d\'Haïti (1804)', 'Document fondateur proclamé le 1er janvier 1804 aux Gonaïves par Jean-Jacques Dessalines, marquant la naissance de la première république noire indépendante.', 'Archives nationales'),
    R('base', 'Revues scientifiques en éducation', 'Répertoire de revues savantes en sciences de l\'éducation et technopédagogie accessibles librement : Revue internationale des technologies en pédagogie universitaire, frantice.net, Éducation et francophonie.', 'Accès libre')
  ];
}

function seed() {
  const admin = hashMdp('admin123');
  const demo = hashMdp('demo123');
  const utilisateurs = [
    { id: uid(), nom: 'Bibliothécaire Oasis', email: 'admin@oasis.ht', role: 'bibliothecaire', ...admin, creeLe: maintenant() },
    { id: uid(), nom: 'Emma Pierre', email: 'emma@oasis.ht', role: 'apprenant', classe: 'Terminale', ...demo, creeLe: maintenant() }
  ];
  const cat = ['Sciences', 'Histoire', 'Littérature', 'Informatique', 'Roman', 'Mathématiques', 'Philosophie'];
  const L = (titre, auteur, categorie, type, resume, couleur, icone, extras = {}) => ({
    id: uid(), titre, auteur, categorie, type, resume, couleur, icone,
    annee: extras.annee || 2024, notes: extras.notes || [], nbLectures: extras.nbLectures || 0,
    editeur: extras.editeur || 'Oasis', langue: extras.langue || 'Français', niveau: extras.niveau || '', motsCles: extras.motsCles || '', nbTelechargements: 0,
    contenu: extras.contenu || null, isbn: extras.isbn || '', creeLe: maintenant()
  });
  const chapitreDemo = (t) => `# ${t}\n\n## Chapitre 1 — Introduction\n\nBienvenue dans cet ouvrage de la collection Oasis. Ce livre numérique a été conçu pour accompagner les apprenants haïtiens dans leur parcours scolaire, avec des contenus ancrés dans les réalités locales.\n\nLa lecture en ligne vous permet d'avancer à votre rythme, de reprendre là où vous vous êtes arrêté et d'ajouter le livre à vos favoris.\n\n## Chapitre 2 — Développement\n\nChaque notion est présentée de façon progressive, avec des exemples concrets tirés du contexte haïtien et des exercices d'application.\n\n## Chapitre 3 — Pour aller plus loin\n\nDes ressources complémentaires sont disponibles dans la section Ressources de la plateforme.`;
  const livres = [
    L('Les Secrets de l\'Univers', 'Collection Oasis Sciences', 'Sciences', 'numerique', 'Un voyage fascinant à travers l\'astronomie moderne : galaxies, trous noirs et origines du cosmos.', '#3b2a6e', '🌌', { contenu: chapitreDemo('Les Secrets de l\'Univers'), nbLectures: 87, notes: [5,5,4,5] }),
    L('Histoire de France', 'Marc Delcourt', 'Histoire', 'numerique', 'De la Gaule à la Ve République : les grandes étapes de l\'histoire française.', '#d1571f', '🏛️', { contenu: chapitreDemo('Histoire de France'), nbLectures: 64, notes: [4,4,5] }),
    L('Apprendre la Programmation', 'Équipe Oasis', 'Informatique', 'numerique', 'Initiation à la programmation : algorithmes, variables, boucles et premiers projets concrets.', '#1f7a4d', '💻', { contenu: chapitreDemo('Apprendre la Programmation'), nbLectures: 132, notes: [5,5,5,4,5] }),
    L('Littérature Classique', 'Anthologie Oasis', 'Littérature', 'numerique', 'Les grands textes du patrimoine littéraire francophone, dont la littérature haïtienne.', '#6e4a2a', '📜', { contenu: chapitreDemo('Littérature Classique'), nbLectures: 45, notes: [4,5,4] }),
    L('1984', 'George Orwell', 'Roman', 'physique', 'Le chef-d\'œuvre dystopique sur la surveillance et le totalitarisme.', '#8a1c1c', '👁️', { annee: 1949, nbLectures: 210, notes: [5,5,5,5,4], isbn: '978-0-452-28423-4' }),
    L('Le Petit Prince', 'Antoine de Saint-Exupéry', 'Roman', 'physique', 'Le conte poétique et philosophique le plus traduit au monde.', '#2a5d8a', '🦊', { annee: 1943, nbLectures: 198, notes: [5,5,5,5], isbn: '978-2-07-040850-4' }),
    L('Cours de Maths Terminale', 'Programme MENFP', 'Mathématiques', 'numerique', 'Cours complet conforme au programme du secondaire haïtien : analyse, probabilités, géométrie.', '#14532d', '📐', { contenu: chapitreDemo('Cours de Maths Terminale'), nbLectures: 156, notes: [5,4,5,5] }),
    L('La Théorie de l\'Évolution', 'Collection Oasis Sciences', 'Sciences', 'numerique', 'Darwin, la sélection naturelle et la biologie évolutive expliquées simplement.', '#7c5a1e', '🦎', { contenu: chapitreDemo('La Théorie de l\'Évolution'), nbLectures: 73, notes: [5,5,5,5,5] }),
    L('Gouverneurs de la Rosée', 'Jacques Roumain', 'Littérature', 'physique', 'Le roman haïtien majeur : Manuel revient de Cuba et lutte pour l\'eau et l\'unité de son village.', '#356e2a', '🌾', { annee: 1944, nbLectures: 175, notes: [5,5,5,5], isbn: '978-2-89712-000-1', contenu: chapitreDemo('Gouverneurs de la Rosée') }),
    L('À la Croisée des Mondes', 'Philip Pullman', 'Roman', 'physique', 'Une trilogie fantastique entre mondes parallèles, dæmons et poussière mystérieuse.', '#4a2a6e', '🧭', { annee: 1995, nbLectures: 92, notes: [4,5,4] }),
    L('Les Grandes Inventions', 'Collection Oasis Sciences', 'Sciences', 'numerique', 'De l\'imprimerie à l\'intelligence artificielle : les inventions qui ont changé le monde.', '#1e4fa3', '💡', { contenu: chapitreDemo('Les Grandes Inventions'), nbLectures: 58, notes: [4,4,5] }),
    L('Le Symbolisme Poétique', 'Anthologie Oasis', 'Littérature', 'numerique', 'Baudelaire, Verlaine, Rimbaud : comprendre le mouvement symboliste.', '#5a2a5a', '🕊️', { contenu: chapitreDemo('Le Symbolisme Poétique'), nbLectures: 34, notes: [4,5] }),
    L('Philosophie — Les Grands Courants', 'Programme MENFP', 'Philosophie', 'numerique', 'De Socrate à Sartre : panorama des courants philosophiques au programme du bac.', '#334155', '🏺', { contenu: chapitreDemo('Philosophie — Les Grands Courants'), nbLectures: 41, notes: [5,4,4] })
  ];
  // Exemplaires physiques pour les livres de type "physique"
  const exemplaires = [];
  livres.filter(l => l.type === 'physique').forEach((l, i) => {
    const n = 2 + (i % 2); // 2 ou 3 exemplaires
    for (let j = 1; j <= n; j++) {
      exemplaires.push({ id: uid(), livreId: l.id, cote: `${l.categorie.slice(0,3).toUpperCase()}-${String(i+1).padStart(2,'0')}-${j}`, etat: 'bon', statut: 'disponible', creeLe: maintenant() });
    }
  });
  return { utilisateurs, livres, exemplaires, emprunts: [], favoris: [], listeLecture: [], ressources: seedRessources(), categories: seedCategories(), parametres: seedParametres(), reservations: [], placesLecture: [], progressions: [], notes: [], journal: [], medias: [], progressionsMedias: [], groupes: [], messagesGroupes: [], commentaires: [], invitations: [], sessions: {} };
}

// ---------- Utilitaires HTTP ----------
function json(res, code, data) {
  const corps = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(corps);
}
function lireCorps(req) {
  return new Promise((resolve, reject) => {
    let brut = '';
    req.on('data', c => { brut += c; if (brut.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(brut ? JSON.parse(brut) : {}); } catch { reject(new Error('JSON invalide')); } });
  });
}
const TAILLE_MAX_PDF = 30 * 1024 * 1024; // 30 Mo
function lireBinaire(req) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    let taille = 0;
    req.on('data', c => {
      taille += c.length;
      if (taille > TAILLE_MAX_PDF) { req.destroy(); reject(new Error('Fichier trop volumineux (30 Mo max).')); return; }
      morceaux.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}
const DOSSIER_PDF = path.join(__dirname, 'data', 'pdfs');
const cheminEpub = livreId => path.join(DOSSIER_PDF, livreId + '.epub');
const cheminPdf = livreId => path.join(DOSSIER_PDF, livreId + '.pdf');
const DOSSIER_COUV = path.join(__dirname, 'data', 'couvertures');
const cheminCouv = livreId => path.join(DOSSIER_COUV, livreId + '.png');
const DOSSIER_RES_IMG = path.join(__dirname, 'data', 'ressources-img');
const cheminResImg = resId => path.join(DOSSIER_RES_IMG, resId + '.png');
const DOSSIER_MEDIAS = path.join(__dirname, 'data', 'medias');
const TAILLE_MAX_MEDIA = 300 * 1024 * 1024; // 300 Mo (vidéos)
const MIMES_MEDIAS = {
  audio: { 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/wav': '.wav', 'audio/x-wav': '.wav' },
  video: { 'video/mp4': '.mp4', 'video/webm': '.webm' },
  carte: { 'image/png': '.png', 'image/jpeg': '.jpg', 'application/pdf': '.pdf' }
};
const cheminMedia = m => path.join(DOSSIER_MEDIAS, m.id + (m.ext || ''));
// Réception d'un gros fichier en flux direct vers le disque (sans le charger en mémoire)
function recevoirFichier(req, chemin) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(chemin), { recursive: true });
    let taille = 0;
    const flux = fs.createWriteStream(chemin);
    req.on('data', c => {
      taille += c.length;
      if (taille > TAILLE_MAX_MEDIA) { flux.destroy(); fs.unlink(chemin, () => {}); req.destroy(); reject(new Error('Fichier trop volumineux (300 Mo max).')); }
    });
    req.pipe(flux);
    flux.on('finish', () => resolve(taille));
    flux.on('error', reject);
    req.on('error', () => {});
  });
}
function authentifier(req) {
  const jeton = (req.headers.authorization || '').replace('Bearer ', '');
  const uidSession = db.sessions[jeton];
  if (!uidSession) return null;
  return db.utilisateurs.find(u => u.id === uidSession) || null;
}

// ---------- Logique métier ----------
const moyenneNotes = l => l.notes.length ? Math.round((l.notes.reduce((a,b)=>a+b,0) / l.notes.length) * 10) / 10 : 0;
function vueLivre(l, utilisateur) {
  const ex = db.exemplaires.filter(e => e.livreId === l.id);
  const versionNumerique = !!(l.contenu || l.pdf || l.epub);          // lisible en ligne
  const versionPhysique = ex.length > 0;                     // présent en rayon
  const nbDisponibles = ex.filter(e => e.statut === 'disponible').length;
  const resasActives = db.reservations
    .filter(r => r.livreId === l.id && (r.statut === 'en_attente' || r.statut === 'prete'))
    .sort((a, b) => new Date(a.creeLe) - new Date(b.creeLe));
  let maReservation = null;
  if (utilisateur) {
    const r = resasActives.find(x => x.utilisateurId === utilisateur.id);
    if (r) maReservation = {
      id: r.id, statut: r.statut, echeanceRetrait: r.echeanceRetrait || null,
      position: r.statut === 'prete' ? 0 : resasActives.filter(x => x.statut === 'en_attente' && new Date(x.creeLe) <= new Date(r.creeLe)).length
    };
  }
  return {
    accesComplet: abonnement.actif(db, utilisateur), id: l.id, titre: l.titre, auteur: l.auteur, categorie: l.categorie, type: l.type,
    resume: l.resume, couleur: l.couleur, icone: l.icone, annee: l.annee, isbn: l.isbn,
    note: moyenneNotes(l), nbNotes: l.notes.length, nbLectures: l.nbLectures,
    editeur: l.editeur || '', langue: l.langue || 'Français', niveau: l.niveau || '', motsCles: l.motsCles || '',
    maProgression: utilisateur ? (db.progressions.find(p => p.utilisateurId === utilisateur.id && p.livreId === l.id) || null) : null,
    epub: !!l.epub, pdf: !!l.pdf, couverture: !!l.couverture,
    versionNumerique, versionPhysique,
    hybride: versionNumerique && versionPhysique,
    disponible: versionNumerique || nbDisponibles > 0,
    nbExemplaires: ex.length, nbDisponibles,
    nbReservations: resasActives.length, maReservation,
    favori: utilisateur ? db.favoris.some(f => f.utilisateurId === utilisateur.id && f.livreId === l.id) : false,
    dansListe: utilisateur ? db.listeLecture.some(f => f.utilisateurId === utilisateur.id && f.livreId === l.id) : false,
    creeLe: l.creeLe
  };
}
function joursRetard(emprunt) {
  if (emprunt.statut !== 'en_cours') return 0;
  const diff = Math.floor((Date.now() - new Date(emprunt.echeance).getTime()) / 86400000);
  return Math.max(0, diff);
}

// Quand un exemplaire se libère : il passe au premier de la file d'attente, sinon revient en rayon
function libererExemplaire(exemplaireId, livreId) {
  const ex = db.exemplaires.find(x => x.id === exemplaireId);
  if (!ex) return;
  const suivant = db.reservations
    .filter(r => r.livreId === livreId && r.statut === 'en_attente')
    .sort((a, b) => new Date(a.creeLe) - new Date(b.creeLe))[0];
  if (suivant) {
    ex.statut = 'reserve';
    suivant.statut = 'prete';
    suivant.exemplaireId = ex.id;
    suivant.echeanceRetrait = new Date(Date.now() + db.parametres.retraitReservationJours * 86400000).toISOString();
  } else {
    ex.statut = 'disponible';
  }
}
// Les réservations mises de côté non retirées à temps expirent et passent au suivant
function nettoyerReservations() {
  let modifie = false;
  db.reservations.filter(r => r.statut === 'prete' && new Date(r.echeanceRetrait).getTime() < Date.now()).forEach(r => {
    r.statut = 'expiree';
    libererExemplaire(r.exemplaireId, r.livreId);
    modifie = true;
  });
  if (modifie) sauverDB();
}
function vueReservation(r) {
  const livre = db.livres.find(l => l.id === r.livreId);
  const membre = db.utilisateurs.find(u => u.id === r.utilisateurId);
  const ex = r.exemplaireId ? db.exemplaires.find(x => x.id === r.exemplaireId) : null;
  const enAttente = db.reservations
    .filter(x => x.livreId === r.livreId && x.statut === 'en_attente')
    .sort((a, b) => new Date(a.creeLe) - new Date(b.creeLe));
  return {
    id: r.id, statut: r.statut, creeLe: r.creeLe, echeanceRetrait: r.echeanceRetrait || null,
    position: r.statut === 'en_attente' ? enAttente.findIndex(x => x.id === r.id) + 1 : 0,
    cote: ex ? ex.cote : null,
    livre: livre ? { id: livre.id, titre: livre.titre, auteur: livre.auteur, icone: livre.icone, couleur: livre.couleur } : null,
    membre: membre ? { id: membre.id, nom: membre.nom, email: membre.email } : null
  };
}
function vueEmprunt(e) {
  const livre = db.livres.find(l => l.id === e.livreId);
  const membre = db.utilisateurs.find(u => u.id === e.utilisateurId);
  const ex = e.exemplaireId ? db.exemplaires.find(x => x.id === e.exemplaireId) : null;
  return { ...e, livre: livre ? { titre: livre.titre, auteur: livre.auteur, icone: livre.icone, couleur: livre.couleur, type: livre.type, versionNumerique: !!(livre.contenu || livre.pdf || livre.epub) } : null,
    membre: membre ? { id: membre.id, nom: membre.nom, email: membre.email } : null,
    cote: ex ? ex.cote : null, joursRetard: joursRetard(e) };
}

// ---------- Routeur API ----------
async function api(req, res, u) {
  const { pathname, query } = url.parse(req.url, true);
  const seg = pathname.split('/').filter(Boolean); // ['api', ...]
  const utilisateur = authentifier(req);
  if (pathname === '/api/version' && req.method === 'GET') {
    return json(res, 200, { version: '1.5.1', apercuGratuit: true, abonnements: true });
  }
  if (await abonnement.route(req, res, {db, utilisateur, json, lireCorps, sauverDB, uid})) return;
  if (await diffusion(req, res, { db, utilisateur, json, lireCorps, sauverDB, uid })) return;
  const exigeAuth = () => { if (!utilisateur) { json(res, 401, { erreur: 'Connexion requise.' }); return false; } return true; };
  const exigeBiblio = () => { if (!utilisateur || utilisateur.role !== 'bibliothecaire') { json(res, 403, { erreur: 'Réservé au bibliothécaire.' }); return false; } return true; };
  const m = req.method;

  // --- Auth ---
  if (pathname === '/api/inscription' && m === 'POST') {
    const { nom, email, motDePasse, classe } = await lireCorps(req);
    if (!nom || !email || !motDePasse || motDePasse.length < 6) return json(res, 400, { erreur: 'Nom, email et mot de passe (6 caractères min.) requis.' });
    if (db.utilisateurs.some(x => x.email.toLowerCase() === email.toLowerCase())) return json(res, 409, { erreur: 'Un compte existe déjà avec cet email.' });
    const nu = { id: uid(), nom, email, classe: classe || '', role: 'apprenant', ...hashMdp(motDePasse), creeLe: maintenant() };
    db.utilisateurs.push(nu);
    const jeton = uid() + uid();
    db.sessions[jeton] = nu.id; sauverDB();
    return json(res, 201, { jeton, utilisateur: { id: nu.id, nom: nu.nom, email: nu.email, role: nu.role, classe: nu.classe } });
  }
  if (pathname === '/api/connexion' && m === 'POST') {
    const { email, motDePasse } = await lireCorps(req);
    const cu = db.utilisateurs.find(x => x.email.toLowerCase() === (email||'').trim().toLowerCase());
    if (!cu || !verifMdp(motDePasse || '', cu)) return json(res, 401, { erreur: 'Email ou mot de passe incorrect.' });
    const jeton = uid() + uid();
    db.sessions[jeton] = cu.id; sauverDB();
    return json(res, 200, { jeton, utilisateur: { id: cu.id, nom: cu.nom, email: cu.email, role: cu.role, classe: cu.classe } });
  }
  if (pathname === '/api/moi' && m === 'GET') {
    if (!exigeAuth()) return;
    return json(res, 200, { id: utilisateur.id, nom: utilisateur.nom, email: utilisateur.email, role: utilisateur.role, classe: utilisateur.classe });
  }
  if (pathname === '/api/deconnexion' && m === 'POST') {
    const jeton = (req.headers.authorization || '').replace('Bearer ', '');
    delete db.sessions[jeton]; sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Progression de lecture, historique, livres terminés ---
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'progression' && m === 'POST') {
    if (!exigeAuth()) return;
    const { pourcentage } = await lireCorps(req);
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    let p = db.progressions.find(x => x.utilisateurId === utilisateur.id && x.livreId === l.id);
    if (!p) { p = { id: uid(), utilisateurId: utilisateur.id, livreId: l.id, pourcentage: 0, termine: false, creeLe: maintenant() }; db.progressions.push(p); }
    const pct = Math.min(100, Math.max(0, Math.round(Number(pourcentage) || 0)));
    p.pourcentage = Math.max(p.pourcentage, pct);
    p.majLe = maintenant();
    toucherActivite(utilisateur); sauverDB();
    return json(res, 200, p);
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'terminer' && m === 'POST') {
    if (!exigeAuth()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    let p = db.progressions.find(x => x.utilisateurId === utilisateur.id && x.livreId === l.id);
    if (!p) { p = { id: uid(), utilisateurId: utilisateur.id, livreId: l.id, pourcentage: 100, termine: false, creeLe: maintenant() }; db.progressions.push(p); }
    if (!p.termine) { p.termine = true; p.pourcentage = 100; p.termineLe = maintenant(); journal('Lecture terminée', utilisateur, l.titre); }
    toucherActivite(utilisateur); sauverDB();
    const nbTermines = db.progressions.filter(x => x.utilisateurId === utilisateur.id && x.termine).length;
    return json(res, 200, { termine: true, termineLe: p.termineLe, nbTermines,
      certificat: { lecteur: utilisateur.nom, titre: l.titre, auteur: l.auteur, date: p.termineLe, bibliotheque: db.parametres.nom } });
  }
  if (pathname === '/api/historique' && m === 'GET') {
    if (!exigeAuth()) return;
    const liste = db.progressions.filter(p => p.utilisateurId === utilisateur.id)
      .sort((a, b) => new Date(b.majLe || b.creeLe) - new Date(a.majLe || a.creeLe))
      .map(p => { const l = db.livres.find(x => x.id === p.livreId); return l ? { ...p, livre: { id: l.id, titre: l.titre, auteur: l.auteur, icone: l.icone, couleur: l.couleur, couverture: !!l.couverture } } : null; })
      .filter(Boolean);
    return json(res, 200, liste);
  }

  // --- Notes et marque-pages ---
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'notes' && m === 'GET') {
    if (!exigeAuth()) return;
    return json(res, 200, db.notes.filter(n => n.utilisateurId === utilisateur.id && n.livreId === seg[2])
      .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe)));
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'notes' && m === 'POST') {
    if (!exigeAuth()) return;
    const { type, texte, pourcentage } = await lireCorps(req);
    if (!db.livres.some(l => l.id === seg[2])) return json(res, 404, { erreur: 'Livre introuvable.' });
    if (!texte || !texte.trim()) return json(res, 400, { erreur: 'Le texte de la note est requis.' });
    const n = { id: uid(), utilisateurId: utilisateur.id, livreId: seg[2],
      type: type === 'signet' ? 'signet' : 'note', texte: texte.trim().slice(0, 2000),
      pourcentage: Number(pourcentage) || null, creeLe: maintenant() };
    db.notes.push(n); sauverDB();
    return json(res, 201, n);
  }
  if (seg[1] === 'notes' && seg[2] && m === 'DELETE') {
    if (!exigeAuth()) return;
    const i = db.notes.findIndex(n => n.id === seg[2] && n.utilisateurId === utilisateur.id);
    if (i === -1) return json(res, 404, { erreur: 'Note introuvable.' });
    db.notes.splice(i, 1); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Notifications (calculées) ---
  if (pathname === '/api/notifications' && m === 'GET') {
    if (!exigeAuth()) return;
    nettoyerReservations();
    const notifs = [];
    db.emprunts.filter(e => e.utilisateurId === utilisateur.id && e.statut === 'en_cours').forEach(e => {
      const l = db.livres.find(x => x.id === e.livreId);
      const retard = joursRetard(e);
      const dansJours = Math.ceil((new Date(e.echeance) - Date.now()) / 86400000);
      if (retard > 0) notifs.push({ type: 'retard', texte: `⚠️ « ${l ? l.titre : ''} » est en retard de ${retard} jour${retard > 1 ? 's' : ''}.`, date: e.echeance });
      else if (dansJours <= 2) notifs.push({ type: 'echeance', texte: `⏰ « ${l ? l.titre : ''} » est à rendre ${dansJours <= 0 ? "aujourd'hui" : dansJours === 1 ? 'demain' : 'dans 2 jours'}.`, date: e.echeance });
    });
    db.reservations.filter(r => r.utilisateurId === utilisateur.id && r.statut === 'prete').forEach(r => {
      const l = db.livres.find(x => x.id === r.livreId);
      notifs.push({ type: 'reservation', texte: `📌 « ${l ? l.titre : ''} » est mis de côté pour vous — à retirer avant le ${new Date(r.echeanceRetrait).toLocaleDateString('fr-FR')}.`, date: r.echeanceRetrait });
    });
    const semaine = Date.now() - 7 * 86400000;
    db.invitations.filter(i => i.versId === utilisateur.id && new Date(i.date).getTime() > semaine).forEach(i => {
      const g = db.groupes.find(x => x.id === i.groupeId);
      const de = db.utilisateurs.find(u => u.id === i.deId);
      if (g) notifs.push({ type: 'invitation', texte: `👥 ${de ? de.nom : 'Un membre'} vous a ajouté au ${g.type === 'club' ? 'club de lecture' : "groupe d'étude"} « ${g.nom} ».`, date: i.date });
    });
    db.livres.filter(l => new Date(l.creeLe).getTime() > semaine).slice(0, 3).forEach(l => {
      notifs.push({ type: 'nouveaute', texte: `✨ Nouveau au catalogue : « ${l.titre} » (${l.categorie}).`, date: l.creeLe });
    });
    return json(res, 200, notifs.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }

  // --- Recommandations basées sur les intérêts ---
  if (pathname === '/api/recommandations' && m === 'GET') {
    if (!exigeAuth()) return;
    const scores = {};
    db.favoris.filter(f => f.utilisateurId === utilisateur.id).forEach(f => {
      const l = db.livres.find(x => x.id === f.livreId); if (l) scores[l.categorie] = (scores[l.categorie] || 0) + 3;
    });
    db.emprunts.filter(e => e.utilisateurId === utilisateur.id).forEach(e => {
      const l = db.livres.find(x => x.id === e.livreId); if (l) scores[l.categorie] = (scores[l.categorie] || 0) + 2;
    });
    db.progressions.filter(p => p.utilisateurId === utilisateur.id).forEach(p => {
      const l = db.livres.find(x => x.id === p.livreId); if (l) scores[l.categorie] = (scores[l.categorie] || 0) + 1;
    });
    const dejaVus = new Set([
      ...db.emprunts.filter(e => e.utilisateurId === utilisateur.id).map(e => e.livreId),
      ...db.progressions.filter(p => p.utilisateurId === utilisateur.id && p.termine).map(p => p.livreId)
    ]);
    const liste = db.livres.filter(l => !dejaVus.has(l.id))
      .map(l => ({ l, score: (scores[l.categorie] || 0) * 10 + moyenneNotes(l) * 2 + l.nbLectures / 50 }))
      .sort((a, b) => b.score - a.score)
      .map(x => vueLivre(x.l, utilisateur));
    return json(res, 200, { personnalise: Object.keys(scores).length > 0, interets: Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]), livres: liste });
  }

  // --- Classement et badges ---
  if (pathname === '/api/classement' && m === 'GET') {
    if (!exigeAuth()) return;
    const lecteurs = db.utilisateurs.filter(u => u.role === 'apprenant').map(u => {
      const termines = db.progressions.filter(p => p.utilisateurId === u.id && p.termine).length;
      const enCours = db.progressions.filter(p => p.utilisateurId === u.id && !p.termine).length;
      return { nom: u.nom, termines, enCours, moi: utilisateur.id === u.id };
    }).sort((a, b) => b.termines - a.termines || b.enCours - a.enCours).slice(0, 10);
    const mesTermines = db.progressions.filter(p => p.utilisateurId === utilisateur.id && p.termine).length;
    return json(res, 200, { classement: lecteurs, mesTermines });
  }

  // --- Journal des activités et sauvegarde (bibliothécaire) ---
  if (pathname === '/api/journal' && m === 'GET') {
    if (!exigeBiblio()) return;
    return json(res, 200, db.journal.slice(0, 100));
  }
  if (pathname === '/api/sauvegarde' && m === 'GET') {
    if (!exigeBiblio()) return;
    journal('Sauvegarde téléchargée', utilisateur, '');
    sauverDB();
    const corps = JSON.stringify(db, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="sauvegarde-oasis-${new Date().toISOString().slice(0, 10)}.json"`
    });
    return res.end(corps);
  }

  // --- Bibliothèque multimédia (audiothèque, cartothèque, cinémathèque) ---
  const vueMedia = (mo) => ({
    id: mo.id, type: mo.type, titre: mo.titre, auteur: mo.auteur, categorie: mo.categorie,
    description: mo.description, langue: mo.langue, annee: mo.annee, lieu: mo.lieu, duree: mo.duree,
    motsCles: mo.motsCles, fichier: !!mo.ext, mime: mo.mime || '', taille: mo.taille || 0,
    nbLectures: mo.nbLectures || 0, creeLe: mo.creeLe,
    maPosition: utilisateur ? ((db.progressionsMedias.find(p => p.utilisateurId === utilisateur.id && p.mediaId === mo.id) || {}).secondes || 0) : 0
  });
  if (pathname === '/api/medias' && m === 'GET') {
    let liste = db.medias.slice();
    if (query.type) liste = liste.filter(x => x.type === query.type);
    if (query.q) {
      const q = query.q.toLowerCase();
      liste = liste.filter(x => [x.titre, x.auteur, x.categorie, x.motsCles, x.lieu, x.description].some(v => (v || '').toLowerCase().includes(q)));
    }
    liste.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    return json(res, 200, liste.map(vueMedia));
  }
  if (pathname === '/api/medias' && m === 'POST') {
    if (!exigeBiblio()) return;
    const c = await lireCorps(req);
    if (!['audio', 'carte', 'video'].includes(c.type)) return json(res, 400, { erreur: 'Type invalide (audio, carte ou video).' });
    if (!c.titre || !c.titre.trim()) return json(res, 400, { erreur: 'Le titre est requis.' });
    const mo = { id: uid(), type: c.type, titre: c.titre.trim(), auteur: (c.auteur || '').trim(),
      categorie: (c.categorie || '').trim(), description: (c.description || '').trim(),
      langue: c.langue || 'Français', annee: parseInt(c.annee, 10) || new Date().getFullYear(),
      lieu: (c.lieu || '').trim(), duree: (c.duree || '').trim(), motsCles: (c.motsCles || '').trim(),
      ext: '', mime: '', taille: 0, nbLectures: 0, creeLe: maintenant() };
    db.medias.push(mo);
    journal('Média ajouté', utilisateur, `${mo.type} : ${mo.titre}`); sauverDB();
    return json(res, 201, vueMedia(mo));
  }
  if (seg[1] === 'medias' && seg[2] && seg[3] === 'fichier' && m === 'POST') {
    if (!exigeBiblio()) return;
    const mo = db.medias.find(x => x.id === seg[2]);
    if (!mo) return json(res, 404, { erreur: 'Média introuvable.' });
    const mime = (req.headers['content-type'] || '').split(';')[0].trim();
    const ext = (MIMES_MEDIAS[mo.type] || {})[mime];
    if (!ext) return json(res, 400, { erreur: `Format non accepté pour ${mo.type === 'audio' ? 'l\'audiothèque (MP3, OGG, M4A, WAV)' : mo.type === 'video' ? 'la cinémathèque (MP4, WebM)' : 'la cartothèque (PNG, JPEG, PDF)'}.` });
    if (mo.ext && fs.existsSync(cheminMedia(mo))) fs.unlinkSync(cheminMedia(mo));
    mo.ext = ext; mo.mime = mime;
    try { mo.taille = await recevoirFichier(req, cheminMedia(mo)); }
    catch (err) { mo.ext = ''; mo.mime = ''; return json(res, 413, { erreur: err.message }); }
    sauverDB();
    return json(res, 201, { ok: true, taille: mo.taille });
  }
  if (seg[1] === 'medias' && seg[2] && seg[3] === 'fichier' && m === 'GET') {
    // Les balises <audio>/<video> ne peuvent pas envoyer d'en-tête : jeton accepté en paramètre
    const jetonQ = query.jeton && db.sessions[query.jeton] ? db.utilisateurs.find(u => u.id === db.sessions[query.jeton]) : null;
    if (!utilisateur && !jetonQ) return json(res, 401, { erreur: 'Connexion requise.' });
    const mo = db.medias.find(x => x.id === seg[2]);
    if (!mo || !mo.ext || !fs.existsSync(cheminMedia(mo))) return json(res, 404, { erreur: 'Fichier introuvable.' });
    const stat = fs.statSync(cheminMedia(mo));
    const plage = req.headers.range;
    const entetes = { 'Content-Type': mo.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    if (plage) {
      const mMatch = /bytes=(\d*)-(\d*)/.exec(plage);
      let debut = mMatch && mMatch[1] ? parseInt(mMatch[1], 10) : 0;
      let fin = mMatch && mMatch[2] ? parseInt(mMatch[2], 10) : stat.size - 1;
      if (debut >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      fin = Math.min(fin, stat.size - 1);
      if (debut === 0) { mo.nbLectures = (mo.nbLectures || 0) + 1; sauverDB(); }
      res.writeHead(206, { ...entetes, 'Content-Range': `bytes ${debut}-${fin}/${stat.size}`, 'Content-Length': fin - debut + 1 });
      return fs.createReadStream(cheminMedia(mo), { start: debut, end: fin }).pipe(res);
    }
    mo.nbLectures = (mo.nbLectures || 0) + 1; sauverDB();
    res.writeHead(200, { ...entetes, 'Content-Length': stat.size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(mo.titre)}${mo.ext}"` });
    return fs.createReadStream(cheminMedia(mo)).pipe(res);
  }
  if (seg[1] === 'medias' && seg[2] && seg[3] === 'position' && m === 'POST') {
    if (!exigeAuth()) return;
    const { secondes } = await lireCorps(req);
    if (!db.medias.some(x => x.id === seg[2])) return json(res, 404, { erreur: 'Média introuvable.' });
    let p = db.progressionsMedias.find(x => x.utilisateurId === utilisateur.id && x.mediaId === seg[2]);
    if (!p) { p = { utilisateurId: utilisateur.id, mediaId: seg[2], secondes: 0 }; db.progressionsMedias.push(p); }
    p.secondes = Math.max(0, Math.round(Number(secondes) || 0));
    p.majLe = maintenant();
    toucherActivite(utilisateur); sauverDB();
    return json(res, 200, { ok: true });
  }
  if (seg[1] === 'medias' && seg[2] && !seg[3] && m === 'DELETE') {
    if (!exigeBiblio()) return;
    const i = db.medias.findIndex(x => x.id === seg[2]);
    if (i === -1) return json(res, 404, { erreur: 'Média introuvable.' });
    const mo = db.medias[i];
    if (mo.ext && fs.existsSync(cheminMedia(mo))) fs.unlinkSync(cheminMedia(mo));
    db.medias.splice(i, 1);
    db.progressionsMedias = db.progressionsMedias.filter(p => p.mediaId !== mo.id);
    journal('Média supprimé', utilisateur, mo.titre); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Bibliothèque multimédia (audiothèque, cartothèque, cinémathèque) ---
  if (pathname === '/api/medias' && m === 'GET') {
    let liste = db.medias.slice();
    if (query.type) liste = liste.filter(x => x.type === query.type);
    if (query.q) {
      const q = query.q.toLowerCase();
      liste = liste.filter(x => [x.titre, x.auteur, x.categorie, x.motsCles, x.lieu, x.description].some(v => (v || '').toLowerCase().includes(q)));
    }
    liste.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    return json(res, 200, liste.map(x => ({ ...x,
      maPosition: utilisateur ? ((db.progressionsMedias.find(p => p.utilisateurId === utilisateur.id && p.mediaId === x.id) || {}).secondes || 0) : 0 })));
  }
  if (pathname === '/api/medias' && m === 'POST') {
    if (!exigeBiblio()) return;
    const c = await lireCorps(req);
    if (!['audio', 'carte', 'video'].includes(c.type)) return json(res, 400, { erreur: 'Type invalide (audio, carte ou video).' });
    if (!c.titre || !c.titre.trim()) return json(res, 400, { erreur: 'Le titre est requis.' });
    const x = { id: uid(), type: c.type, titre: c.titre.trim(), auteur: (c.auteur || '').trim(),
      categorie: (c.categorie || '').trim(), description: (c.description || '').trim(),
      langue: c.langue || 'Français', annee: parseInt(c.annee, 10) || new Date().getFullYear(),
      motsCles: (c.motsCles || '').trim(), lieu: (c.lieu || '').trim(), duree: (c.duree || '').trim(),
      fichier: false, ext: '', mime: '', taille: 0, nbLectures: 0, creeLe: maintenant() };
    db.medias.push(x); journal('Média ajouté', utilisateur, `${x.type} : ${x.titre}`); sauverDB();
    return json(res, 201, x);
  }
  if (seg[1] === 'medias' && seg[2] && seg[3] === 'fichier' && m === 'POST') {
    if (!exigeBiblio()) return;
    const x = db.medias.find(v => v.id === seg[2]);
    if (!x) return json(res, 404, { erreur: 'Média introuvable.' });
    const mime = (req.headers['content-type'] || '').split(';')[0].trim();
    const ext = MIMES_MEDIAS[x.type][mime];
    if (!ext) return json(res, 400, { erreur: `Format non accepté pour ${x.type} : ${Object.values(MIMES_MEDIAS[x.type]).join(', ')} uniquement.` });
    if (x.fichier && fs.existsSync(cheminMedia(x))) fs.unlinkSync(cheminMedia(x));
    x.ext = ext; x.mime = mime;
    try { x.taille = await recevoirFichier(req, cheminMedia(x)); }
    catch (err) { x.fichier = false; sauverDB(); return json(res, 413, { erreur: err.message }); }
    x.fichier = true; sauverDB();
    return json(res, 201, { ok: true, taille: x.taille });
  }
  if (seg[1] === 'medias' && seg[2] && seg[3] === 'fichier' && m === 'GET') {
    // Les balises <audio>/<video> ne peuvent pas envoyer d'en-tête : jeton accepté en paramètre
    const util = utilisateur || (query.jeton && db.sessions[query.jeton] ? db.utilisateurs.find(u => u.id === db.sessions[query.jeton]) : null);
    if (!util) return json(res, 401, { erreur: 'Connexion requise.' });
    const x = db.medias.find(v => v.id === seg[2]);
    if (!x || !x.fichier || !fs.existsSync(cheminMedia(x))) return json(res, 404, { erreur: 'Fichier introuvable.' });
    const taille = fs.statSync(cheminMedia(x)).size;
    const range = req.headers.range;
    if (range) {
      const mres = /bytes=(\d*)-(\d*)/.exec(range);
      let debut = mres && mres[1] ? parseInt(mres[1], 10) : 0;
      let fin = mres && mres[2] ? parseInt(mres[2], 10) : taille - 1;
      if (debut >= taille) { res.writeHead(416, { 'Content-Range': `bytes */${taille}` }); return res.end(); }
      fin = Math.min(fin, taille - 1);
      if (debut === 0) { x.nbLectures++; sauverDB(); }
      res.writeHead(206, {
        'Content-Type': x.mime, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${debut}-${fin}/${taille}`, 'Content-Length': fin - debut + 1
      });
      return fs.createReadStream(cheminMedia(x), { start: debut, end: fin }).pipe(res);
    }
    x.nbLectures++; sauverDB();
    res.writeHead(200, { 'Content-Type': x.mime, 'Content-Length': taille, 'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${encodeURIComponent(x.titre)}${x.ext}"` });
    return fs.createReadStream(cheminMedia(x)).pipe(res);
  }
  if (seg[1] === 'medias' && seg[2] && seg[3] === 'position' && m === 'POST') {
    if (!exigeAuth()) return;
    const { secondes } = await lireCorps(req);
    if (!db.medias.some(v => v.id === seg[2])) return json(res, 404, { erreur: 'Média introuvable.' });
    let p = db.progressionsMedias.find(v => v.utilisateurId === utilisateur.id && v.mediaId === seg[2]);
    if (!p) { p = { id: uid(), utilisateurId: utilisateur.id, mediaId: seg[2], secondes: 0 }; db.progressionsMedias.push(p); }
    p.secondes = Math.max(0, Math.round(Number(secondes) || 0)); p.majLe = maintenant();
    toucherActivite(utilisateur); sauverDB();
    return json(res, 200, p);
  }
  if (seg[1] === 'medias' && seg[2] && !seg[3] && m === 'DELETE') {
    if (!exigeBiblio()) return;
    const i = db.medias.findIndex(v => v.id === seg[2]);
    if (i === -1) return json(res, 404, { erreur: 'Média introuvable.' });
    if (db.medias[i].fichier && fs.existsSync(cheminMedia(db.medias[i]))) fs.unlinkSync(cheminMedia(db.medias[i]));
    journal('Média supprimé', utilisateur, db.medias[i].titre);
    db.medias.splice(i, 1); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Collaboration : clubs de lecture, groupes d'étude, discussions ---
  const vueGroupe = g => {
    const msgs = db.messagesGroupes.filter(x => x.groupeId === g.id);
    const dernier = msgs[msgs.length - 1];
    const createur = db.utilisateurs.find(u => u.id === g.createurId);
    return { id: g.id, type: g.type, nom: g.nom, description: g.description,
      livre: g.livreId ? (l => l ? { id: l.id, titre: l.titre, icone: l.icone } : null)(db.livres.find(x => x.id === g.livreId)) : null,
      createur: createur ? createur.nom : '—', nbMembres: g.membres.length,
      membre: utilisateur ? g.membres.includes(utilisateur.id) : false,
      estCreateur: utilisateur ? g.createurId === utilisateur.id : false,
      nbMessages: msgs.length,
      dernierMessage: dernier ? { texte: dernier.texte.slice(0, 60), date: dernier.creeLe } : null, creeLe: g.creeLe };
  };
  if (pathname === '/api/groupes' && m === 'GET') {
    if (!exigeAuth()) return;
    let liste = db.groupes.slice();
    if (query.type) liste = liste.filter(g => g.type === query.type);
    if (query.miens) liste = liste.filter(g => g.membres.includes(utilisateur.id));
    liste.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    return json(res, 200, liste.map(vueGroupe));
  }
  if (pathname === '/api/groupes' && m === 'POST') {
    if (!exigeAuth()) return;
    const c = await lireCorps(req);
    if (!['club', 'etude'].includes(c.type)) return json(res, 400, { erreur: 'Type invalide (club ou etude).' });
    if (!c.nom || !c.nom.trim()) return json(res, 400, { erreur: 'Le nom du groupe est requis.' });
    const g = { id: uid(), type: c.type, nom: c.nom.trim().slice(0, 80), description: (c.description || '').trim().slice(0, 400),
      livreId: c.livreId && db.livres.some(l => l.id === c.livreId) ? c.livreId : null,
      createurId: utilisateur.id, membres: [utilisateur.id], creeLe: maintenant() };
    db.groupes.push(g);
    journal(c.type === 'club' ? 'Club créé' : 'Groupe d\'étude créé', utilisateur, g.nom);
    sauverDB();
    return json(res, 201, vueGroupe(g));
  }
  if (seg[1] === 'groupes' && seg[2] && !seg[3] && m === 'GET') {
    if (!exigeAuth()) return;
    const g = db.groupes.find(x => x.id === seg[2]);
    if (!g) return json(res, 404, { erreur: 'Groupe introuvable.' });
    const messages = db.messagesGroupes.filter(x => x.groupeId === g.id).slice(-100)
      .map(x => ({ id: x.id, texte: x.texte, creeLe: x.creeLe, mien: x.utilisateurId === utilisateur.id,
        auteur: (db.utilisateurs.find(u => u.id === x.utilisateurId) || {}).nom || '—' }));
    return json(res, 200, { ...vueGroupe(g),
      membresNoms: g.membres.map(id => (db.utilisateurs.find(u => u.id === id) || {}).nom || '—'), messages });
  }
  if (seg[1] === 'groupes' && seg[2] && seg[3] === 'rejoindre' && m === 'POST') {
    if (!exigeAuth()) return;
    const g = db.groupes.find(x => x.id === seg[2]);
    if (!g) return json(res, 404, { erreur: 'Groupe introuvable.' });
    if (!g.membres.includes(utilisateur.id)) { g.membres.push(utilisateur.id); sauverDB(); }
    return json(res, 200, vueGroupe(g));
  }
  if (seg[1] === 'groupes' && seg[2] && seg[3] === 'quitter' && m === 'POST') {
    if (!exigeAuth()) return;
    const g = db.groupes.find(x => x.id === seg[2]);
    if (!g) return json(res, 404, { erreur: 'Groupe introuvable.' });
    g.membres = g.membres.filter(id => id !== utilisateur.id);
    sauverDB();
    return json(res, 200, { ok: true });
  }
  if (seg[1] === 'groupes' && seg[2] && seg[3] === 'inviter' && m === 'POST') {
    if (!exigeAuth()) return;
    const { membreId } = await lireCorps(req);
    const g = db.groupes.find(x => x.id === seg[2]);
    if (!g) return json(res, 404, { erreur: 'Groupe introuvable.' });
    if (!g.membres.includes(utilisateur.id)) return json(res, 403, { erreur: 'Seuls les membres peuvent inviter.' });
    const invite = db.utilisateurs.find(u => u.id === membreId && u.role === 'apprenant');
    if (!invite) return json(res, 404, { erreur: 'Membre introuvable.' });
    if (g.membres.includes(invite.id)) return json(res, 409, { erreur: `${invite.nom} est déjà membre.` });
    g.membres.push(invite.id);
    db.invitations.push({ id: uid(), groupeId: g.id, deId: utilisateur.id, versId: invite.id, date: maintenant() });
    sauverDB();
    return json(res, 200, { ok: true, nom: invite.nom });
  }
  if (seg[1] === 'groupes' && seg[2] && seg[3] === 'messages' && m === 'POST') {
    if (!exigeAuth()) return;
    const { texte } = await lireCorps(req);
    const g = db.groupes.find(x => x.id === seg[2]);
    if (!g) return json(res, 404, { erreur: 'Groupe introuvable.' });
    if (!g.membres.includes(utilisateur.id)) return json(res, 403, { erreur: 'Rejoignez le groupe pour participer à la discussion.' });
    if (!texte || !texte.trim()) return json(res, 400, { erreur: 'Message vide.' });
    const msg = { id: uid(), groupeId: g.id, utilisateurId: utilisateur.id, texte: texte.trim().slice(0, 2000), creeLe: maintenant() };
    db.messagesGroupes.push(msg);
    toucherActivite(utilisateur); sauverDB();
    return json(res, 201, { id: msg.id, texte: msg.texte, creeLe: msg.creeLe, mien: true, auteur: utilisateur.nom });
  }
  if (seg[1] === 'groupes' && seg[2] && !seg[3] && m === 'DELETE') {
    if (!exigeAuth()) return;
    const i = db.groupes.findIndex(x => x.id === seg[2]);
    if (i === -1) return json(res, 404, { erreur: 'Groupe introuvable.' });
    if (db.groupes[i].createurId !== utilisateur.id && utilisateur.role !== 'bibliothecaire') return json(res, 403, { erreur: 'Seul le créateur ou le bibliothécaire peut supprimer ce groupe.' });
    db.messagesGroupes = db.messagesGroupes.filter(x => x.groupeId !== seg[2]);
    db.groupes.splice(i, 1); sauverDB();
    return json(res, 200, { ok: true });
  }
  if (pathname === '/api/apprenants' && m === 'GET') {
    if (!exigeAuth()) return;
    return json(res, 200, db.utilisateurs.filter(u => u.role === 'apprenant')
      .map(u => ({ id: u.id, nom: u.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
  }

  // --- Commentaires publics sur les livres et ressources ---
  if (pathname === '/api/commentaires' && m === 'GET') {
    const cibleType = query.cibleType, cibleId = query.cibleId;
    return json(res, 200, db.commentaires.filter(c => c.cibleType === cibleType && c.cibleId === cibleId)
      .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe))
      .map(c => ({ id: c.id, texte: c.texte, creeLe: c.creeLe,
        auteur: (db.utilisateurs.find(u => u.id === c.utilisateurId) || {}).nom || '—',
        mien: utilisateur ? c.utilisateurId === utilisateur.id : false })));
  }
  if (pathname === '/api/commentaires' && m === 'POST') {
    if (!exigeAuth()) return;
    const { cibleType, cibleId, texte } = await lireCorps(req);
    if (!['livre', 'ressource'].includes(cibleType)) return json(res, 400, { erreur: 'Cible invalide.' });
    const existe = cibleType === 'livre' ? db.livres.some(l => l.id === cibleId) : db.ressources.some(r => r.id === cibleId);
    if (!existe) return json(res, 404, { erreur: 'Élément introuvable.' });
    if (!texte || !texte.trim()) return json(res, 400, { erreur: 'Commentaire vide.' });
    const c = { id: uid(), cibleType, cibleId, utilisateurId: utilisateur.id, texte: texte.trim().slice(0, 1500), creeLe: maintenant() };
    db.commentaires.push(c);
    toucherActivite(utilisateur); sauverDB();
    return json(res, 201, { id: c.id, texte: c.texte, creeLe: c.creeLe, auteur: utilisateur.nom, mien: true });
  }
  if (seg[1] === 'commentaires' && seg[2] && m === 'DELETE') {
    if (!exigeAuth()) return;
    const i = db.commentaires.findIndex(c => c.id === seg[2]);
    if (i === -1) return json(res, 404, { erreur: 'Commentaire introuvable.' });
    if (db.commentaires[i].utilisateurId !== utilisateur.id && utilisateur.role !== 'bibliothecaire') return json(res, 403, { erreur: 'Vous ne pouvez supprimer que vos propres commentaires.' });
    db.commentaires.splice(i, 1); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Paramètres de la bibliothèque ---
  if (pathname === '/api/parametres' && m === 'GET') {
    return json(res, 200, db.parametres);
  }
  if (pathname === '/api/parametres' && m === 'PUT') {
    if (!exigeBiblio()) return;
    const c = await lireCorps(req);
    const p = db.parametres;
    ['nom', 'slogan', 'messageAccueil', 'adresse', 'telephone', 'email', 'horaires', 'piedDePage'].forEach(k => {
      if (typeof c[k] === 'string') p[k] = c[k].trim().slice(0, 300);
    });
    if (typeof c.aPropos === 'string') p.aPropos = c.aPropos.trim().slice(0, 2000);
    [].forEach(k => {
      if (typeof c[k] === 'string') p[k] = c[k].trim().slice(0, 300);
    });
    ['dureeEmpruntPhysique', 'dureeEmpruntNumerique', 'maxEmprunts', 'retraitReservationJours', 'nbPlacesLecture'].forEach(k => {
      const v = parseInt(c[k], 10);
      if (Number.isInteger(v) && v >= 1 && v <= 365) p[k] = v;
    });
    if (Array.isArray(c.creneaux)) {
      const cr = c.creneaux.map(x => String(x).trim()).filter(Boolean).slice(0, 8);
      if (cr.length) p.creneaux = cr;
    }
    if (!p.nom) p.nom = 'OASIS Bibliothèque Numérique';
    sauverDB();
    return json(res, 200, p);
  }

  // --- Image d'une ressource documentaire ---
  if (seg[1] === 'ressources' && seg[2] && seg[3] === 'image' && m === 'POST') {
    if (!exigeBiblio()) return;
    const r = db.ressources.find(x => x.id === seg[2]);
    if (!r) return json(res, 404, { erreur: 'Ressource introuvable.' });
    let donnees;
    try { donnees = await lireBinaire(req); } catch (err) { return json(res, 413, { erreur: err.message }); }
    const png = donnees.length > 8 && donnees[0] === 0x89 && donnees[1] === 0x50;
    const jpg = donnees.length > 3 && donnees[0] === 0xFF && donnees[1] === 0xD8;
    if ((!png && !jpg) || donnees.length > 3e6) return json(res, 400, { erreur: 'Image PNG ou JPEG requise (3 Mo max).' });
    fs.mkdirSync(DOSSIER_RES_IMG, { recursive: true });
    fs.writeFileSync(cheminResImg(r.id), donnees);
    r.image = true; sauverDB();
    return json(res, 201, { ok: true });
  }
  if (seg[1] === 'ressources' && seg[2] && seg[3] === 'image' && m === 'GET') {
    const r = db.ressources.find(x => x.id === seg[2]);
    if (!r || !r.image || !fs.existsSync(cheminResImg(r.id))) return json(res, 404, { erreur: 'Pas d\'image.' });
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' });
    return fs.createReadStream(cheminResImg(r.id)).pipe(res);
  }

  // --- Catégories (gérées par le bibliothécaire) ---
  if (pathname === '/api/categories' && m === 'GET') {
    return json(res, 200, db.categories
      .map(c => ({ ...c, nbLivres: db.livres.filter(l => l.categorie === c.nom).length }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
  }
  if (pathname === '/api/categories' && m === 'POST') {
    if (!exigeBiblio()) return;
    const { nom, icone, couleur } = await lireCorps(req);
    if (!nom || !nom.trim()) return json(res, 400, { erreur: 'Le nom de la catégorie est requis.' });
    if (db.categories.some(c => c.nom.toLowerCase() === nom.trim().toLowerCase())) return json(res, 409, { erreur: 'Cette catégorie existe déjà.' });
    const c = { id: uid(), nom: nom.trim(), icone: icone || '📘', couleur: couleur || '#1e4fa3', creeLe: maintenant() };
    db.categories.push(c); sauverDB();
    return json(res, 201, c);
  }
  if (seg[1] === 'categories' && seg[2] && m === 'DELETE') {
    if (!exigeBiblio()) return;
    const i = db.categories.findIndex(c => c.id === seg[2]);
    if (i === -1) return json(res, 404, { erreur: 'Catégorie introuvable.' });
    const nb = db.livres.filter(l => l.categorie === db.categories[i].nom).length;
    if (nb > 0) return json(res, 409, { erreur: `Impossible : ${nb} livre(s) sont classés dans cette catégorie.` });
    db.categories.splice(i, 1); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Réservations de livres (file d'attente) ---
  if (pathname === '/api/reservations' && m === 'POST') {
    if (!exigeAuth()) return;
    nettoyerReservations();
    const { livreId } = await lireCorps(req);
    const l = db.livres.find(x => x.id === livreId);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    const ex = db.exemplaires.filter(e => e.livreId === l.id);
    if (!ex.length) return json(res, 409, { erreur: 'Ce titre n\'a pas d\'exemplaire physique : la réservation ne s\'applique qu\'aux livres en rayon.' });
    if (ex.some(e => e.statut === 'disponible')) return json(res, 409, { erreur: 'Des exemplaires sont disponibles : empruntez directement le livre.' });
    if (db.emprunts.some(e => e.utilisateurId === utilisateur.id && e.livreId === l.id && e.statut === 'en_cours')) return json(res, 409, { erreur: 'Vous avez déjà ce livre en emprunt.' });
    if (db.reservations.some(r => r.utilisateurId === utilisateur.id && r.livreId === l.id && (r.statut === 'en_attente' || r.statut === 'prete'))) return json(res, 409, { erreur: 'Vous avez déjà une réservation active sur ce livre.' });
    const r = { id: uid(), livreId: l.id, utilisateurId: utilisateur.id, statut: 'en_attente', creeLe: maintenant() };
    db.reservations.push(r); journal('Réservation', utilisateur, l.titre); sauverDB();
    return json(res, 201, vueReservation(r));
  }
  if (pathname === '/api/reservations' && m === 'GET') {
    if (!exigeAuth()) return;
    nettoyerReservations();
    let liste = db.reservations.slice().sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    if (utilisateur.role !== 'bibliothecaire') liste = liste.filter(r => r.utilisateurId === utilisateur.id);
    if (query.actives) liste = liste.filter(r => r.statut === 'en_attente' || r.statut === 'prete');
    return json(res, 200, liste.map(vueReservation));
  }
  if (seg[1] === 'reservations' && seg[2] && !seg[3] && m === 'DELETE') {
    if (!exigeAuth()) return;
    const r = db.reservations.find(x => x.id === seg[2]);
    if (!r || (r.statut !== 'en_attente' && r.statut !== 'prete')) return json(res, 404, { erreur: 'Réservation active introuvable.' });
    if (utilisateur.role !== 'bibliothecaire' && r.utilisateurId !== utilisateur.id) return json(res, 403, { erreur: 'Accès refusé.' });
    const etaitPrete = r.statut === 'prete';
    r.statut = 'annulee';
    if (etaitPrete) libererExemplaire(r.exemplaireId, r.livreId);
    sauverDB();
    return json(res, 200, { ok: true });
  }
  if (seg[1] === 'reservations' && seg[2] && seg[3] === 'remettre' && m === 'PUT') {
    if (!exigeBiblio()) return;
    nettoyerReservations();
    const r = db.reservations.find(x => x.id === seg[2]);
    if (!r || r.statut !== 'prete') return json(res, 404, { erreur: 'Réservation prête à retirer introuvable.' });
    const ex = db.exemplaires.find(x => x.id === r.exemplaireId);
    if (!ex) return json(res, 409, { erreur: 'Exemplaire mis de côté introuvable.' });
    ex.statut = 'emprunte';
    const dateEmprunt = maintenant();
    const e = { id: uid(), livreId: r.livreId, exemplaireId: ex.id, utilisateurId: r.utilisateurId,
      dateEmprunt, echeance: new Date(new Date(dateEmprunt).getTime() + db.parametres.dureeEmpruntPhysique * 86400000).toISOString(),
      statut: 'en_cours', prolongations: 0 };
    db.emprunts.push(e);
    r.statut = 'convertie'; sauverDB();
    return json(res, 200, vueEmprunt(e));
  }

  // --- Places de lecture (salle de la bibliothèque) ---
  if (pathname === '/api/places' && m === 'GET') {
    if (!exigeAuth()) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ? query.date : new Date().toISOString().slice(0, 10);
    const actives = db.placesLecture.filter(p => p.date === date && p.statut === 'active');
    const rep = {
      date, nbPlaces: db.parametres.nbPlacesLecture,
      creneaux: db.parametres.creneaux.map(c => {
        const occ = actives.filter(p => p.creneau === c);
        const mienne = occ.find(p => p.utilisateurId === utilisateur.id);
        return { creneau: c, occupees: occ.length, libres: db.parametres.nbPlacesLecture - occ.length,
          maReservationId: mienne ? mienne.id : null, maPlace: mienne ? mienne.place : null };
      })
    };
    if (utilisateur.role === 'bibliothecaire') rep.details = actives
      .sort((a, b) => a.creneau.localeCompare(b.creneau) || a.place - b.place)
      .map(p => ({ id: p.id, creneau: p.creneau, place: p.place,
        membre: (db.utilisateurs.find(u => u.id === p.utilisateurId) || {}).nom || '—' }));
    return json(res, 200, rep);
  }
  if (pathname === '/api/places' && m === 'POST') {
    if (!exigeAuth()) return;
    const { date, creneau } = await lireCorps(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return json(res, 400, { erreur: 'Date invalide (format AAAA-MM-JJ).' });
    if (!db.parametres.creneaux.includes(creneau)) return json(res, 400, { erreur: 'Créneau invalide.' });
    if (date < new Date().toISOString().slice(0, 10)) return json(res, 400, { erreur: 'Impossible de réserver une date passée.' });
    const occ = db.placesLecture.filter(p => p.date === date && p.creneau === creneau && p.statut === 'active');
    if (occ.some(p => p.utilisateurId === utilisateur.id)) return json(res, 409, { erreur: 'Vous avez déjà une place sur ce créneau.' });
    if (occ.length >= db.parametres.nbPlacesLecture) return json(res, 409, { erreur: 'Ce créneau est complet.' });
    const prises = new Set(occ.map(p => p.place));
    let place = 1;
    while (prises.has(place)) place++;
    const p = { id: uid(), utilisateurId: utilisateur.id, date, creneau, place, statut: 'active', creeLe: maintenant() };
    db.placesLecture.push(p); sauverDB();
    return json(res, 201, { id: p.id, date, creneau, place });
  }
  if (seg[1] === 'places' && seg[2] && m === 'DELETE') {
    if (!exigeAuth()) return;
    const p = db.placesLecture.find(x => x.id === seg[2] && x.statut === 'active');
    if (!p) return json(res, 404, { erreur: 'Réservation de place introuvable.' });
    if (utilisateur.role !== 'bibliothecaire' && p.utilisateurId !== utilisateur.id) return json(res, 403, { erreur: 'Accès refusé.' });
    p.statut = 'annulee'; sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Ressources documentaires (dictionnaire, encyclopédie, bases de données) ---
  if (pathname === '/api/ressources' && m === 'GET') {
    let liste = db.ressources.slice();
    if (query.genre) liste = liste.filter(r => r.genre === query.genre);
    if (query.q) {
      const q = query.q.toLowerCase();
      liste = liste.filter(r => r.titre.toLowerCase().includes(q) || r.contenu.toLowerCase().includes(q));
    }
    liste.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
    return json(res, 200, liste);
  }
  if (pathname === '/api/ressources' && m === 'POST') {
    if (!exigeBiblio()) return;
    const { genre, titre, contenu, source, lien, icone } = await lireCorps(req);
    if (!['dictionnaire', 'encyclopedie', 'base', 'administratif', 'historique'].includes(genre)) return json(res, 400, { erreur: 'Genre invalide.' });
    if (!titre || !contenu) return json(res, 400, { erreur: 'Titre et contenu requis.' });
    if (lien && !/^https?:\/\/.+/.test(lien)) return json(res, 400, { erreur: 'Le lien doit commencer par http:// ou https://' });
    const r = { id: uid(), genre, titre, contenu, source: source || '', lien: lien || '', icone: (icone || '').slice(0, 8), image: false, creeLe: maintenant() };
    db.ressources.push(r); sauverDB();
    return json(res, 201, r);
  }
  if (seg[1] === 'ressources' && seg[2] && m === 'DELETE') {
    if (!exigeBiblio()) return;
    const i = db.ressources.findIndex(r => r.id === seg[2]);
    if (i === -1) return json(res, 404, { erreur: 'Ressource introuvable.' });
    if (fs.existsSync(cheminResImg(db.ressources[i].id))) fs.unlinkSync(cheminResImg(db.ressources[i].id));
    db.ressources.splice(i, 1); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Couverture (première page du livre en image) ---
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'couverture' && m === 'POST') {
    if (!exigeBiblio()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    let donnees;
    try { donnees = await lireBinaire(req); } catch (err) { return json(res, 413, { erreur: err.message }); }
    const png = donnees.length > 8 && donnees[0] === 0x89 && donnees[1] === 0x50;
    const jpg = donnees.length > 3 && donnees[0] === 0xFF && donnees[1] === 0xD8;
    if ((!png && !jpg) || donnees.length > 3e6) return json(res, 400, { erreur: 'Image PNG ou JPEG requise (3 Mo max).' });
    fs.mkdirSync(DOSSIER_COUV, { recursive: true });
    fs.writeFileSync(cheminCouv(l.id), donnees);
    l.couverture = true; sauverDB();
    return json(res, 201, { ok: true });
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'couverture' && m === 'GET') {
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l || !l.couverture || !fs.existsSync(cheminCouv(l.id))) return json(res, 404, { erreur: 'Pas de couverture.' });
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' });
    return fs.createReadStream(cheminCouv(l.id)).pipe(res);
  }

  // EPUB : téléchargement authentifié, validation ZIP sans extraction.
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'epub') {
    if (m === 'GET' ? !exigeAuth() : !exigeBiblio()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    if (m === 'POST') {
      let b; try { b = await lireBinaire(req); } catch(e) { return json(res, 413, {erreur:e.message}); }
      if (!require('./modules/epub-valide')(b)) return json(res,400,{erreur:'Le fichier doit être un EPUB valide (mimetype et META-INF/container.xml).'});
      fs.mkdirSync(DOSSIER_PDF,{recursive:true}); fs.writeFileSync(cheminEpub(l.id),b);l.epub=true;sauverDB();return json(res,201,{ok:true});
    }
    if (m === 'GET') {
      if (!l.epub || !fs.existsSync(cheminEpub(l.id))) return json(res,404,{erreur:'Aucun EPUB associé.'});
      res.writeHead(200,{'Content-Type':'application/epub+zip','Content-Disposition':`attachment; filename="${encodeURIComponent(l.titre)}.epub"`,'Cache-Control':'no-store'});
      return fs.createReadStream(cheminEpub(l.id)).pipe(res);
    }
    if(m === 'DELETE'){if(fs.existsSync(cheminEpub(l.id)))fs.unlinkSync(cheminEpub(l.id));l.epub=false;sauverDB();return json(res,200,{ok:true});}
    return json(res,405,{erreur:'Méthode non autorisée.'});
  }
  // --- E-books PDF ---
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'pdf' && m === 'POST') {
    if (!exigeBiblio()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    let donnees;
    try { donnees = await lireBinaire(req); } catch (err) { return json(res, 413, { erreur: err.message }); }
    if (!donnees.length || donnees.slice(0, 5).toString() !== '%PDF-') return json(res, 400, { erreur: 'Le fichier doit être un PDF valide.' });
    fs.mkdirSync(DOSSIER_PDF, { recursive: true });
    fs.writeFileSync(cheminPdf(l.id), donnees);
    l.pdf = true; // s'il a aussi des exemplaires en rayon, le livre devient hybride
    sauverDB();
    return json(res, 201, { ok: true, taille: donnees.length });
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'pdf' && m === 'GET') {
    if (!exigeAuth()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l || !l.pdf || !fs.existsSync(cheminPdf(l.id))) return json(res, 404, { erreur: 'Aucun PDF pour ce livre.' });
    l.nbLectures++; l.nbTelechargements = (l.nbTelechargements || 0) + 1; sauverDB();
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(l.titre)}.pdf"`,
      'Content-Length': fs.statSync(cheminPdf(l.id)).size,
      'Cache-Control': 'no-store'
    });
    return fs.createReadStream(cheminPdf(l.id)).pipe(res);
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'pdf' && m === 'DELETE') {
    if (!exigeBiblio()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    if (fs.existsSync(cheminPdf(l.id))) fs.unlinkSync(cheminPdf(l.id));
    l.pdf = false; sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Livres ---
  if (pathname === '/api/livres' && m === 'GET') {
    let liste = db.livres.slice();
    if (query.q) {
      const q = query.q.toLowerCase();
      liste = liste.filter(l => [l.titre, l.auteur, l.categorie, l.isbn, l.editeur, l.langue, l.niveau, l.motsCles, l.resume].some(x => (x || '').toLowerCase().includes(q)));
    }
    if (query.categorie) liste = liste.filter(l => l.categorie === query.categorie);
    if (query.type === 'numerique') liste = liste.filter(l => l.contenu || l.pdf || l.epub);
    else if (query.type === 'physique') liste = liste.filter(l => db.exemplaires.some(e => e.livreId === l.id));
    if (query.tri === 'populaires') liste.sort((a,b) => (moyenneNotes(b)*10 + b.nbLectures/50) - (moyenneNotes(a)*10 + a.nbLectures/50));
    else if (query.tri === 'nouveautes') liste.sort((a,b) => new Date(b.creeLe) - new Date(a.creeLe));
    return json(res, 200, liste.map(l => vueLivre(l, utilisateur)));
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'lire' && m === 'GET') {
    if (!exigeAuth()) return;
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    if (!l.contenu) return json(res, 400, { erreur: l.pdf ? 'Ce livre se lit via son PDF.' : 'Ce livre n\'a pas de version numérique. Empruntez-le à la bibliothèque.' });
    l.nbLectures++; sauverDB();
    return json(res, 200, { titre: l.titre, auteur: l.auteur, contenu: l.contenu });
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'note' && m === 'POST') {
    if (!exigeAuth()) return;
    const { etoiles } = await lireCorps(req);
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    const n = Math.min(5, Math.max(1, parseInt(etoiles, 10) || 0));
    l.notes.push(n); sauverDB();
    return json(res, 200, { note: moyenneNotes(l), nbNotes: l.notes.length });
  }
  if (seg[1] === 'livres' && seg[2] && !seg[3] && m === 'GET') {
    const l = db.livres.find(x => x.id === seg[2]);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    return json(res, 200, vueLivre(l, utilisateur));
  }
  if (pathname === '/api/livres' && m === 'POST') {
    if (!exigeBiblio()) return;
    const c = await lireCorps(req);
    if (!c.titre || !c.auteur || !c.categorie) return json(res, 400, { erreur: 'Titre, auteur et catégorie requis.' });
    const l = { id: uid(), titre: c.titre, auteur: c.auteur, categorie: c.categorie, type: c.type === 'physique' ? 'physique' : 'numerique',
      resume: c.resume || '', couleur: c.couleur || '#1e4fa3', icone: c.icone || '📘', annee: c.annee || new Date().getFullYear(),
      isbn: c.isbn || '', editeur: c.editeur || '', langue: c.langue || 'Français', niveau: c.niveau || '', motsCles: c.motsCles || '',
      contenu: c.contenu || null, notes: [], nbLectures: 0, nbTelechargements: 0, creeLe: maintenant() };
    db.livres.push(l); journal('Livre ajouté', utilisateur, l.titre); sauverDB();
    return json(res, 201, vueLivre(l, utilisateur));
  }
  if (seg[1] === 'livres' && seg[2] && !seg[3] && (m === 'PUT' || m === 'DELETE')) {
    if (!exigeBiblio()) return;
    const idx = db.livres.findIndex(x => x.id === seg[2]);
    if (idx === -1) return json(res, 404, { erreur: 'Livre introuvable.' });
    if (m === 'DELETE') {
      if (db.emprunts.some(e => e.livreId === seg[2] && e.statut === 'en_cours')) return json(res, 409, { erreur: 'Impossible : des emprunts sont en cours sur ce livre.' });
      db.livres.splice(idx, 1);
      db.exemplaires = db.exemplaires.filter(e => e.livreId !== seg[2]);
      db.reservations.forEach(r => { if (r.livreId === seg[2] && (r.statut === 'en_attente' || r.statut === 'prete')) r.statut = 'annulee'; });
      if (fs.existsSync(cheminEpub(seg[2]))) fs.unlinkSync(cheminEpub(seg[2]));
      if (fs.existsSync(cheminPdf(seg[2]))) fs.unlinkSync(cheminPdf(seg[2]));
      if (fs.existsSync(cheminCouv(seg[2]))) fs.unlinkSync(cheminCouv(seg[2]));
      sauverDB();
      return json(res, 200, { ok: true });
    }
    const c = await lireCorps(req);
    if (['titre','auteur','categorie'].some(k => c[k] !== undefined && (typeof c[k] !== 'string' || !c[k].trim()))) return json(res,400,{erreur:'Titre, auteur et catégorie ne doivent pas être vides.'});
    ['titre','auteur','categorie','resume','couleur','icone','annee','isbn','contenu','type','editeur','langue','niveau','motsCles'].forEach(k => { if (c[k] !== undefined) db.livres[idx][k] = c[k]; });
    sauverDB();
    return json(res, 200, vueLivre(db.livres[idx], utilisateur));
  }

  // --- Exemplaires (bibliothèque physique) ---
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'exemplaires' && m === 'GET') {
    if (!exigeBiblio()) return;
    return json(res, 200, db.exemplaires.filter(e => e.livreId === seg[2]));
  }
  if (seg[1] === 'livres' && seg[2] && seg[3] === 'exemplaires' && m === 'POST') {
    if (!exigeBiblio()) return;
    const { cote, etat } = await lireCorps(req);
    if (!cote) return json(res, 400, { erreur: 'La cote est requise.' });
    if (db.exemplaires.some(e => e.cote === cote)) return json(res, 409, { erreur: 'Cette cote existe déjà.' });
    const ex = { id: uid(), livreId: seg[2], cote, etat: etat || 'bon', statut: 'disponible', creeLe: maintenant() };
    db.exemplaires.push(ex); sauverDB();
    return json(res, 201, ex);
  }
  if (seg[1] === 'exemplaires' && seg[2] && m === 'DELETE') {
    if (!exigeBiblio()) return;
    const ex = db.exemplaires.find(e => e.id === seg[2]);
    if (!ex) return json(res, 404, { erreur: 'Exemplaire introuvable.' });
    if (ex.statut === 'emprunte') return json(res, 409, { erreur: 'Cet exemplaire est actuellement emprunté.' });
    db.exemplaires = db.exemplaires.filter(e => e.id !== seg[2]); sauverDB();
    return json(res, 200, { ok: true });
  }

  // --- Emprunts ---
  if (pathname === '/api/emprunts' && m === 'GET') {
    if (!exigeAuth()) return;
    let liste = db.emprunts.slice().sort((a,b) => new Date(b.dateEmprunt) - new Date(a.dateEmprunt));
    if (utilisateur.role !== 'bibliothecaire') liste = liste.filter(e => e.utilisateurId === utilisateur.id);
    else if (query.statut) liste = liste.filter(e => e.statut === query.statut);
    return json(res, 200, liste.map(vueEmprunt));
  }
  if (pathname === '/api/emprunts' && m === 'POST') {
    if (!exigeAuth()) return;
    const c = await lireCorps(req);
    // Le bibliothécaire peut emprunter au nom d'un membre (guichet physique)
    const membreId = (utilisateur.role === 'bibliothecaire' && c.membreId) ? c.membreId : utilisateur.id;
    const membre = db.utilisateurs.find(x => x.id === membreId);
    if (!membre) return json(res, 404, { erreur: 'Membre introuvable.' });
    const l = db.livres.find(x => x.id === c.livreId);
    if (!l) return json(res, 404, { erreur: 'Livre introuvable.' });
    const actifs = db.emprunts.filter(e => e.utilisateurId === membreId && e.statut === 'en_cours');
    if (actifs.length >= db.parametres.maxEmprunts) return json(res, 409, { erreur: `Limite atteinte : ${db.parametres.maxEmprunts} emprunts actifs maximum.` });
    if (actifs.some(e => e.livreId === l.id)) return json(res, 409, { erreur: 'Ce livre est déjà emprunté par ce membre.' });
    const aExemplaires = db.exemplaires.some(e => e.livreId === l.id);
    let exemplaireId = null;
    let duree;
    if (aExemplaires) {
      // Version physique : on réserve un exemplaire en rayon
      const dispo = db.exemplaires.find(e => e.livreId === l.id && e.statut === 'disponible');
      if (!dispo) return json(res, 409, { erreur: 'Aucun exemplaire disponible pour le moment.' + (l.contenu || l.pdf || l.epub ? ' La version numérique reste lisible en ligne.' : '') });
      dispo.statut = 'emprunte';
      exemplaireId = dispo.id;
      duree = db.parametres.dureeEmpruntPhysique;
    } else if (l.contenu || l.pdf || l.epub) {
      duree = db.parametres.dureeEmpruntNumerique;
    } else {
      return json(res, 409, { erreur: 'Ce titre n\'a ni exemplaire en rayon ni version numérique.' });
    }
    const dateEmprunt = maintenant();
    const echeance = new Date(new Date(dateEmprunt).getTime() + duree * 86400000).toISOString();
    const e = { id: uid(), livreId: l.id, exemplaireId, utilisateurId: membreId, dateEmprunt, echeance, statut: 'en_cours', prolongations: 0 };
    db.emprunts.push(e); toucherActivite(membre); journal('Emprunt', utilisateur, `${l.titre} → ${membre.nom}`); sauverDB();
    return json(res, 201, vueEmprunt(e));
  }
  if (seg[1] === 'emprunts' && seg[2] && seg[3] === 'retour' && m === 'PUT') {
    if (!exigeBiblio()) return;
    const e = db.emprunts.find(x => x.id === seg[2]);
    if (!e || e.statut !== 'en_cours') return json(res, 404, { erreur: 'Emprunt en cours introuvable.' });
    e.statut = 'retourne'; e.dateRetour = maintenant();
    journal('Retour', utilisateur, (db.livres.find(l => l.id === e.livreId) || {}).titre || '');
    if (e.exemplaireId) libererExemplaire(e.exemplaireId, e.livreId);
    sauverDB();
    return json(res, 200, vueEmprunt(e));
  }
  if (seg[1] === 'emprunts' && seg[2] && seg[3] === 'prolonger' && m === 'PUT') {
    if (!exigeAuth()) return;
    const e = db.emprunts.find(x => x.id === seg[2]);
    if (!e || e.statut !== 'en_cours') return json(res, 404, { erreur: 'Emprunt en cours introuvable.' });
    if (utilisateur.role !== 'bibliothecaire' && e.utilisateurId !== utilisateur.id) return json(res, 403, { erreur: 'Accès refusé.' });
    if (e.prolongations >= 2) return json(res, 409, { erreur: 'Maximum de 2 prolongations atteint.' });
    e.prolongations++;
    e.echeance = new Date(new Date(e.echeance).getTime() + 7 * 86400000).toISOString();
    sauverDB();
    return json(res, 200, vueEmprunt(e));
  }

  // --- Favoris & Liste de lecture ---
  const bascule = (collection) => async () => {
    if (!exigeAuth()) return;
    const livreId = seg[2];
    if (!db.livres.some(l => l.id === livreId)) return json(res, 404, { erreur: 'Livre introuvable.' });
    const i = db[collection].findIndex(f => f.utilisateurId === utilisateur.id && f.livreId === livreId);
    let actif;
    if (i >= 0) { db[collection].splice(i, 1); actif = false; }
    else { db[collection].push({ utilisateurId: utilisateur.id, livreId, ajouteLe: maintenant() }); actif = true; }
    sauverDB();
    return json(res, 200, { actif });
  };
  if (seg[1] === 'favoris' && seg[2] && m === 'POST') return bascule('favoris')();
  if (seg[1] === 'liste' && seg[2] && m === 'POST') return bascule('listeLecture')();
  if (pathname === '/api/favoris' && m === 'GET') {
    if (!exigeAuth()) return;
    const ids = db.favoris.filter(f => f.utilisateurId === utilisateur.id).map(f => f.livreId);
    return json(res, 200, db.livres.filter(l => ids.includes(l.id)).map(l => vueLivre(l, utilisateur)));
  }
  if (pathname === '/api/liste' && m === 'GET') {
    if (!exigeAuth()) return;
    const entrees = db.listeLecture.filter(f => f.utilisateurId === utilisateur.id).sort((a,b)=> new Date(a.ajouteLe)-new Date(b.ajouteLe));
    return json(res, 200, entrees.map(f => vueLivre(db.livres.find(l => l.id === f.livreId), utilisateur)).filter(Boolean));
  }

  // --- Membres & statistiques (bibliothécaire) ---
  if (pathname === '/api/membres' && m === 'GET') {
    if (!exigeBiblio()) return;
    return json(res, 200, db.utilisateurs.filter(x => x.role === 'apprenant').map(x => ({
      id: x.id, nom: x.nom, email: x.email, classe: x.classe || '', creeLe: x.creeLe,
      empruntsActifs: db.emprunts.filter(e => e.utilisateurId === x.id && e.statut === 'en_cours').length
    })));
  }
  if (pathname === '/api/membres' && m === 'POST') {
    if (!exigeBiblio()) return;
    const { nom, email, motDePasse, classe } = await lireCorps(req);
    if (!nom || !email) return json(res, 400, { erreur: 'Nom et email requis.' });
    if (db.utilisateurs.some(x => x.email.toLowerCase() === email.toLowerCase())) return json(res, 409, { erreur: 'Email déjà utilisé.' });
    const nu = { id: uid(), nom, email, classe: classe || '', role: 'apprenant', ...hashMdp(motDePasse || 'oasis123'), creeLe: maintenant() };
    db.utilisateurs.push(nu); sauverDB();
    return json(res, 201, { id: nu.id, nom: nu.nom, email: nu.email, classe: nu.classe });
  }
  if (pathname === '/api/stats' && m === 'GET') {
    if (!exigeBiblio()) return;
    const enCours = db.emprunts.filter(e => e.statut === 'en_cours');
    return json(res, 200, {
      livres: db.livres.length,
      numeriques: db.livres.filter(l => l.contenu || l.pdf || l.epub).length,
      physiques: db.livres.filter(l => db.exemplaires.some(e => e.livreId === l.id)).length,
      hybrides: db.livres.filter(l => (l.contenu || l.pdf || l.epub) && db.exemplaires.some(e => e.livreId === l.id)).length,
      exemplaires: db.exemplaires.length,
      exemplairesDisponibles: db.exemplaires.filter(e => e.statut === 'disponible').length,
      membres: db.utilisateurs.filter(x => x.role === 'apprenant').length,
      empruntsEnCours: enCours.length,
      empruntsEnRetard: enCours.filter(e => joursRetard(e) > 0).length,
      reservationsEnAttente: db.reservations.filter(r => r.statut === 'en_attente').length,
      reservationsPretes: db.reservations.filter(r => r.statut === 'prete').length,
      placesAujourdhui: db.placesLecture.filter(p => p.date === new Date().toISOString().slice(0, 10) && p.statut === 'active').length,
      ressources: db.ressources.length,
      lecturesTotal: db.livres.reduce((a,l) => a + l.nbLectures, 0),
      telechargements: db.livres.reduce((a,l) => a + (l.nbTelechargements || 0), 0),
      livresTermines: db.progressions.filter(p => p.termine).length,
      membresActifs7j: db.utilisateurs.filter(u => u.role === 'apprenant' && u.derniereActivite && Date.now() - new Date(u.derniereActivite).getTime() < 7 * 86400000).length
    });
  }

  json(res, 404, { erreur: 'Route introuvable.' });
}

// ---------- Fichiers statiques ----------
const MIMES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function statique(req, res) {
  let p = url.parse(req.url).pathname;
  if (p === '/') p = '/index.html';
  if (p === '/admin') p = '/admin.html';
  const fichier = path.join(PUBLIC, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!fichier.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(fichier, (err, contenu) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
    res.writeHead(200, { 'Content-Type': MIMES[path.extname(fichier)] || 'application/octet-stream' });
    res.end(contenu);
  });
}

// ---------- Serveur ----------
chargerDB();
http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) await api(req, res);
    else statique(req, res);
  } catch (err) {
    console.error(err);
    json(res, 500, { erreur: 'Erreur interne du serveur.' });
  }
}).listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Oasis — Centre numérique d\'apprentissage       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Portail apprenant : http://localhost:${PORT}`);
  console.log(`Espace bibliothécaire : http://localhost:${PORT}/admin`);
  console.log('Comptes de démonstration :');
  console.log('  Bibliothécaire → admin@oasis.ht / admin123');
  console.log('  Apprenant      → emma@oasis.ht  / demo123');
});
