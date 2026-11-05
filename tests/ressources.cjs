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

    // 1.14.1 : limite du catalogue, couverture JPEG, vignette et cache long
    assert.equal((await api('/livres?tri=nouveautes&limite=3', null)).data.length, 3);
    const livre = (await api('/livres?limite=1', adm)).data[0];
    const jpeg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(200)]);
    assert.equal((await api('/livres/' + livre.id + '/vignette', adm, 'POST', jpeg, 'image/jpeg')).code, 400);   // pas encore de couverture
    assert.equal((await api('/livres/' + livre.id + '/couverture', adm, 'POST', jpeg, 'image/jpeg')).code, 201);
    assert.equal((await api('/livres/' + livre.id + '/vignette', lecteur, 'POST', jpeg, 'image/jpeg')).code, 403);
    assert.equal((await api('/livres/' + livre.id + '/vignette', adm, 'POST', Buffer.from('png?'), 'image/jpeg')).code, 400);
    const petite = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]), Buffer.alloc(50)]);
    assert.equal((await api('/livres/' + livre.id + '/vignette', adm, 'POST', petite, 'image/jpeg')).code, 201);
    const vue = (await api('/livres/' + livre.id, adm)).data;
    assert.equal(vue.vignette, true); assert.ok(vue.couvertureV > 1);
    const v = await api('/livres/' + livre.id + '/couverture?v=' + vue.couvertureV + '&taille=vignette', null);
    assert.deepEqual(v.data, petite); assert.match(v.headers.get('cache-control'), /max-age=2592000/);
    assert.deepEqual((await api('/livres/' + livre.id + '/couverture?v=' + vue.couvertureV, null)).data, jpeg);
    await api('/livres/' + livre.id + '/couverture', adm, 'POST', jpeg, 'image/jpeg');   // nouvelle couverture : vignette périmée retirée
    assert.equal((await api('/livres/' + livre.id, adm)).data.vignette, false);

    // 1.14.2 : pages servies par le serveur, cache commun et invalidation immédiate
    const tous = (await api('/livres', null)).data;
    const pg = (await api('/livres?format=page&parPage=2&page=1', null)).data;
    assert.equal(pg.total, tous.length); assert.equal(pg.livres.length, 2); assert.equal(pg.livres[0].id, tous[2].id); assert.ok(pg.facettes.categorie.length);
    const cat = tous[0].categorie;
    assert.equal((await api('/livres?format=page&categorie=' + encodeURIComponent(cat), null)).data.total, tous.filter(l => l.categorie === cat).length);
    const cible = tous[0];
    assert.equal((await api('/livres/' + cible.id, adm, 'PUT', { titre: 'Titre changé 1.14.2' })).code, 200);
    assert.ok((await api('/livres?format=page&q=' + encodeURIComponent('changé 1.14.2'), null)).data.livres.some(l => l.id === cible.id));   // visible tout de suite
    await api('/favoris/' + cible.id, lecteur, 'POST');
    const fav = id => api('/livres?format=page&q=' + encodeURIComponent('changé 1.14.2'), id).then(r => r.data.livres[0].favori);
    assert.equal(await fav(lecteur), true); assert.equal(await fav(adm), false); assert.equal(await fav(null), false);

    // 1.15.0 : import depuis une adresse web — protections
    const cibleUrl = (await api('/livres?limite=1', adm)).data[0].id;
    assert.equal((await api('/livres/' + cibleUrl + '/importer-url', lecteur, 'POST', { url: 'https://exemple.ht/a.pdf' })).code, 403);
    assert.match((await api('/livres/' + cibleUrl + '/importer-url', adm, 'POST', { url: 'http://exemple.ht/a.pdf' })).data.erreur, /https/);
    assert.match((await api('/livres/' + cibleUrl + '/importer-url', adm, 'POST', { url: 'https://127.0.0.1/a.pdf' })).data.erreur, /privée/);
    assert.match((await api('/livres/' + cibleUrl + '/importer-url', adm, 'POST', { url: 'https://localhost/a.pdf' })).data.erreur, /privée|impossible/);
    const ImportUrl = require('../modules/import-url');
    for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1']) assert.equal(ImportUrl.adressePrivee(ip), true);
    assert.equal(ImportUrl.nature(Buffer.from('%PDF-1.7')), 'pdf'); assert.equal(ImportUrl.nature(Buffer.from('<html>')), '');

    // 1.16.0 : cartothèque — import d'une carte par adresse web
    assert.equal(ImportUrl.nature(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A])), 'png');
    assert.equal(ImportUrl.nature(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])), 'jpeg');
    const carte = (await api('/medias', adm, 'POST', { type: 'carte', titre: 'Carte test 1.16' })).data;
    const son = (await api('/medias', adm, 'POST', { type: 'audio', titre: 'Son test 1.16' })).data;
    assert.equal((await api('/medias/' + carte.id + '/importer-url', lecteur, 'POST', { url: 'https://exemple.ht/c.png' })).code, 403);
    assert.match((await api('/medias/' + son.id + '/importer-url', adm, 'POST', { url: 'http://exemple.ht/c.mp3' })).data.erreur, /https/);
    assert.equal(ImportUrl.nature(Buffer.from('OggS\0\x02')), 'ogg');
    assert.equal(ImportUrl.nature(Buffer.from('ID3\x04\0')), 'mp3');
    assert.equal(ImportUrl.nature(Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A ')])), 'm4a');
    assert.match((await api('/medias/' + carte.id + '/importer-url', adm, 'POST', { url: 'http://exemple.ht/c.png' })).data.erreur, /https/);
    assert.match((await api('/medias/' + carte.id + '/importer-url', adm, 'POST', { url: 'https://10.0.0.5/c.png' })).data.erreur, /privée/);

    // 1.18.0 : vidéos YouTube intégrées
    const yt = await api('/medias', adm, 'POST', { type: 'video', titre: 'Vidéo YouTube test', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5' });
    assert.equal(yt.code, 201); assert.equal(yt.data.youtube, 'dQw4w9WgXcQ');
    assert.equal((await api('/medias', adm, 'POST', { type: 'video', titre: 'Doublon YouTube', youtube: 'https://youtu.be/dQw4w9WgXcQ' })).code, 409);
    assert.equal((await api('/medias', adm, 'POST', { type: 'video', titre: 'Mauvais lien', youtube: 'https://exemple.ht/watch?v=dQw4w9WgXcQ' })).code, 400);
    assert.equal((await api('/medias', adm, 'POST', { type: 'audio', titre: 'Audio YouTube', youtube: 'dQw4w9WgXcQ' })).code, 400);
    assert.equal((await api('/medias', lecteur, 'POST', { type: 'video', titre: 'Lecteur YouTube', youtube: 'abcdefghijk' })).code, 403);
    const v2 = (await api('/medias', adm, 'POST', { type: 'video', titre: 'Vidéo à lier' })).data;
    assert.equal((await api('/medias/' + v2.id + '/youtube', adm, 'POST', { youtube: 'https://www.youtube.com/embed/abcdefghijk' })).data.youtube, 'abcdefghijk');
    assert.ok((await api('/medias?type=video', lecteur)).data.some(x => x.youtube === 'abcdefghijk'));

    console.log('Ressources 1.14-1.18 : vidéos YouTube ; cartes par adresse ; import par adresse protégé ; documents PDF et EPUB, catégorie, lecture, plages, restriction, suppression ; limite du catalogue, vignettes et cache des couvertures vérifiés.');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { if (server && server.exitCode === null) { const fin = new Promise(r => server.once('exit', r)); server.kill(); await fin; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
})();
