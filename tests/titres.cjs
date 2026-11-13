// 1.28.0 : correction des titres du catalogue (règles, API protégée, application et annulation).
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const T = require('../modules/titres');
const cas = [
  ["L'HISTOIRE D'HAÏTI - TOME IX", '', "L'histoire d'Haïti - Tome IX"],
  ['CONSTITUTION DE LA RÉPUBLIQUE D’HAÏTI DE 1987', '', 'Constitution de la République d’Haïti de 1987'],
  ['MENFP : PROGRAMME DE 9E ANNÉE', '', 'MENFP : Programme de 9e année'],
  ['Les Misérables (French)', 'Victor Hugo', 'Les Misérables'],
  ['The Project Gutenberg EBook of Candide', 'Voltaire', 'Candide'],
  ["Ã‰tudes sur l'histoire d'HaÃ¯ti", '', "Études sur l'histoire d'Haïti"],
  ['gouverneurs de la rosée', 'Jacques Roumain', 'Gouverneurs de la rosée'],
  ['Droit_des_contrats_administratifs.pdf', '', 'Droit des contrats administratifs'],
  ["Ainsi parla l'oncle  - Jean Price-Mars", 'Jean Price-Mars', "Ainsi parla l'oncle"],
  ['Contes &amp; légendes d’Haïti.', '', 'Contes & légendes d’Haïti'],
  ['Le Petit Prince — Wikisource', '', 'Le Petit Prince'],
  ['Haïti au XIXE SIÈCLE', '', 'Haïti au XIXE SIÈCLE'], // pas entièrement en capitales : inchangé
];
for (const [t, a, attendu] of cas) assert.equal(T.proposer(t, a).titre, attendu, t);
for (const t of ['Manuel des matières du Code de procédure civile (1878)', 'Histoire d’Haïti, t. 2', 'Premiers secours : spécial accidents domestiques', 'La vie etc.']) assert.deepEqual(T.proposer(t).raisons, [], t);
const an = T.analyser([{ id: 'a', titre: 'CANDIDE', auteur: 'Voltaire' }, { id: 'b', titre: 'Candide', auteur: 'Voltaire' }, { id: 'c', titre: 'Zadig', auteur: 'Voltaire' }]);
assert.equal(an.corrections.length, 1); assert.equal(an.corrections[0].propose, 'Candide'); assert.equal(an.doublons.length, 1);

const source = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-titres-test-'));
let server, base, sortie = '';
(async () => {
  try {
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {').replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);
    server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '1', OASIS_ADMIN_MDP: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((ok, ko) => { server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); }); server.stderr.on('data', c => { sortie += c; }); server.on('exit', c => ko(Error('arrêt ' + c + sortie))); });
    const api = async (route, jeton, corps) => { const r = await fetch(base + '/api' + route, { method: corps ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: corps ? JSON.stringify(corps) : undefined }); return { code: r.status, data: await r.json().catch(() => ({})) }; };
    const admin = (await api('/connexion', null, { email: 'admin@oasis.ht', motDePasse: 'admin123' })).data.jeton;
    const emma = (await api('/connexion', null, { email: 'emma@oasis.ht', motDePasse: 'demo123' })).data.jeton;
    const livre = (await api('/livres', admin, { titre: 'LES CONTES DE HAÏTI (French)', auteur: 'Test', categorie: 'Littérature', contenu: 'x' })).data;
    assert.equal((await api('/titres/corrections', emma)).code, 403);
    assert.equal((await api('/titres/corrections', emma, { corrections: [{ id: livre.id, titre: 'Piraté' }] })).code, 403);
    const an = (await api('/titres/corrections', admin)).data;
    const prop = an.corrections.find(c => c.id === livre.id);
    assert.equal(prop.propose, 'Les contes de Haïti'); assert.ok(prop.raisons.includes('Titre en capitales'));
    const ap = (await api('/titres/corrections', admin, { corrections: [{ id: livre.id, titre: '  Les Contes   de Haïti ' }, { id: 'inexistant', titre: 'X' }] })).data;
    assert.equal(ap.modifies, 1);
    assert.equal((await api('/livres/' + livre.id, admin)).data.titre, 'Les Contes de Haïti');
    const lots = (await api('/titres/lots', admin)).data; assert.equal(lots[0].nombre, 1);
    assert.equal((await api('/titres/annuler', admin, { lot: ap.lot })).data.restaures, 1);
    assert.equal((await api('/livres/' + livre.id, admin)).data.titre, 'LES CONTES DE HAÏTI (French)');
    assert.equal((await api('/titres/annuler', admin, { lot: ap.lot })).code, 409);
    console.log('Titres 1.28.0 : capitales, encodage, mentions d’import, auteur répété, fichiers, HTML, validation, droits, application et annulation vérifiés.');
  } catch (e) { console.error(e); console.error(sortie.slice(-1500)); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const f = new Promise(r => server.once('exit', r)); server.kill(); await f; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
