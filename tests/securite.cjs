// Correctif de sécurité 1.13.1 : vérifie chaque faille corrigée suite à l'audit du 3 novembre 2026.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const S = require('../modules/securite');

const source = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-securite-test-'));
let server, base, sortie = '';

async function demarrer(env = {}) {
  sortie = '';
  server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '', OASIS_ADMIN_MDP: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((ok, ko) => {
    server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); });
    server.stderr.on('data', c => { sortie += c; });
    server.on('error', ko); server.on('exit', code => ko(Error('Arrêt du serveur ' + code + '\n' + sortie)));
  });
  await new Promise(r => setTimeout(r, 400));   // laisse arriver les dernières lignes du démarrage
}
async function arreter() { if (server && server.exitCode === null) { const fin = new Promise(r => server.once('exit', r)); server.kill(); await fin; } }
async function api(route, jeton, method = 'GET', corps) {
  const r = await fetch(base + '/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: corps === undefined ? undefined : JSON.stringify(corps) });
  const texte = await r.text(); let data; try { data = JSON.parse(texte); } catch { data = texte; }
  return { code: r.status, data, headers: r.headers };
}
const connexion = (email, motDePasse) => api('/connexion', null, 'POST', { email, motDePasse });
const lireDB = () => JSON.parse(fs.readFileSync(path.join(temp, 'data', 'db.json'), 'utf8'));
const ecrireDB = db => fs.writeFileSync(path.join(temp, 'data', 'db.json'), JSON.stringify(db));

(async () => {
  try {
    /* ---- Tests unitaires du module ---- */
    assert.equal(S.couleurValide('#1e4fa3'), true);
    assert.equal(S.couleurValide('red;background:url(x)'), false);
    assert.equal(S.iconeValide('📘'), true);
    assert.equal(S.iconeValide('🏛️'), true);
    assert.equal(S.iconeValide('<img src=x onerror=alert(1)>'), false);
    assert.equal(S.iconeValide('"><svg>'), false);
    const sale = { livres: [{ icone: '<img>', couleur: '#fff' }], categories: [{ icone: '📚', couleur: 'x" onmouseover="y' }], ressources: [{ lien: 'javascript:alert(1)' }] };
    assert.equal(S.nettoyerApparence(sale), 3);
    assert.equal(sale.livres[0].icone, '📘'); assert.equal(sale.categories[0].couleur, '#1e4fa3'); assert.equal(sale.ressources[0].lien, '');
    assert.equal(S.ipDe({ headers: { 'x-forwarded-for': '6.6.6.6, 41.1.2.3' }, socket: {} }), '41.1.2.3');

    /* ---- Serveur sur une copie ---- */
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {')
      .replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);

    // Faille 1 : base neuve sans mode démo → plus de admin123 ni de compte Emma ; mot de passe aléatoire affiché une fois
    await demarrer();
    assert.match(sortie, /Base neuve — administrateur : admin@oasis\.ht \/ \S{10,}/);
    assert.doesNotMatch(sortie, /admin123|demo123/);
    const mdpInitial = sortie.match(/admin@oasis\.ht \/ (\S+)/)[1];
    assert.equal((await connexion('admin@oasis.ht', 'admin123')).code, 401);
    assert.equal((await connexion('emma@oasis.ht', 'demo123')).code, 401);
    const adm = (await connexion('admin@oasis.ht', mdpInitial)).data.jeton;
    assert.ok(adm);

    // Faille 7 : en-têtes de sécurité sur les pages et l'API
    const page = await fetch(base + '/');
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(page.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.match(page.headers.get('content-security-policy'), /object-src 'none'/);
    assert.equal((await api('/version')).headers.get('x-content-type-options'), 'nosniff');

    // Faille 3 : icône et couleur piégées refusées (création, modification, catégorie)
    const piege = '<img src=x onerror=alert(1)>';
    assert.equal((await api('/livres', adm, 'POST', { titre: 'T', auteur: 'A', categorie: 'Sciences', icone: piege })).code, 400);
    assert.equal((await api('/livres', adm, 'POST', { titre: 'T', auteur: 'A', categorie: 'Sciences', couleur: 'red;x:"' })).code, 400);
    const livre = await api('/livres', adm, 'POST', { titre: 'Livre sûr', auteur: 'Auteur', categorie: 'Sciences', icone: '📗', couleur: '#228844' });
    assert.equal(livre.code, 201);
    assert.equal((await api('/livres/' + livre.data.id, adm, 'PUT', { icone: piege })).code, 400);
    assert.equal((await api('/livres/' + livre.data.id, adm, 'PUT', { couleur: '#123456' })).code, 200);
    assert.equal((await api('/categories', adm, 'POST', { nom: 'Piège', icone: piege })).code, 400);
    assert.equal((await api('/ressources', adm, 'POST', { genre: 'base', titre: 'R', contenu: 'C', lien: 'javascript:alert(1)' })).code, 400);

    // Faille 11 : plus de mot de passe par défaut oasis123 pour les membres
    assert.equal((await api('/membres', adm, 'POST', { nom: 'Élève', email: 'eleve@test.ht' })).code, 400);
    assert.equal((await api('/membres', adm, 'POST', { nom: 'Élève', email: 'eleve@test.ht', motDePasse: 'oasis123' })).code, 400);
    assert.equal((await api('/membres', adm, 'POST', { nom: 'Élève', email: 'eleve@test.ht', motDePasse: 'Bonjour2026' })).code, 201);
    assert.equal((await api('/inscription', null, 'POST', { nom: 'X', email: 'x@test.ht', motDePasse: 'court', profilAbonnement: 'professionnel', profession: 'test' })).code, 400);

    // Faille 6 : la sauvegarde ne contient plus aucune session
    const sauvegarde = await api('/sauvegarde', adm);
    assert.equal(sauvegarde.code, 200);
    assert.deepEqual(sauvegarde.data.sessions, {});

    // Faille 2 : 5 échecs → blocage, y compris avec le bon mot de passe
    for (let i = 0; i < 5; i++) assert.equal((await connexion('eleve@test.ht', 'mauvais' + i)).code, 401);
    const bloquee = await connexion('eleve@test.ht', 'Bonjour2026');
    assert.equal(bloquee.code, 429);
    assert.match(bloquee.data.erreur, /Trop de tentatives/);
    assert.equal((await connexion('admin@oasis.ht', mdpInitial)).code, 200);   // les autres comptes restent accessibles
    await arreter();

    // Faille 1 (base existante) : admin123 refusé hors mode démo, puis remplacé par OASIS_ADMIN_MDP
    const db = lireDB();
    const admin = db.utilisateurs.find(u => u.email === 'admin@oasis.ht');
    const crypto = require('node:crypto');
    admin.sel = 'abcd'; admin.hash = crypto.scryptSync('admin123', 'abcd', 32).toString('hex');
    db.sessions = { ancienjeton: admin.id };
    db.livres[0].icone = '<img src=x onerror=alert(1)>';         // donnée piégée déjà enregistrée
    ecrireDB(db);
    await demarrer();
    const refus = await connexion('admin@oasis.ht', 'admin123');
    assert.equal(refus.code, 403);
    assert.match(refus.data.erreur, /OASIS_ADMIN_MDP/);
    assert.match(sortie, /1 icône\(s\), couleur\(s\) ou lien\(s\) dangereux remplacés/);
    await new Promise(r => setTimeout(r, 200));
    assert.equal(lireDB().livres[0].icone, '📘');
    await arreter();

    await demarrer({ OASIS_ADMIN_MDP: 'Nouveau-Mot-De-Passe-2026' });
    assert.match(sortie, /mis à jour depuis OASIS_ADMIN_MDP/);
    assert.equal((await connexion('admin@oasis.ht', 'admin123')).code, 401);
    assert.equal((await connexion('admin@oasis.ht', 'Nouveau-Mot-De-Passe-2026')).code, 200);
    assert.equal((await api('/moi', 'ancienjeton')).code, 401);            // anciennes sessions fermées
    await arreter();

    console.log('Sécurité 1.13.1 : mot de passe initial, mots de passe publics, limite de connexion, en-têtes, icônes et couleurs, liens, sauvegarde et membres vérifiés.');
  } catch (e) { console.error(e); process.exitCode = 1; await arreter(); }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
})();
