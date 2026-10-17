const assert = require('node:assert/strict');
const Q = require('../modules/quiz');
const A = require('../modules/abonnement');

(async () => {
  let serie = 0;
  const uid = () => 'id' + String(++serie).padStart(6, '0');
  const admin = { id: 'admin', role: 'bibliothecaire', nom: 'Admin' };
  const emma = { id: 'emma', role: 'apprenant', nom: 'Emma', essaiFin: '2000-01-01' };
  const paul = { id: 'paul', role: 'apprenant', nom: 'Paul' };
  const db = { utilisateurs: [admin, emma, paul], livres: [{ id: 'l1', titre: 'Gouverneurs de la Rosée', categorie: 'Littérature haïtienne' }],
    categories: [{ nom: 'Littérature haïtienne' }, { nom: 'Sciences' }] };
  async function appel(methode, chemin, corps = {}, u = null) {
    let r;
    assert(await Q.route({ url: chemin, method: methode }, {}, { db, utilisateur: u, json: (_, code, data) => r = { code, data }, lireCorps: async () => corps, sauverDB: () => {}, uid, journal: () => {} }));
    return r;
  }
  const question = (enonce, bonne = 0) => ({ enonce, choix: ['Réponse A', 'Réponse B', 'Réponse C'], bonne, explication: 'Parce que.' });
  const modele = (niveau, extra = {}) => ({ titre: 'Quiz niveau ' + niveau, categorie: 'Littérature haïtienne', niveau, publie: true, melanger: false,
    questions: [question('Q1 ?', 0), question('Q2 ?', 1), question('Q3 ?', 2), question('Q4 ?', 0)], ...extra });

  // Création : réservée à l'admin, validée
  assert.equal((await appel('POST', '/api/admin-quiz', modele(1), emma)).code, 403);
  assert.equal((await appel('POST', '/api/admin-quiz', { ...modele(1), categorie: 'Inconnue' }, admin)).code, 400);
  assert.equal((await appel('POST', '/api/admin-quiz', { ...modele(1), niveau: 7 }, admin)).code, 400);
  assert.equal((await appel('POST', '/api/admin-quiz', { ...modele(1), questions: [{ enonce: 'Seul ?', choix: ['x'], bonne: 0 }] }, admin)).code, 400);
  assert.equal((await appel('POST', '/api/admin-quiz', { ...modele(1), questions: [{ enonce: 'Doublon ?', choix: ['a', 'A'], bonne: 0 }] }, admin)).code, 400);
  const q1 = (await appel('POST', '/api/admin-quiz', modele(1, { livreId: 'l1', recompense: { joursOfferts: 7 } }), admin)).data;
  assert.equal(q1.seuil, 70); assert.equal(q1.recompense.points, 10); assert.equal(q1.recompense.badgeEmoji, '🌱');
  const q2 = (await appel('POST', '/api/admin-quiz', modele(2, { tentativesMax: 1 }), admin)).data;
  const q3 = (await appel('POST', '/api/admin-quiz', modele(3, { dureeMinutes: 5 }), admin)).data;
  const q4 = (await appel('POST', '/api/admin-quiz', modele(4), admin)).data;
  const brouillon = (await appel('POST', '/api/admin-quiz', { ...modele(1), publie: false, titre: 'Brouillon' }, admin)).data;

  // Catalogue lecteur : pas de bonnes réponses, niveaux verrouillés
  assert.equal((await appel('GET', '/api/quiz')).code, 401);
  let cat = (await appel('GET', '/api/quiz', {}, emma)).data;
  assert.equal(cat.categories.length, 1); assert.equal(cat.categories[0].niveaux.length, 4);
  const tous = cat.categories[0].niveaux.flatMap(n => n.quiz);
  assert(!tous.some(q => q.id === brouillon.id), 'brouillon caché');
  assert.equal(tous.find(q => q.id === q1.id).verrou, null);
  assert(tous.find(q => q.id === q2.id).verrou, 'niveau 2 verrouillé');
  assert.equal((await appel('POST', `/api/quiz/${q2.id}/commencer`, {}, emma)).code, 403);
  assert.equal((await appel('POST', `/api/quiz/${brouillon.id}/commencer`, {}, emma)).code, 404);

  // Tentative : les questions n'exposent pas la bonne réponse
  let t = (await appel('POST', `/api/quiz/${q1.id}/commencer`, {}, emma)).data;
  assert.equal(t.questions.length, 4);
  assert(!JSON.stringify(t.questions).includes('"bonne"') && !JSON.stringify(t.questions).includes('explication'));

  // Échec à 50 % (seuil 70) : aucune récompense
  let r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: { [t.questions[0].id]: 0, [t.questions[1].id]: 1 } }, emma)).data;
  assert.equal(r.pourcentage, 50); assert.equal(r.reussi, false); assert.equal(r.recompenses.length, 0); assert.equal(r.corrections[2].bonne, 2);
  assert.equal((await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: {} }, emma)).code, 409, 'pas de double soumission');

  // Réussite : badge, points, 7 jours offerts → accès complet
  assert(!A.actif(db, emma));
  t = (await appel('POST', `/api/quiz/${q1.id}/commencer`, {}, emma)).data;
  assert.equal((await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: {} }, paul)).code, 404, 'tentative d’un autre');
  const toutJuste = { [t.questions[0].id]: 0, [t.questions[1].id]: 1, [t.questions[2].id]: 2, [t.questions[3].id]: 0 };
  r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: toutJuste }, emma)).data;
  assert.equal(r.reussi, true); assert.equal(r.pourcentage, 100); assert.equal(r.recompenses.length, 1); assert.equal(r.points, 10);
  assert(A.actif(db, emma), 'jours offerts actifs');
  const finOfferte = emma.accesOffertFin;

  // Rejouer un quiz réussi ne redonne rien
  t = (await appel('POST', `/api/quiz/${q1.id}/commencer`, {}, emma)).data;
  r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: Object.fromEntries(t.questions.map((q, i) => [q.id, [0, 1, 2, 0][i]])) }, emma)).data;
  assert.equal(r.recompenses.length, 0); assert.equal(r.points, 10); assert.equal(emma.accesOffertFin, finOfferte);

  // Niveau 2 débloqué ; une seule tentative autorisée
  cat = (await appel('GET', '/api/quiz', {}, emma)).data;
  assert.equal(cat.categories[0].niveaux.flatMap(n => n.quiz).find(q => q.id === q2.id).verrou, null);
  t = (await appel('POST', `/api/quiz/${q2.id}/commencer`, {}, emma)).data;
  r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: Object.fromEntries(t.questions.map((q, i) => [q.id, [0, 1, 2, 0][i]])) }, emma)).data;
  assert.equal(r.reussi, true); assert.equal(r.tentativesRestantes, 0);
  assert.equal((await appel('POST', `/api/quiz/${q2.id}/commencer`, {}, emma)).code, 409);

  // Niveau 3 chronométré : soumission hors délai = échec
  t = (await appel('POST', `/api/quiz/${q3.id}/commencer`, {}, emma)).data;
  db.quizTentatives.find(x => x.id === t.tentative).finPrevue = new Date(Date.now() - 60000).toISOString();
  r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: Object.fromEntries(t.questions.map((q, i) => [q.id, [0, 1, 2, 0][i]])) }, emma)).data;
  assert.equal(r.horsDelai, true); assert.equal(r.reussi, false);

  // Niveaux 3 et 4 réussis → badge de maîtrise
  for (const q of [q3, q4]) {
    t = (await appel('POST', `/api/quiz/${q.id}/commencer`, {}, emma)).data;
    r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: Object.fromEntries(t.questions.map((x, i) => [x.id, [0, 1, 2, 0][i]])) }, emma)).data;
    assert.equal(r.reussi, true);
  }
  assert(r.recompenses.some(b => b.type === 'maitrise'));
  const rec = (await appel('GET', '/api/quiz/recompenses', {}, emma)).data;
  assert.equal(rec.points, 10 + 20 + 35 + 50 + 100); assert.equal(rec.badges.length, 5); assert.equal(rec.rang.nom, 'Érudit');
  cat = (await appel('GET', '/api/quiz', {}, emma)).data; assert.equal(cat.categories[0].maitrise, true);

  // Mélange : la correction suit l'ordre affiché
  const qm = (await appel('POST', '/api/admin-quiz', { ...modele(1), categorie: 'Sciences', melanger: true }, admin)).data;
  t = (await appel('POST', `/api/quiz/${qm.id}/commencer`, {}, paul)).data;
  const parEnonce = { 'Q1 ?': 'Réponse A', 'Q2 ?': 'Réponse B', 'Q3 ?': 'Réponse C', 'Q4 ?': 'Réponse A' };
  r = (await appel('POST', `/api/quiz/tentatives/${t.tentative}/soumettre`, { reponses: Object.fromEntries(t.questions.map(q => [q.id, q.choix.indexOf(parEnonce[q.enonce])])) }, paul)).data;
  assert.equal(r.pourcentage, 100);

  // Classement
  const cl = (await appel('GET', '/api/quiz/classement', {}, paul)).data;
  assert.equal(cl[0].nom, 'Emma'); assert(cl.some(x => x.moi));

  // Admin : stats, publication, suppression conserve les badges
  const adm = (await appel('GET', '/api/admin-quiz', {}, admin)).data;
  assert.equal(adm.quiz.find(q => q.id === q1.id).stats.tentatives, 3);
  assert.equal((await appel('PUT', `/api/admin-quiz/${q4.id}`, { publie: false }, admin)).data.publie, false);
  assert.equal((await appel('PUT', `/api/admin-quiz/${q4.id}`, { ...modele(4), titre: 'Expert revu' }, admin)).data.titre, 'Expert revu');
  assert.equal((await appel('DELETE', `/api/admin-quiz/${q1.id}`, {}, admin)).code, 200);
  assert.equal((await appel('GET', '/api/quiz/recompenses', {}, emma)).data.badges.length, 5);
  console.log('quiz OK');
})().catch(e => { console.error(e); process.exit(1); });
