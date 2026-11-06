// 1.25.0 : annonces défilantes et partenaires supporteurs
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');

const source = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-vitrine-test-'));
let server, base, sortie = '';

async function demarrer() {
  server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '1', OASIS_ADMIN_MDP: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((ok, ko) => {
    server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); });
    server.stderr.on('data', c => { sortie += c; });
    server.on('error', ko); server.on('exit', code => ko(Error('Arrêt du serveur ' + code + '\n' + sortie)));
  });
}
const req = async (route, jeton, method = 'GET', corps, type = 'application/json') => {
  const r = await fetch(base + '/api' + route, { method, headers: { 'Content-Type': type, ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: corps === undefined ? undefined : type === 'application/json' ? JSON.stringify(corps) : corps });
  return { code: r.status, type: r.headers.get('content-type'), data: type === 'application/json' ? await r.json().catch(() => ({})) : null, r };
};
const jetonDe = async (email, motDePasse) => (await req('/connexion', null, 'POST', { email, motDePasse })).data.jeton;

(async () => {
  try {
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {')
      .replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);
    await demarrer();
    const adm = await jetonDe('admin@oasis.ht', 'admin123'), lecteur = await jetonDe('emma@oasis.ht', 'demo123');

    // Annonces
    assert.equal((await req('/annonces', lecteur, 'POST', { texte: 'Interdit' })).code, 403);
    assert.equal((await req('/annonces', adm, 'POST', { texte: '' })).code, 400);
    assert.equal((await req('/annonces', adm, 'POST', { texte: 'Lien piégé', lien: 'javascript:alert(1)' })).code, 400);
    const a1 = await req('/annonces', adm, 'POST', { texte: 'Nouveaux livres en créole', type: 'nouveaute', lien: 'https://exemple.ht/' });
    assert.equal(a1.code, 201);
    await req('/annonces', adm, 'POST', { texte: 'Annonce future', debut: new Date(Date.now() + 5 * 86400000).toISOString() });
    await req('/annonces', adm, 'POST', { texte: 'Annonce expirée', fin: '2001-01-01' });
    const publiques = (await req('/annonces')).data;
    assert.deepEqual(publiques.map(a => a.texte), ['Nouveaux livres en créole']); assert.equal(publiques[0].icone, '✨');
    assert.equal((await req('/annonces?tous=1', lecteur)).code, 403);
    assert.equal((await req('/annonces?tous=1', adm)).data.length, 3);
    assert.equal((await req('/annonces/' + a1.data.id, adm, 'PUT', { actif: false })).code, 200);
    assert.equal((await req('/annonces')).data.length, 0);
    assert.equal((await req('/annonces/' + a1.data.id, adm, 'DELETE')).code, 200);

    // Partenaires
    assert.equal((await req('/partenaires', lecteur, 'POST', { nom: 'Intrus' })).code, 403);
    assert.equal((await req('/partenaires', adm, 'POST', { nom: 'Banque test', site: 'ftp://x' })).code, 400);
    const p1 = await req('/partenaires', adm, 'POST', { nom: 'Librairie Lumière', niveau: 'or', slogan: 'Des livres pour tous', offre: '-10 % pour les membres OASIS', site: 'https://librairie.ht', telephone: '+509 3700-0000', whatsapp: '+50937000000', email: 'contact@librairie.ht' });
    assert.equal(p1.code, 201);
    const p2 = await req('/partenaires', adm, 'POST', { nom: 'Café du coin', niveau: 'bronze' });
    await req('/partenaires', adm, 'POST', { nom: 'Masqué', actif: false });
    const liste = (await req('/partenaires')).data;
    assert.deepEqual(liste.map(p => p.nom), ['Librairie Lumière', 'Café du coin']); assert.equal(liste[0].niveauNom, 'Partenaire Or'); assert.equal(liste[0].clics, undefined);
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    assert.equal((await req('/partenaires/' + p1.data.id + '/logo', adm, 'POST', Buffer.from('pas une image'), 'image/png')).code, 400);
    assert.equal((await req('/partenaires/' + p1.data.id + '/logo', lecteur, 'POST', png, 'image/png')).code, 403);
    assert.equal((await req('/partenaires/' + p1.data.id + '/logo', adm, 'POST', png, 'image/png')).code, 201);
    const logo = await fetch(base + '/api/partenaires/' + p1.data.id + '/logo'); assert.equal(logo.status, 200); assert.equal(logo.headers.get('content-type'), 'image/png');
    assert.equal((await req('/partenaires/' + p1.data.id + '/clic', null, 'POST', {})).code, 200);
    await req('/partenaires/' + p1.data.id + '/clic', null, 'POST', {});
    const gestion = (await req('/partenaires?tous=1', adm)).data;
    assert.equal(gestion.find(p => p.id === p1.data.id).clics, 1); assert.equal(gestion.length, 3);
    assert.equal((await req('/partenaires/' + p2.data.id, adm, 'DELETE')).code, 200);
    assert.equal((await req('/partenaires')).data.length, 1);
    console.log('Vitrine 1.25.0 : annonces (droits, liens sûrs, dates, activation), partenaires (niveaux, ordre, logo, contacts, visites, masquage) vérifiés.');
  } catch (e) { console.error(e); console.error(sortie.slice(-2000)); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const fin = new Promise(r => server.once('exit', r)); server.kill(); await fin; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
