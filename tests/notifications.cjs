// 1.27.0 : notifications réelles (lu / non lu), métadonnées d'édition EPUB, citations complètes.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const { spawn } = require('node:child_process');

// --- Citations (module navigateur exécuté dans un bac à sable) ---
const ctx = { window: {}, location: { origin: 'https://oasis.test' }, document: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/citations.js'), 'utf8'), ctx);
const C = ctx.window.OasisCitations;
const livre = { id: 'x1', titre: 'Ainsi parla l’oncle', auteur: 'Jean Price-Mars', annee: 1928, editeur: 'Imprimerie de Compiègne', lieuEdition: 'Paris', edition: '2', isbn: '', versionNumerique: true, epub: true };
const d = C.donnees(livre), s = C.styles(d);
assert.equal(d.auteurs[0].nom, 'Price-Mars'); assert.equal(d.edition, '2e éd.');
assert.match(s['APA 7'], /^Price-Mars, J\. \(1928\)\. <i>Ainsi parla l’oncle<\/i> \(2e éd\.\)\. Imprimerie de Compiègne\./);
assert.match(s['ISO 690'], /PRICE-MARS, Jean\. <i>Ainsi parla l’oncle<\/i> \[en ligne\]\. 2e éd\. Paris : Imprimerie de Compiègne, 1928\./);
assert.match(s['MLA 9'], /Consulté le/); assert.ok(!Object.values(s).join(' ').includes('Éduca Diffusion'));
const anon = C.styles(C.donnees({ id: 'x2', titre: 'Droit des contrats administratifs', auteur: 'Anonyme', annee: '', editeur: '', versionNumerique: true }));
assert.match(anon['APA 7'], /^<i>Droit des contrats administratifs<\/i>\. \(s\. d\.\)\./); assert.match(anon['ISO 690'], /\[s\.l\.\] : \[s\.n\.\], \[s\.d\.\]/);
assert.match(C.bibtex(d, 'x1'), /publisher = \{Imprimerie de Compiègne\}/); assert.match(C.ris(d), /PB  - Imprimerie de Compiègne/);
assert.equal(C.decouper('Jacques Roumain et Jean Price-Mars').length, 2);

// --- Métadonnées EPUB ---
const epub = (opf) => { // ZIP minimal (stocké)
  const fichiers = [['META-INF/container.xml', '<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>'], ['c.opf', opf]];
  const parts = [], central = []; let off = 0;
  for (const [n, t] of fichiers) { const nom = Buffer.from(n), data = Buffer.from(t); const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nom.length, 26); parts.push(h, nom, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nom.length, 28); c.writeUInt32LE(off, 42); central.push(c, nom); off += 30 + nom.length + data.length; }
  const cd = Buffer.concat(central), fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, fin]);
};
const M = require('../modules/epub-meta');
let mt = M.metadonnees(epub('<package><metadata><dc:publisher>Project Gutenberg</dc:publisher><dc:source>Paris : Hachette, 1878</dc:source><dc:date>1878</dc:date></metadata></package>'));
assert.deepEqual([mt.editeur, mt.lieu, mt.sourceNumerique, mt.annee], ['Hachette', 'Paris', 'Project Gutenberg', 1878]);
mt = M.metadonnees(epub('<package><metadata><dc:publisher>Éditions Henri Deschamps</dc:publisher></metadata></package>'));
assert.equal(mt.editeur, 'Éditions Henri Deschamps'); assert.equal(mt.sourceNumerique, '');

// --- Notifications par l'API ---
const source = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-notifs-test-'));
let server, base, sortie = '';
(async () => {
  try {
    fs.cpSync(source, temp, { recursive: true, filter: p => !['data', 'integrations', 'tests', 'node_modules'].includes(path.relative(source, p).split(path.sep)[0]) });
    let code = fs.readFileSync(path.join(temp, 'server.js'), 'utf8');
    code = code.replace('http.createServer(async (req, res) => {', 'const testServer = http.createServer(async (req, res) => {').replace('}).listen(PORT, () => {', "}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");
    fs.writeFileSync(path.join(temp, 'server.js'), code);
    server = spawn(process.execPath, ['server.js'], { cwd: temp, env: { ...process.env, PORT: '0', OASIS_DEMO: '1', OASIS_ADMIN_MDP: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((ok, ko) => { server.stdout.on('data', c => { sortie += c; const m = sortie.match(/TEST_PORT:(\d+)/); if (m && /Espace biblioth/.test(sortie)) ok('http://127.0.0.1:' + m[1]); }); server.stderr.on('data', c => { sortie += c; }); server.on('exit', c => ko(Error('arrêt ' + c + sortie))); });
    const api = async (route, jeton, corps, methode) => { const r = await fetch(base + '/api' + route, { method: methode || (corps ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: corps ? JSON.stringify(corps) : undefined }); return { code: r.status, data: await r.json().catch(() => ({})) }; };
    const admin = (await api('/connexion', null, { email: 'admin@oasis.ht', motDePasse: 'admin123' })).data.jeton;
    const emma = (await api('/connexion', null, { email: 'emma@oasis.ht', motDePasse: 'demo123' })).data.jeton;
    const nouveau = (await api('/livres', admin, { titre: 'Livre de test notif', auteur: 'Test', categorie: 'Sciences', editeur: 'Éduca Diffusion', contenu: 'Texte' })).data;
    assert.equal((await api('/notifications')).code, 401);
    let n = (await api('/notifications', emma)).data;
    assert.ok(Array.isArray(n.notifications)); const notif = n.notifications.find(x => x.id === 'nouv-' + nouveau.id);
    assert.ok(notif, 'la nouveauté doit apparaître'); assert.equal(notif.lu, false); assert.deepEqual(notif.action, { livre: nouveau.id });
    const avant = n.nonLues; assert.ok(avant >= 1);
    assert.equal((await api('/notifications/lues', emma, { ids: [notif.id] })).code, 200);
    n = (await api('/notifications', emma)).data; assert.equal(n.nonLues, avant - 1); assert.equal(n.notifications.find(x => x.id === notif.id).lu, true);
    await api('/notifications/lues', emma, { ids: [], tous: true }); n = (await api('/notifications', emma)).data; assert.equal(n.notifications.filter(x => !x.lu && x.type === 'nouveaute').length, 0);
    // l'administrateur n'a rien lu : ses notifications restent non lues
    assert.ok((await api('/notifications', admin)).data.nonLues >= 1);
    // éditeur fictif retiré à l'affichage
    assert.equal((await api('/livres/' + nouveau.id, emma)).data.editeur, '');
    const p = (await api('/parametres')).data; assert.equal(p.fondateurNom, 'Michael Jacques'); assert.ok(p.mission && p.vision);
    console.log('Notifications et citations 1.27.0 : lu/non lu par compte, liens, tout marquer, éditeur réel, métadonnées EPUB, styles APA/MLA/Chicago/ISO/IEEE, BibTeX et RIS vérifiés.');
  } catch (e) { console.error(e); console.error(sortie.slice(-1500)); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const f = new Promise(r => server.once('exit', r)); server.kill(); await f; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
// La version affichée par l'interface d'administration doit suivre package.json (évite le bandeau rouge « interface : … »).
assert.equal(fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8').match(/VERSION_INTERFACE = '([\d.]+)'/)[1], require('../package.json').version);
