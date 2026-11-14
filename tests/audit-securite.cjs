// 1.30.0 : correctifs de l'audit de sécurité du 13 novembre 2026.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const source = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-audit-test-'));
let server, base, sortie = '';
(async () => {
  try {
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {').replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);
    server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '1', OASIS_ADMIN_MDP: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((ok, ko) => { server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); }); server.stderr.on('data', c => { sortie += c; }); server.on('exit', c => ko(Error('arrêt ' + c + sortie))); });
    const api = async (route, jeton, corps, brut) => { const r = await fetch(base + '/api' + route, { method: corps !== undefined || brut !== undefined ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: brut !== undefined ? brut : corps !== undefined ? JSON.stringify(corps) : undefined }); return { code: r.status, data: await r.json().catch(() => ({})) }; };
    const connexion = (email, mdp) => api('/connexion', null, { email, motDePasse: mdp });

    // Corps de requête invalide ou trop gros : erreur propre, pas d'erreur 500 ni de requête bloquée
    assert.equal((await api('/connexion', null, undefined, '{pas du json')).code, 400);
    assert.equal((await api('/connexion', null, undefined, JSON.stringify({ email: 'x'.repeat(2_100_000) }))).code, 413);

    // Champs d'inscription bornés
    assert.equal((await api('/inscription', null, { nom: 'N'.repeat(500), email: 'long@test.ht', motDePasse: 'secret123', profilAbonnement: 'etudiant', etablissement: 'U', matricule: '1' })).code, 400);

    // Changement de mot de passe : ancien requis, autres sessions fermées, session courante conservée
    const s1 = (await connexion('emma@oasis.ht', 'demo123')).data.jeton, s2 = (await connexion('emma@oasis.ht', 'demo123')).data.jeton;
    assert.equal((await api('/moi/mot-de-passe', s1, { actuel: 'mauvais', nouveau: 'NouveauMdp2026' })).code, 401);
    assert.equal((await api('/moi/mot-de-passe', s1, { actuel: 'demo123', nouveau: 'court' })).code, 400);
    const ch = await api('/moi/mot-de-passe', s1, { actuel: 'demo123', nouveau: 'NouveauMdp2026' });
    assert.equal(ch.code, 200); assert.equal(ch.data.sessionsFermees, 1);
    assert.equal((await api('/moi', s1)).code, 200); assert.equal((await api('/moi', s2)).code, 401);
    assert.equal((await connexion('emma@oasis.ht', 'demo123')).code, 401);
    assert.equal((await connexion('emma@oasis.ht', 'NouveauMdp2026')).code, 200);
    assert.equal((await api('/moi/mot-de-passe', null, { actuel: 'x', nouveau: 'yyyyyyyy' })).code, 401);

    // Jetons non valides (y compris noms de propriétés JavaScript) refusés
    for (const j of ['__proto__', 'constructor', 'toString', 'x']) assert.equal((await api('/moi', j)).code, 401, j);

    // Discussion d'un groupe réservée aux membres
    const admin = (await connexion('admin@oasis.ht', 'admin123')).data.jeton;
    const autre = (await api('/inscription', null, { nom: 'Autre Lecteur', email: 'autre@test.ht', motDePasse: 'secret123', profilAbonnement: 'etudiant', etablissement: 'U', matricule: '2' })).data.jeton;
    const g = (await api('/groupes', s1, { nom: 'Club privé test', type: 'club', description: 'x' })).data;
    assert.ok(g.id, JSON.stringify(g));
    assert.equal((await api('/groupes/' + g.id + '/messages', s1, { texte: 'Message confidentiel' })).code, 201);
    const vu = (await api('/groupes/' + g.id, autre)).data; assert.equal(vu.messages.length, 0); assert.equal(vu.discussionReservee, true);
    assert.equal((await api('/groupes/' + g.id, s1)).data.messages.length, 1);
    assert.equal((await api('/groupes/' + g.id, admin)).data.messages.length, 1);
    console.log('Audit 1.30.0 : corps invalides, champs bornés, changement de mot de passe, jetons, discussion réservée aux membres vérifiés.');
  } catch (e) { console.error(e); console.error(sortie.slice(-1500)); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const f = new Promise(r => server.once('exit', r)); server.kill(); await f; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
