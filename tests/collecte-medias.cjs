// 1.33.0 : collecte des vidéos, podcasts, livres audio, cartes et ressources.
const assert = require('node:assert/strict');
const M = require('../modules/collecte-medias');
const K = require('../modules/collecte-catalogues');

assert.equal(M.licenceOk('Public domain'), true);
assert.equal(M.licenceOk('CC BY-SA 4.0'), true);
assert.equal(M.licenceOk('CC0'), true);
assert.equal(M.licenceOk('CC BY-NC 2.0'), false);
assert.equal(M.licenceOk('CC BY-ND 3.0'), false);
assert.equal(M.licenceOk(''), false);
assert.equal(M.duree('1:02:30'), '1 h 3 min');
assert.equal(M.duree('600'), '10 min');
assert.equal(M.cleUrl('https://www.persee.fr/'), M.cleUrl('https://persee.fr'));
assert.ok(K.CHAINES_YOUTUBE.length >= 20 && K.PODCASTS.length >= 5 && K.CATEGORIES_CARTES.length >= 10 && K.RESSOURCES.length >= 80);
for (const [genre, titre, lien] of K.RESSOURCES) { assert.ok(genre && titre, titre); assert.match(lien, /^https:\/\//, titre); }
assert.equal(new Set(K.RESSOURCES.map(r => M.cleUrl(r[2]))).size, K.RESSOURCES.length, 'ressources en double dans le catalogue');
for (const [, id] of K.CHAINES_YOUTUBE) assert.match(id, /^UC[\w-]{22}$/);

const rss = `<feed><entry><yt:videoId>AAAAAAAAAAA</yt:videoId><title>Un short #shorts</title><link rel="alternate" href="https://www.youtube.com/shorts/AAAAAAAAAAA"/><published>2026-10-01</published></entry>
<entry><yt:videoId>BBBBBBBBBBB</yt:videoId><title>La Révolution haïtienne &amp; ses héros</title><link rel="alternate" href="https://www.youtube.com/watch?v=BBBBBBBBBBB"/><published>2026-09-01T00:00:00</published><media:description>Cours d'histoire.</media:description></entry></feed>`;
const pod = `<rss><channel><item><title>Épisode 1 : Toussaint Louverture</title><enclosure url="http://media.radiofrance.fr/ep1.mp3" type="audio/mpeg"/><itunes:duration>3540</itunes:duration><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Une émission d'histoire.</p>]]></description></item></channel></rss>`;
const librivox = { books: [
  { id: '7', title: 'Fables choisies', language: 'French', authors: [{ first_name: 'Jean de', last_name: 'La Fontaine' }], genres: [{ name: 'Poetry' }], description: '<p>Fables.</p>', totaltime: '2:10:00',
    sections: [{ section_number: '1', title: 'Livre I', listen_url: 'http://archive.org/a.mp3', playtime: '1800' }, { section_number: '2', title: 'Livre II', listen_url: 'http://archive.org/b.mp3', playtime: '1900' }] },
  { id: '8', title: 'English book', language: 'English', sections: [{ listen_url: 'https://x/y.mp3' }] }] };
const commons = { query: { pages: {
  1: { title: 'File:Carte d Haiti 1760.jpg', imageinfo: [{ mime: 'image/jpeg', width: 3000, url: 'https://upload/x.jpg', thumburl: 'https://upload/thumb/1920px-x.jpg', extmetadata: { LicenseShortName: { value: 'Public domain' }, Artist: { value: '<a>Bellin</a>' }, DateTimeOriginal: { value: '1760' }, ImageDescription: { value: 'Carte de Saint-Domingue' } } }] },
  2: { title: 'File:NC.jpg', imageinfo: [{ mime: 'image/jpeg', width: 3000, thumburl: 'https://upload/thumb/1920px-nc.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-NC 2.0' } } }] },
  3: { title: 'File:Petite.png', imageinfo: [{ mime: 'image/png', width: 300, thumburl: 'https://upload/thumb/1920px-p.png', extmetadata: { LicenseShortName: { value: 'CC0' } } }] } } } };

(async () => {
  const db = { medias: [], ressources: [{ id: 'r0', titre: 'Persée', lien: 'https://www.persee.fr/' }], categories: [{ nom: 'Histoire' }, { nom: 'Sciences' }], parametres: {} };
  const appels = [], vignettes = [], imports = [];
  const ctx = { db, sauverDB() {}, uid: () => 'id' + Math.random().toString(16).slice(2, 10), maintenant: () => new Date().toISOString(), pause: 0,
    fetch: async url => { appels.push(url);
      const ok = (corps) => ({ ok: true, text: async () => corps, json: async () => corps });
      if (url.includes('youtube.com/feeds')) return url.includes(K.CHAINES_YOUTUBE[0][1]) ? ok(rss) : { ok: false, status: 404 };
      if (url.includes('librivox.org')) return ok(librivox);
      if (url.includes('commons.wikimedia.org')) return ok(commons);
      if (url === K.PODCASTS[0][1]) return ok(pod);
      return { ok: false, status: 404 }; },
    importerFichierMedia: async (mo, url) => { imports.push(url); mo.ext = '.jpg'; mo.mime = 'image/jpeg'; },
    telechargerVignette: async (mo, url) => { vignettes.push(url); mo.vignette = true; } };
  const col = M.creer(ctx);

  // Vidéos : le short est ignoré, la vraie vidéo est ajoutée en lecture intégrée
  let r = await col.passage({ force: 'videos' });
  assert.equal(r.videos, 1, JSON.stringify(col.etat().historique));
  const v = db.medias.find(m => m.type === 'video');
  assert.equal(v.youtube, 'BBBBBBBBBBB'); assert.equal(v.titre, 'La Révolution haïtienne & ses héros'); assert.equal(v.auteur, K.CHAINES_YOUTUBE[0][0]); assert.equal(v.annee, 2026);

  // Podcasts : écoute en continu, adresse https, pas de téléchargement
  r = await col.passage({ force: 'podcasts' });
  assert.equal(r.podcasts, 1);
  const p = db.medias.find(m => m.podcast);
  assert.equal(p.pistes[0].url, 'https://media.radiofrance.fr/ep1.mp3'); assert.equal(p.telechargementAutorise, false); assert.equal(p.duree, '59 min');
  assert.match(p.description, /^Une émission d'histoire\./);

  // Livres audio : seulement en français, parties en https
  r = await col.passage({ force: 'livresAudio' });
  assert.equal(r.livresAudio, 1);
  const la = db.medias.find(m => m.livreAudio);
  assert.equal(la.auteur, 'Jean de La Fontaine'); assert.equal(la.pistes.length, 2); assert.ok(la.pistes.every(x => x.url.startsWith('https://')));
  assert.equal(db.medias.filter(m => m.livreAudio).length, 1, 'livre anglais refusé');

  // Cartes : licence et taille vérifiées, fichier importé et vignette 330 px créée tout de suite
  r = await col.passage({ force: 'cartes' });
  assert.equal(r.cartes, 1);
  const c = db.medias.find(m => m.type === 'carte');
  assert.equal(c.titre, 'Carte d Haiti 1760'); assert.equal(c.annee, 1760); assert.equal(c.auteur, 'Bellin');
  assert.deepEqual(imports, ['https://upload/thumb/1920px-x.jpg']); assert.deepEqual(vignettes, ['https://upload/thumb/330px-x.jpg']); assert.equal(c.vignette, true);

  // Ressources : Persée déjà présente n'est pas ajoutée deux fois
  r = await col.passage({ force: 'ressources' });
  assert.equal(r.ressources, 3);
  assert.equal(db.ressources.filter(x => M.cleUrl(x.lien) === M.cleUrl('https://www.persee.fr/')).length, 1);
  assert.ok(db.ressources.slice(1).every(x => x.collecteAuto && x.genre && x.icone));

  // Une carte dont l'import échoue est retirée et notée
  const db2 = { medias: [], ressources: [], categories: [], parametres: {} };
  const col2 = M.creer({ ...ctx, db: db2, importerFichierMedia: async () => { throw new Error('Image trop lourde'); } });
  await col2.passage({ force: 'cartes' });
  assert.equal(db2.medias.length, 0); assert.ok(col2.etat().historique.some(h => h.statut === 'echec' && /trop lourde/.test(h.message)));

  // Collecte suspendue : rien sans lancement manuel
  col.reglages().actif = false;
  assert.deepEqual(await col.passage(), { inactif: true });

  // Routes : réservées au bibliothécaire, quotas bornés
  const rep = []; const json = (res, code, corps) => rep.push([code, corps]);
  const fauxReq = (method, url, corps) => [{ method, url }, {}, { utilisateur: corps?.u, json, lireCorps: async () => corps?.b || {}, journal() {} }];
  let [a, b, o] = fauxReq('GET', '/api/collecte/medias', { u: { role: 'lecteur' } }); await col.route(a, b, o); assert.equal(rep.pop()[0], 403);
  [a, b, o] = fauxReq('PUT', '/api/collecte/medias', { u: { role: 'bibliothecaire' }, b: { actif: true, quotas: { videos: 30, cartes: 9999 } } }); await col.route(a, b, o);
  const [code, etat] = rep.pop(); assert.equal(code, 200); assert.equal(etat.reglages.quotas.videos, 30); assert.equal(etat.reglages.quotas.cartes, 10); assert.equal(etat.compte.cartes, 1);
  [a, b, o] = fauxReq('POST', '/api/collecte/medias/lancer', { u: { role: 'bibliothecaire' }, b: { type: 'inconnu' } }); await col.route(a, b, o); assert.equal(rep.pop()[0], 400);
  assert.equal(await col.route({ method: 'GET', url: '/api/collecte' }, {}, { json }), false);
  // 1.33.1 : les flux lus restent en mémoire, la base reste légère ; la collecte attend si le serveur est occupé
  assert.equal(db.collecteMedias.curseurs.videos.cache, undefined); assert.equal(db.collecteMedias.curseurs.podcasts.cache, undefined);
  assert.ok(JSON.stringify(db.collecteMedias).length < 20000, 'état de collecte trop lourd');
  const dbAncien = { medias: [], ressources: [], categories: [], parametres: {}, collecteMedias: { curseurs: { podcasts: { i: 2, cache: { x: { t: 1, items: new Array(500).fill({ description: 'x'.repeat(2000) }) } } } } } };
  const col3 = M.creer({ ...ctx, db: dbAncien, occupe: () => true });
  col3.etat(); assert.equal(dbAncien.collecteMedias.curseurs.podcasts.cache, undefined, 'ancien cache purgé'); assert.equal(dbAncien.collecteMedias.curseurs.podcasts.i, 2);
  assert.deepEqual(await col3.passage(), { reporte: true });
  assert.equal((await col3.passage({ force: 'ressources' })).ressources, 3, 'un lancement manuel passe toujours');
  console.log('collecte-medias : OK');
})().catch(e => { console.error(e); process.exit(1); });
