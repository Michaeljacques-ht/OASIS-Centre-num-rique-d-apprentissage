// 1.14.0 : document PDF ou EPUB joint à une ressource documentaire, catégorie, restriction et suppression.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');

const source = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-ressources-test-'));
let server, base, sortie = '';

async function demarrer() {
  server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '1', OASIS_ADMIN_MDP: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((ok, ko) => {
    server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); });
    server.stderr.on('data', c => { sortie += c; });
    server.on('error', ko); server.on('exit', code => ko(Error('Arrêt du serveur ' + code + '\n' + sortie)));
  });
  await new Promise(r => setTimeout(r, 400));
}
async function api(route, jeton, method = 'GET', corps, type = 'application/json') {
  const r = await fetch(base + '/api' + route, { method, headers: { 'Content-Type': type, ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: corps === undefined ? undefined : type === 'application/json' ? JSON.stringify(corps) : corps });
  const brut = Buffer.from(await r.arrayBuffer()); let data; try { data = JSON.parse(brut.toString()); } catch { data = brut; }
  return { code: r.status, data, headers: r.headers };
}
const jetonDe = async (email, motDePasse) => (await api('/connexion', null, 'POST', { email, motDePasse })).data.jeton;

(async () => {
  try {
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {')
      .replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);
    await demarrer();
    const adm = await jetonDe('admin@oasis.ht', 'admin123');
    const lecteur = await jetonDe('emma@oasis.ht', 'demo123');
    assert.ok(adm && lecteur);

    // Catégorie (thème) : connue acceptée, inconnue refusée
    assert.equal((await api('/ressources', adm, 'POST', { genre: 'officiel', titre: 'X', contenu: 'Y', categorie: 'Inexistante' })).code, 400);
    const r = (await api('/ressources', adm, 'POST', { genre: 'officiel', titre: 'Constitution 1987', contenu: 'Texte officiel.', categorie: 'Histoire' })).data;
    assert.equal(r.categorie, 'Histoire'); assert.equal(r.fichier, '');

    // Fichier invalide refusé ; PDF accepté ; EPUB accepté en remplacement
    assert.equal((await api('/ressources/' + r.id + '/fichier', adm, 'POST', Buffer.from('pas un pdf'), 'application/pdf')).code, 400);
    assert.equal((await api('/ressources/' + r.id + '/fichier', lecteur, 'POST', Buffer.from('%PDF-1.4 test'), 'application/pdf')).code, 403);
    const pdf = Buffer.from('%PDF-1.4\n% test OASIS\n%%EOF');
    const envoi = await api('/ressources/' + r.id + '/fichier?nom=constitution.pdf', adm, 'POST', pdf, 'application/pdf');
    assert.equal(envoi.code, 201); assert.equal(envoi.data.fichier, 'pdf');
    let liste = (await api('/ressources', lecteur)).data;
    assert.equal(liste.find(x => x.id === r.id).fichier, 'pdf');

    // Lecture par un lecteur connecté ; anonyme refusé ; plage d'octets
    assert.equal((await api('/ressources/' + r.id + '/fichier?lecture=1', null)).code, 401);
    const lu = await api('/ressources/' + r.id + '/fichier?lecture=1', lecteur);
    assert.equal(lu.code, 200); assert.equal(lu.headers.get('content-type'), 'application/pdf'); assert.deepEqual(lu.data, pdf);
    const plage = await fetch(base + '/api/ressources/' + r.id + '/fichier?lecture=1', { headers: { Authorization: 'Bearer ' + lecteur, Range: 'bytes=0-4' } });
    assert.equal(plage.status, 206); assert.equal(Buffer.from(await plage.arrayBuffer()).toString(), '%PDF-');

    // Téléchargement restreint : consultation seule
    assert.equal((await api('/ressources/' + r.id + '/telechargement', adm, 'PUT', { autorise: false })).code, 200);
    assert.equal((await api('/ressources/' + r.id + '/fichier', lecteur)).code, 403);
    assert.equal((await api('/ressources/' + r.id + '/fichier?lecture=1', lecteur)).code, 200);

    // EPUB (mimetype en tête du zip) remplace le PDF
    const epub = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.alloc(26), Buffer.from('mimetypeapplication/epub+zip'), Buffer.alloc(40)]);
    assert.equal((await api('/ressources/' + r.id + '/fichier', adm, 'POST', epub, 'application/epub+zip')).data.fichier, 'epub');
    const dossier = path.join(temp, 'data', 'ressources-docs');
    assert.deepEqual(fs.readdirSync(dossier), [r.id + '.epub']);

    // Retrait du document puis suppression de la ressource
    assert.equal((await api('/ressources/' + r.id + '/fichier', adm, 'DELETE')).code, 200);
    assert.deepEqual(fs.readdirSync(dossier), []);
    await api('/ressources/' + r.id + '/fichier', adm, 'POST', pdf, 'application/pdf');
    assert.equal((await api('/ressources/' + r.id, adm, 'DELETE')).code, 200);
    assert.deepEqual(fs.readdirSync(dossier), []);

    console.log('Ressources 1.14.0 : documents PDF et EPUB, catégorie, lecture, plages, restriction, retrait et suppression vérifiés.');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const fin = new Promise(r => server.once('exit', r)); server.kill(); await fin; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
