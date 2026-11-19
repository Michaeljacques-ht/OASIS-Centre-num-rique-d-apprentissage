// 1.31.0 : collecte automatique (planification, sources, doublons, échecs, réglages).
const assert = require('node:assert/strict');
const os = require('node:os');
const C = require('../modules/collecte');
const doublons = require('../modules/doublons');

// Planification : 6 000 restants sur 44 jours ≈ 137 par jour, étalés dans la journée
let p = C.plan({ total: 4000, objectif: 10000, dateCible: '2026-12-31', faitsAujourdhui: 0, maintenant: new Date('2026-11-18T12:00:00'), maxParHeure: 20 });
assert.equal(p.joursRestants, 44); assert.equal(p.parJour, 137); assert.ok(p.cetteFois >= 1 && p.cetteFois <= 2, String(p.cetteFois));
p = C.plan({ total: 4000, objectif: 10000, dateCible: '2026-12-31', faitsAujourdhui: 137, maintenant: new Date('2026-11-18T12:00:00') });
assert.equal(p.cetteFois, 0, 'quota du jour atteint');
assert.equal(C.plan({ total: 10000, objectif: 10000, dateCible: '2026-12-31', faitsAujourdhui: 0 }).termine, true);
assert.equal(C.categorieGutenberg(['French poetry']), 'Littérature');
assert.equal(C.categorieGutenberg(['France -- History -- Revolution, 1789-1799']), 'Histoire');
assert.equal(C.categorieGutenberg(['Fiction']), 'Roman');
assert.equal(C.nomAuteur({ name: 'Hugo, Victor' }), 'Victor Hugo');

(async () => {
  const db = { livres: [{ id: 'x', titre: 'Les Misérables', auteur: 'Victor Hugo', langue: 'Français', edition: '' }], parametres: {} };
  const livres = [
    { id: 1, title: 'Les Misérables', authors: [{ name: 'Hugo, Victor', death_year: 1885 }], languages: ['fr'], copyright: false, subjects: ['Fiction'] },
    { id: 2, title: 'Candide', authors: [{ name: 'Voltaire', death_year: 1778 }], languages: ['fr'], copyright: false, subjects: ['Satire', 'Fiction'], summaries: ['A satire.'] },
    { id: 3, title: 'Livre protégé', authors: [{ name: 'X, Y' }], languages: ['fr'], copyright: true },
    { id: 4, title: 'Fichier cassé', authors: [{ name: 'Z, A' }], languages: ['fr'], copyright: false },
    { id: 5, title: 'Discours de la méthode', authors: [{ name: 'Descartes, René', death_year: 1650 }], languages: ['fr'], copyright: false, subjects: ['Philosophy'] }
  ];
  let appels = 0;
  const ctx = {
    db, sauverDB() {}, uid: () => 'id' + Math.random().toString(16).slice(2, 10), maintenant: () => new Date().toISOString(), journal() {}, doublons,
    dossierDonnees: os.tmpdir(), pause: 0,
    fetch: async url => { appels++; assert.match(url, /gutendex\.com\/books\/\?languages=fr/); return { ok: true, json: async () => ({ results: livres, next: null }) }; },
    importerDocumentLivre: async (l, url) => { if (l.titre === 'Fichier cassé') throw Object.assign(new Error('EPUB invalide.'), { statut: 400 }); l.epub = true; return { ok: true }; },
    completerDepuisEpub: async () => {}, supprimerLivre: () => {}
  };
  const col = C.creer(ctx);
  Object.assign(col.reglages().sources, { wikisource: false, ecampus: false, zenodo: false, hal: false, oapen: false }); col.reglages().espaceMinMo = 1;
  const r = await col.passage({ force: 5 });
  assert.equal(r.faits, 2, JSON.stringify(r) + JSON.stringify(col.etat().historique.slice(0,3)));
  const titres = db.livres.map(l => l.titre);
  assert.deepEqual(titres.sort(), ['Candide', 'Discours de la méthode', 'Les Misérables']);
  const candide = db.livres.find(l => l.titre === 'Candide');
  assert.equal(candide.auteur, 'Voltaire'); assert.equal(candide.sourceNumerique, 'Project Gutenberg (domaine public)'); assert.equal(candide.collecteAuto, true);
  assert.equal(db.livres.find(l => l.titre === 'Discours de la méthode').categorie, 'Philosophie');
  const e = col.etat();
  assert.equal(e.deja['gutenberg:1'], 'doublon'); assert.equal(e.deja['gutenberg:3'], 'droits'); assert.equal(e.deja['gutenberg:4'], 'échec');
  assert.ok(!db.livres.some(l => l.titre === 'Fichier cassé'), 'un import échoué ne laisse pas de fiche vide');
  // Un second passage ne réimporte rien
  const r2 = await col.passage({ force: 3 }); assert.equal(r2.faits, 0); assert.equal(appels, 1);
  // Suspension
  col.reglages().actif = false; assert.equal((await col.passage()).inactif, true);
  const pub = col.etatPublic(); assert.equal(pub.importesAuto, 2); assert.equal(pub.reglages.objectif, 10000);

  // ---- Sources universitaires : licences libres seulement, rotation entre sources ----
  assert.equal(C.licenceLibre('CC BY-SA 4.0'), true); assert.equal(C.licenceLibre('cc-by-nc-4.0'), false); assert.equal(C.licenceLibre('http://creativecommons.org/licenses/by-nd/4.0/'), false); assert.equal(C.licenceLibre(''), false);
  assert.equal(C.categorieTexte('Pédagogie universitaire et apprentissage'), 'Pédagogie'); assert.equal(C.categorieTexte('Droit constitutionnel'), 'Droit');
  const db2 = { livres: [], parametres: {} }; const vus = [];
  const reponses = {
    zenodo: { hits: { hits: [
      { id: 11, metadata: { title: 'Manuel libre de statistique', creators: [{ name: 'Dupont, Marie' }], license: { id: 'cc-by-4.0' }, publication_date: '2021-03-01', description: '<p>Un manuel.</p>' }, files: [{ key: 'manuel.pdf', size: 1000, links: { self: 'https://zenodo.org/api/records/11/files/manuel.pdf/content' } }] },
      { id: 12, metadata: { title: 'Livre non commercial', creators: [{ name: 'X' }], license: { id: 'cc-by-nc-4.0' } }, files: [{ key: 'a.pdf', size: 10 }] } ] } },
    hal: { response: { docs: [
      { halId_s: 'hal-1', title_s: ['Histoire de l’éducation en Haïti'], authFullName_s: ['Jean Pierre'], producedDateY_i: 2019, fileMain_s: 'https://hal.science/hal-1/document', licence_s: 'http://creativecommons.org/licenses/by/4.0/' },
      { halId_s: 'hal-2', title_s: ['Sans licence'], fileMain_s: 'https://hal.science/hal-2/document', licence_s: '' } ] } },
    oapen: [ { handle: '20.500/1', name: 'Sociologie des villes', metadata: [{ key: 'dc.title', value: 'Sociologie des villes' }, { key: 'dc.contributor.author', value: 'Martin, Paul' }, { key: 'dc.rights.uri', value: 'https://creativecommons.org/licenses/by/4.0/' }], bitstreams: [{ name: 'livre.pdf', mimeType: 'application/pdf', bundleName: 'ORIGINAL', retrieveLink: '/bitstream/1/livre.pdf' }] } ]
  };
  const col2 = C.creer({ ...ctx, db: db2, pause: 0,
    fetch: async url => { vus.push(url); const k = /zenodo/.test(url) ? 'zenodo' : /archives-ouvertes/.test(url) ? 'hal' : /oapen/.test(url) ? 'oapen' : null; return { ok: !!k, status: k ? 200 : 503, json: async () => structuredClone(reponses[k]), text: async () => '' }; },
    importerDocumentLivre: async l => { l.pdf = true; l.nbPagesLecture = 120; return { ok: true }; } });
  Object.assign(col2.reglages().sources, { gutenberg: false, wikisource: false, ecampus: false, zenodo: true, hal: true, oapen: true }); col2.reglages().espaceMinMo = 1;
  const r3 = await col2.passage({ force: 5 });
  assert.equal(r3.faits, 3, JSON.stringify(r3) + JSON.stringify(col2.etat().historique));
  const t2 = db2.livres.map(l => l.titre).sort();
  assert.deepEqual(t2, ['Histoire de l’éducation en Haïti', 'Manuel libre de statistique', 'Sociologie des villes']);
  const man = db2.livres.find(l => l.titre === 'Manuel libre de statistique');
  assert.equal(man.auteur, 'Marie Dupont'); assert.equal(man.annee, 2021); assert.equal(man.publicCible, 'universitaire'); assert.equal(man.categorie, 'Mathématiques');
  assert.equal(col2.etat().deja['zenodo:12'], 'hors critères'); assert.equal(col2.etat().deja['hal:hal-2'], 'hors critères');
  // Un document trop court (PDF de quelques pages) est retiré
  const db3 = { livres: [], parametres: {} };
  const col3 = C.creer({ ...ctx, db: db3, pause: 0, supprimerLivre: l => db3.livres.splice(db3.livres.indexOf(l), 1),
    fetch: async () => ({ ok: true, json: async () => structuredClone(reponses.hal) }), importerDocumentLivre: async l => { l.pdf = true; l.nbPagesLecture = 4; return { ok: true }; } });
  Object.assign(col3.reglages().sources, { gutenberg: false, wikisource: false, ecampus: false, zenodo: false, hal: true, oapen: false }); col3.reglages().espaceMinMo = 1;
  const r4 = await col3.passage({ force: 1 }); assert.equal(db3.livres.length, 0, JSON.stringify(r4) + JSON.stringify(col3.etat().historique.slice(0,2)) + JSON.stringify(col3.etat().deja)); assert.equal(col3.etat().deja['hal:hal-1'], 'trop court', JSON.stringify(col3.etat()));
  // 1.33.1 : files d'attente allégées dans la base, purge des anciennes files, report quand le serveur est occupé
  {
    const hal = Array.from({ length: 100 }, (_, i) => ({ halId_s: 'hal-' + i, title_s: ['Titre ' + i], abstract_s: ['r'.repeat(5000)], keyword_s: new Array(40).fill('mot'), licence_s: 'CC BY', fileMain_s: 'https://hal.science/f' + i + '.pdf', authFullName_s: ['A B'] }));
    const dbH = { livres: [], parametres: {}, collecte: { curseurs: { hal: { start: 100, file: hal.slice(0, 50), fini: false } } } };
    const colH = C.creer({ ...ctx, db: dbH, fetch: async () => ({ ok: true, json: async () => ({ response: { docs: hal } }) }) });
    colH.etat();
    assert.ok(JSON.stringify(dbH.collecte.curseurs.hal).length < 60000, 'ancienne file allégée');
    assert.equal(dbH.collecte.curseurs.hal.file[0].abstract_s[0].length, 800);
    const colO = C.creer({ ...ctx, db: { livres: [], parametres: {} }, occupe: () => true });
    assert.deepEqual(await colO.passage(), { reporte: true });
  }
  console.log('Collecte 1.31.0 : planification jusqu’au 31 décembre, domaine public uniquement, doublons, échecs sans fiche vide, reprise et suspension vérifiés.');
})().catch(e => { console.error(e); process.exitCode = 1; });
