const assert = require('node:assert/strict');
const PP = require('../lib/plopplop');
const D = require('../modules/dons');

(async () => {
  let serie = 0, paye = false, montantEnvoye, refEnvoyee;
  const admin = { id: 'admin', role: 'bibliothecaire' };
  const delegue = { id: 'del', role: 'bibliothecaire', adminDelegue: true, permissions: ['catalogue'] };
  const alice = { id: 'alice', role: 'apprenant', nom: 'Alice Pierre', email: 'alice@oasis.ht' };
  const db = { utilisateurs: [admin, alice], livres: [], parametres: { nom: 'OASIS' } };
  PP.passerelleActive = () => true;
  PP.initierPaiement = async c => { montantEnvoye = c.montant; refEnvoyee = c.reference; return { ok: true, urlPaiement: 'https://plopplop.solutionip.app/pay', transactionId: 't1' }; };
  PP.verifierPaiement = async () => ({ ok: true, paye, infos: { transactionId: 'PP-99', methode: 'moncash' } });

  let ip = 0;
  async function appel(methode, chemin, corps = {}, u = null) {
    let r;
    const traite = await D.route({ url: chemin, method: methode, socket: { remoteAddress: '10.0.0.' + (ip++) }, headers: {} }, {},
      { db, utilisateur: u, json: (_, code, data) => r = { code, data }, lireCorps: async () => corps, sauverDB: () => {}, uid: () => 'x' + (++serie), journal: () => {} });
    assert(traite, 'route non traitée : ' + chemin);
    return r;
  }

  // Infos publiques, sans compte
  const infos = await appel('GET', '/api/dons/infos');
  assert.equal(infos.code, 200); assert.equal(infos.data.total, 0); assert(infos.data.montantsSuggeres.length);

  // Validation
  assert.equal((await appel('POST', '/api/dons', { montant: 10, nom: 'Jean', email: 'j@x.ht' })).code, 400, 'minimum 20 HTG');
  assert.equal((await appel('POST', '/api/dons', { montant: 50.5, nom: 'Jean', email: 'j@x.ht' })).code, 400, 'entier');
  assert.equal((await appel('POST', '/api/dons', { montant: 500, nom: '', email: 'j@x.ht' })).code, 400, 'nom requis');
  assert.equal((await appel('POST', '/api/dons', { montant: 500, nom: 'Jean', email: 'pas-un-email' })).code, 400, 'email requis');

  // Don d'un visiteur anonyme
  const don = await appel('POST', '/api/dons', { montant: 750, nom: 'Jean Louis', email: 'J@X.ht', message: 'Bravo', anonyme: true });
  assert.equal(don.code, 201); assert.equal(montantEnvoye, 750); assert.equal(refEnvoyee, don.data.id); assert(/^DON-/.test(don.data.id)); assert(don.data.cle.length >= 32);
  assert.equal(db.dons[0].email, 'j@x.ht');

  // Sans la clé, le don est introuvable pour un tiers
  assert.equal((await appel('POST', '/api/dons/verifier/' + don.data.id, {})).code, 404);
  assert.equal((await appel('POST', '/api/dons/verifier/' + don.data.id, { cle: 'mauvaise' })).code, 404);
  assert.equal((await appel('GET', '/api/dons/' + don.data.id + '?cle=faux')).code, 404);

  // Paiement pas encore confirmé
  let v = await appel('POST', '/api/dons/verifier/' + don.data.id, { cle: don.data.cle });
  assert.equal(v.data.paye, false); assert.equal(db.dons[0].statut, 'en_attente');

  // Confirmé : reçu numéroté, idempotent
  paye = true;
  v = await appel('POST', '/api/dons/verifier/' + don.data.id, { cle: don.data.cle });
  assert.equal(v.data.paye, true); assert.equal(v.data.don.numeroRecu, `REC-DON-${new Date().getUTCFullYear()}-0001`); assert.equal(v.data.don.transaction, 'PP-99');
  v = await appel('POST', '/api/dons/verifier/' + don.data.id, { cle: don.data.cle });
  assert.equal(v.data.don.numeroRecu, `REC-DON-${new Date().getUTCFullYear()}-0001`, 'pas de second numéro');
  assert.equal((await appel('GET', '/api/dons/' + don.data.id + '?cle=' + don.data.cle)).data.montant, 750);

  // Le don anonyme apparaît sans nom ni message
  const apres = await appel('GET', '/api/dons/infos');
  assert.equal(apres.data.total, 750); assert.equal(apres.data.nombre, 1);
  assert.equal(apres.data.recents[0].nom, 'Donateur anonyme'); assert.equal(apres.data.recents[0].message, '');

  // Don d'un lecteur connecté : nom/email pris du compte, retrouvé sans clé
  paye = false;
  const d2 = await appel('POST', '/api/dons', { montant: 250 }, alice);
  assert.equal(d2.code, 201); assert.equal(db.dons[1].nom, 'Alice Pierre'); assert.equal(db.dons[1].utilisateurId, 'alice');
  assert.equal((await appel('POST', '/api/dons/verifier/' + d2.data.id, {}, alice)).code, 200);
  assert.equal((await appel('GET', '/api/dons?mes=1', {}, alice)).data.length, 1);

  // Échec passerelle : rien n'est confirmé
  PP.verifierPaiement = async () => ({ ok: false, error: 'Panne' });
  assert.equal((await appel('POST', '/api/dons/verifier/' + d2.data.id, {}, alice)).code, 502);
  assert.equal(db.dons[1].statut, 'en_attente');
  PP.verifierPaiement = async () => ({ ok: true, paye: true, infos: {} });

  // Administration
  assert.equal((await appel('GET', '/api/admin-dons', {}, alice)).code, 403);
  assert.equal((await appel('GET', '/api/admin-dons', {}, delegue)).code, 403);
  const tab = await appel('GET', '/api/admin-dons', {}, admin);
  assert.equal(tab.code, 200); assert.equal(tab.data.dons.length, 2); assert.equal(tab.data.dons.find(x => x.id === don.data.id).nom, 'Jean Louis', 'l’admin voit le nom réel');
  assert.equal((await appel('POST', '/api/admin-dons/' + d2.data.id + '/verifier', {}, admin)).data.paye, true);
  assert.equal(D.statistiques(db).total, 1000);

  assert.equal((await appel('PUT', '/api/admin-dons/parametres', { objectif: -5 }, admin)).code, 400);
  const p = await appel('PUT', '/api/admin-dons/parametres', { actif: false, objectif: 50000, montantsSuggeres: [5, 100, 100, 300] }, admin);
  assert.equal(p.code, 200); assert.deepEqual(p.data.montantsSuggeres, [100, 300]);
  assert.equal((await appel('POST', '/api/dons', { montant: 500, nom: 'Jean', email: 'j@x.ht' })).code, 403, 'dons suspendus');

  // Passerelle non configurée
  db.parametres.dons.actif = true; PP.passerelleActive = () => false;
  assert.equal((await appel('POST', '/api/dons', { montant: 500, nom: 'Jean', email: 'j@x.ht' })).code, 503);

  // Routes étrangères ignorées
  assert.equal(await D.route({ url: '/api/livres', method: 'GET' }, {}, { db, json: () => {} }), false);
  console.log('dons OK');
})().catch(e => { console.error(e); process.exit(1); });
