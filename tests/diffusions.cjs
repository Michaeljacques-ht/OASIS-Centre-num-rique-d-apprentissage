// 1.34.0 : diffusions en direct et en différé, annoncées à tous les membres.
const assert = require('node:assert/strict');
const D = require('../modules/diffusions');

assert.equal(D.idYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
assert.equal(D.idYoutube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(D.idYoutube('https://www.youtube.com/live/dQw4w9WgXcQ?si=x'), 'dQw4w9WgXcQ');
assert.equal(D.idYoutube('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(D.idYoutube('https://evil.example/watch?v=dQw4w9WgXcQ'), '');
assert.equal(D.lienFacebook('https://www.facebook.com/oasis/videos/123'), 'https://www.facebook.com/oasis/videos/123');
assert.equal(D.lienFacebook('https://facebook.com.evil.io/x'), '');
assert.equal(D.lienHttps('javascript:alert(1)'), '');
assert.equal(D.lienHttps('http://zoom.us/j/1'), '');

(async () => {
  let t = Date.parse('2026-12-01T15:00:00Z');
  const db = { parametres: {}, journal: [], medias: [{ id: 'v1', type: 'video', titre: 'Conférence enregistrée', fichier: true }],
    utilisateurs: [
      { id: 'b', role: 'bibliothecaire', nom: 'Biblio', email: 'b@oasis.ht' },
      { id: 'u1', role: 'lecteur', nom: 'Ana', email: 'ana@exemple.ht', emailVerifie: true },
      { id: 'u2', role: 'lecteur', nom: 'Non confirmé', email: 'nc@exemple.ht', emailVerifie: false },
      { id: 'u3', role: 'lecteur', nom: 'Sans email' }] };
  const mails = []; let n = 0;
  const col = D.creer({ db, sauverDB() {}, uid: () => 'd' + (++n), heure: () => t, maintenant: () => new Date(t).toISOString(), pauseEmail: 0, delaiTraitement: 999999,
    envoyer: async m => { mails.push(m); return { ok: true }; }, emailActif: () => true, siteUrl: () => 'https://oasis.test' });
  const appel = async (u, method, url, corps) => { let r; const res = { writeHead(c) { this.code = c; }, end(b) { r = [this.code, b]; } };
    const ok = await col.route({ method, url }, res, { utilisateur: u, json: (_, c, d) => { r = [c, d]; }, lireCorps: async () => corps || {} }); return ok ? r : null; };
  const B = db.utilisateurs[0], U = db.utilisateurs[1];

  // Droits et validations
  assert.equal((await appel(null, 'GET', '/api/diffusions'))[0], 401);
  assert.equal((await appel(U, 'POST', '/api/diffusions', { titre: 'x' }))[0], 403);
  assert.match((await appel(B, 'POST', '/api/diffusions', { titre: 'Sans date', sourceType: 'youtube', sourceValeur: 'dQw4w9WgXcQ' }))[1].erreur, /date/);
  assert.match((await appel(B, 'POST', '/api/diffusions', { titre: 'Mauvais lien', debut: '2026-12-01T17:00:00Z', sourceType: 'lien', sourceValeur: 'javascript:alert(1)' }))[1].erreur, /invalide/);
  assert.match((await appel(B, 'POST', '/api/diffusions', { titre: 'Différé + lien', mode: 'differe', debut: '2026-12-01T17:00:00Z', sourceType: 'lien', sourceValeur: 'https://zoom.us/j/1' }))[1].erreur, /différé/);
  assert.equal(await appel(B, 'GET', '/api/autre'), null);

  // Programmation d'un direct YouTube dans 2 h
  const [c1, d1] = await appel(B, 'POST', '/api/diffusions', { titre: 'Conférence <b>Haïti</b>', intervenant: 'Pr Jean', debut: '2026-12-01T17:00:00Z', dureeMin: 90, mode: 'direct', sourceType: 'youtube', sourceValeur: 'https://www.youtube.com/live/dQw4w9WgXcQ' });
  assert.equal(c1, 201); assert.equal(d1.statut, 'programmee'); assert.deepEqual(d1.source, { type: 'youtube', youtube: 'dQw4w9WgXcQ' }); assert.equal(d1.emailAnnonce, true);
  assert.equal(db.parametres.secretDiffusions, undefined, 'aucun secret dans les paramètres publics');

  // Tous les membres le voient dans leurs notifications ; email d'annonce aux comptes confirmés seulement
  let notifs = col.notifications(); assert.equal(notifs.length, 1); assert.equal(notifs[0].type, 'diffusion'); assert.deepEqual(notifs[0].action, { diffusion: d1.id });
  await col.traiter();
  assert.deepEqual(mails.map(m => m.a).sort(), ['ana@exemple.ht', 'b@oasis.ht']);
  assert.match(mails[0].sujet, /Conférence en direct/); assert.match(mails[0].html, /&lt;b&gt;Haïti/); assert.doesNotMatch(mails[0].html, /<b>Haïti/);
  assert.equal(db.diffusions[0].envois.annonce.envoyes, 2);
  await col.traiter(); assert.equal(mails.length, 2, 'pas de second envoi');

  // Désabonnement par lien signé
  const lien = mails.find(m => m.a === 'ana@exemple.ht').texte.match(/https:\/\/oasis\.test(\/api\/diffusions\/desabonnement\S+)/)[1];
  assert.equal((await appel(null, 'GET', lien.replace(/s=\w+/, 's=' + '0'.repeat(32))))[0], 400);
  assert.equal(U.sansEmailDiffusion, undefined);
  assert.equal((await appel(null, 'GET', lien))[0], 200); assert.equal(U.sansEmailDiffusion, true);
  assert.equal((await appel(U, 'PUT', '/api/diffusions/preferences', { recevoirEmails: true }))[1].recoitEmails, true);

  // À l'heure : en direct, bandeau, email « c'est commencé », spectateurs
  t = Date.parse('2026-12-01T17:01:00Z');
  notifs = col.notifications(); assert.equal(notifs[0].type, 'diffusion-direct');
  await col.traiter(); assert.equal(mails.filter(m => /commencé/.test(m.sujet)).length, 2);
  assert.equal((await appel(U, 'POST', `/api/diffusions/${d1.id}/presence`))[1].spectateurs, 1);
  assert.equal((await appel(B, 'POST', `/api/diffusions/${d1.id}/presence`))[1].spectateurs, 2);
  t += 120000; assert.equal((await appel(U, 'POST', `/api/diffusions/${d1.id}/presence`))[1].spectateurs, 1, 'les absents ne comptent plus');
  assert.equal(db.diffusions[0].vues, 2);
  assert.equal((await appel(U, 'POST', `/api/diffusions/${d1.id}/terminer`))[0], 403);

  // Terminée par le bibliothécaire, puis rediffusion annoncée
  const [, fin1] = await appel(B, 'POST', `/api/diffusions/${d1.id}/terminer`); assert.equal(fin1.statut, 'terminee');
  assert.equal(col.notifications().length, 0);
  assert.match((await appel(B, 'POST', `/api/diffusions/${d1.id}/replay`, { sourceType: 'lien', sourceValeur: 'https://zoom.us/j/1' }))[1].erreur, /vidéo/);
  await appel(B, 'POST', `/api/diffusions/${d1.id}/replay`, { sourceType: 'video', sourceValeur: 'v1' });
  notifs = col.notifications(); assert.equal(notifs[0].id, 'diff-replay-' + d1.id);

  // Différé : vidéo de la cinémathèque, démarrage anticipé, fin automatique après la durée
  const [, d2] = await appel(B, 'POST', '/api/diffusions', { titre: 'Film documentaire', debut: '2026-12-02T20:00:00Z', dureeMin: 30, mode: 'differe', sourceType: 'video', sourceValeur: 'v1', emailAnnonce: false, emailDirect: false });
  assert.deepEqual(d2.source, { type: 'video', mediaId: 'v1' });
  const [, d2b] = await appel(B, 'POST', `/api/diffusions/${d2.id}/demarrer`); assert.equal(d2b.statut, 'en_direct'); assert.equal(d2b.debut, new Date(t).toISOString());
  await col.traiter(); assert.equal(mails.length, 4, 'emails désactivés pour cette diffusion');
  t += 31 * 60000; assert.equal(col.statut(db.diffusions[1], t), 'terminee');

  // Modification, annulation (invisible pour les membres), suppression
  const [, d3] = await appel(B, 'POST', '/api/diffusions', { titre: 'Atelier', debut: '2026-12-05T14:00:00Z', sourceType: 'facebook', sourceValeur: 'https://www.facebook.com/oasis/videos/42' });
  assert.equal((await appel(B, 'PUT', `/api/diffusions/${d3.id}`, { titre: 'Atelier d’écriture', dureeMin: 2 }))[0], 400);
  assert.equal((await appel(B, 'PUT', `/api/diffusions/${d3.id}`, { titre: 'Atelier d’écriture' }))[1].titre, 'Atelier d’écriture');
  await appel(B, 'POST', `/api/diffusions/${d3.id}/annuler`);
  assert.ok(!(await appel(U, 'GET', '/api/diffusions'))[1].diffusions.some(x => x.id === d3.id));
  assert.equal((await appel(U, 'GET', `/api/diffusions/${d3.id}`))[0], 404);
  assert.ok((await appel(B, 'GET', '/api/diffusions'))[1].diffusions.some(x => x.id === d3.id));
  assert.equal((await appel(B, 'DELETE', `/api/diffusions/${d3.id}`))[0], 200); assert.equal(db.diffusions.length, 2);

  // Sans configuration email : prévenus dans OASIS uniquement, noté pour le bibliothécaire
  const db2 = { parametres: {}, medias: [], utilisateurs: [{ id: 'u', email: 'a@b.ht' }] };
  const col2 = D.creer({ db: db2, sauverDB() {}, uid: () => 'x', heure: () => t, emailActif: () => false, envoyer: async () => { throw new Error('ne doit pas envoyer'); }, delaiTraitement: 999999 });
  db2.diffusions = [{ id: 'x', titre: 'T', debut: new Date(t + 3600000).toISOString(), dureeMin: 60, mode: 'direct', source: { type: 'lien', url: 'https://meet.google.com/abc' }, emailAnnonce: true, creeLe: new Date(t).toISOString() }];
  await col2.traiter(); assert.match(db2.diffusions[0].envois.annonce.note, /non configuré/); assert.equal(col2.notifications().length, 1);
  console.log('Diffusions 1.34.0 : direct YouTube/Facebook/visioconférence, différé synchronisé, notifications, emails aux comptes confirmés, désabonnement signé, spectateurs, rediffusion et droits vérifiés.');
})().catch(e => { console.error(e); process.exit(1); });
