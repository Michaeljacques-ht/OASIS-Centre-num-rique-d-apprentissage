// 1.24.0 : confirmation de l'adresse email à l'inscription (mode test OASIS_EMAIL_JOURNAL=1)
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');

const source = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-courriel-test-'));
let server, base, sortie = '';

async function demarrer() {
  server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '1', OASIS_ADMIN_MDP: '', OASIS_EMAIL_JOURNAL: '1', SITE_URL: 'https://oasis.test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((ok, ko) => {
    server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); });
    server.stderr.on('data', c => { sortie += c; });
    server.on('error', ko); server.on('exit', code => ko(Error('Arrêt du serveur ' + code + '\n' + sortie)));
  });
}
const api = async (route, corps) => {
  const r = await fetch(base + '/api' + route, { method: corps ? 'POST' : 'GET', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined });
  return { code: r.status, location: r.headers.get('location'), data: await r.json().catch(() => ({})) };
};
const dernierLien = () => { const m = [...sortie.matchAll(/EMAIL_TEST:(.*)/g)].pop(); assert(m, 'aucun email capturé'); const e = JSON.parse(m[1]); return { email: e, lien: e.texte.match(/https:\/\/oasis\.test(\/api\/confirmer-email\?jeton=[a-f0-9]+)/)[1] }; };

(async () => {
  try {
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {')
      .replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);
    await demarrer();

    const compte = { nom: 'Lectrice Test', email: 'lectrice@test.ht', motDePasse: 'secret123', profilAbonnement: 'etudiant', etablissement: 'Université test', matricule: 'T-1' };
    const ins = await api('/inscription', compte);
    assert.equal(ins.code, 201); assert.equal(ins.data.aConfirmer, true); assert.equal(ins.data.jeton, undefined);
    const { email, lien } = dernierLien();
    assert.equal(email.a, 'lectrice@test.ht'); assert.match(email.sujet, /Activez votre compte/);

    const avant = await api('/connexion', { email: compte.email, motDePasse: compte.motDePasse });
    assert.equal(avant.code, 403); assert.equal(avant.data.emailNonConfirme, true);
    assert.equal((await api('/renvoyer-confirmation', { email: compte.email })).code, 429);
    assert.equal((await api('/renvoyer-confirmation', { email: 'inconnu@test.ht' })).code, 200);

    const mauvais = await api('/confirmer-email?jeton=' + 'a'.repeat(48));
    assert.equal(mauvais.code, 302); assert.equal(mauvais.location, '/?compte=lien-invalide');
    const ok = await api(lien.replace('/api', ''));
    assert.equal(ok.code, 302); assert.equal(ok.location, '/?compte=confirme');
    assert.equal((await api(lien.replace('/api', ''))).location, '/?compte=lien-invalide');

    const apres = await api('/connexion', { email: compte.email, motDePasse: compte.motDePasse });
    assert.equal(apres.code, 200); assert.ok(apres.data.jeton);
    assert.equal((await api('/connexion', { email: 'emma@oasis.ht', motDePasse: 'demo123' })).code, 200);
    console.log('Courriel 1.24.0 : inscription en attente, email de confirmation, blocage avant activation, renvoi limité, lien unique et activation vérifiés.');
  } catch (e) { console.error(e); console.error(sortie.slice(-2000)); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const fin = new Promise(r => server.once('exit', r)); server.kill(); await fin; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
