const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const { PDFDocument, StandardFonts } = require('../modules/pdf-lib');
const R = require('../modules/recherche-texte');

/* EPUB minimal (ZIP construit à la main) */
function zip(fichiers) {
  const locaux = [], centraux = []; let offset = 0;
  for (const [nom, contenu, compresser] of fichiers) {
    const data = Buffer.from(contenu), comp = compresser ? zlib.deflateRawSync(data) : data, n = Buffer.from(nom);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(compresser ? 8 : 0, 8); l.writeUInt32LE(comp.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(compresser ? 8 : 0, 10); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    locaux.push(l, n, comp); centraux.push(c, n); offset += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centraux), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locaux, cd, fin]);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-recherche-'));
  const pdfDir = path.join(dir, 'pdfs'); fs.mkdirSync(pdfDir);
  const cheminPdf = id => path.join(pdfDir, id + '.pdf'), cheminEpub = id => path.join(pdfDir, id + '.epub');

  // PDF de 3 pages (le texte de la page 2 parle de la réforme Bernard)
  const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  ['Introduction generale sur l ecole haitienne et son histoire depuis 1804.', 'La reforme Bernard de 1979 introduit le creole a l ecole fondamentale.', 'Conclusion : perspectives pour l education.']
    .forEach(t => pdf.addPage([600, 400]).drawText(t, { x: 30, y: 300, size: 12, font }));
  fs.writeFileSync(cheminPdf('p1'), await pdf.save());
  // PDF « scanné » : pages sans texte
  const scan = await PDFDocument.create(); scan.addPage(); scan.addPage(); fs.writeFileSync(cheminPdf('scan'), await scan.save());
  // EPUB : 2 chapitres, le second compressé, entités HTML
  fs.writeFileSync(cheminEpub('e1'), zip([
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ['OEBPS/content.opf', '<package><manifest><item id="c1" href="ch1.xhtml"/><item id="c2" href="texte/ch2.xhtml"/><item id="nav" href="nav.xhtml"/></manifest><spine><itemref idref="c1"/><itemref idref="nav" linear="no"/><itemref idref="c2"/></spine></package>'],
    ['OEBPS/ch1.xhtml', '<html><head><style>p{}</style></head><body><p>Manuel revient de Cuba.</p></body></html>'],
    ['OEBPS/nav.xhtml', '<html><body>Table des matières réforme</body></html>'],
    ['OEBPS/texte/ch2.xhtml', '<html><body><p>Il cherche l&#8217;eau pour Fonds-Rouge &amp; ses habitants. La r&eacute;forme agraire.</p></body></html>', true]
  ]));

  const db = { livres: [
    { id: 'p1', titre: 'Histoire de l’école', pdf: true },
    { id: 'e1', titre: 'Gouverneurs de la Rosée', epub: true },
    { id: 't1', titre: 'Le Petit Prince', contenu: 'On ne voit bien qu’avec le cœur. L’essentiel est invisible pour les yeux. '.repeat(60) + ' Le renard parle de la Réforme.' },
    { id: 'scan', titre: 'Archive scannée', pdf: true },
    { id: 'phys', titre: 'Livre physique seulement' }
  ] };

  await R.demarrer(db, { dossier: path.join(dir, 'textes'), cheminPdf, cheminEpub });
  const attendre = async () => { for (let i = 0; i < 200 && R.etat().enAttente; i++) await new Promise(r => setTimeout(r, 25)); };
  await attendre();
  const e = R.etat();
  assert.equal(e.indexes, 4, 'pdf, epub, texte et scan indexés'); assert.equal(e.sansTexte, 1, 'PDF scanné signalé'); assert.equal(e.erreurs, 0);

  // Insensible aux accents et à la casse ; pages exactes
  let r = R.rechercher('Réforme Bernard');
  assert.equal(r.resultats.length, 1); assert.equal(r.resultats[0].livreId, 'p1'); assert.equal(r.resultats[0].correspondances[0].page, 2); assert.equal(r.resultats[0].unite, 'page');
  const ex = r.resultats[0].correspondances[0];
  assert.match(ex.texte, /reforme Bernard/); assert.deepEqual(ex.surlignes.map(([a, l]) => ex.texte.slice(a, a + l)), ['reforme', 'Bernard']);

  // Préfixe et plusieurs formats ; chapitre non linéaire exclu ; numéro de chapitre = ordre de lecture
  r = R.rechercher('reform');
  const ids = r.resultats.map(x => x.livreId).sort(); assert.deepEqual(ids, ['e1', 'p1', 't1']);
  const epub = r.resultats.find(x => x.livreId === 'e1'); assert.equal(epub.unite, 'chapitre'); assert.equal(epub.correspondances[0].page, 2);
  assert(epub.correspondances[0].texte.includes('l’eau pour Fonds-Rouge & ses habitants'), 'entités décodées');
  const txt = r.resultats.find(x => x.livreId === 't1'); assert.equal(txt.unite, 'partie'); assert(txt.correspondances[0].page > 1);

  // Expression exacte entre guillemets
  assert.equal(R.rechercher('"ecole fondamentale"').resultats.length, 1);
  assert.equal(R.rechercher('"fondamentale ecole"').resultats.length, 0);
  // Mots vides seuls : aucun résultat, pas d'erreur
  assert.equal(R.rechercher('le la de').resultats.length, 0);
  // Tous les mots doivent figurer sur la même page
  assert.equal(R.rechercher('Bernard Conclusion').resultats.length, 0);
  assert.equal(R.rechercher('cœur invisible').resultats[0].livreId, 't1');

  // Modification du texte → réindexation ; suppression → retrait de l'index
  db.livres.find(l => l.id === 't1').contenu = 'Nouveau texte sur les volcans.';
  R.synchroniser(db); await attendre();
  assert.equal(R.rechercher('invisible').resultats.length, 0); assert.equal(R.rechercher('volcans').resultats[0].livreId, 't1');
  db.livres = db.livres.filter(l => l.id !== 'p1'); R.synchroniser(db);
  assert.equal(R.rechercher('Bernard').resultats.length, 0); assert(!fs.existsSync(path.join(dir, 'textes', 'p1.json')));

  // Redémarrage : l'index est reconstruit depuis les fichiers, sans réextraction
  const avant = fs.statSync(path.join(dir, 'textes', 'e1.json')).mtimeMs;
  R._interne.docs.clear(); R._interne.index.clear();
  await R.demarrer(db, { dossier: path.join(dir, 'textes'), cheminPdf, cheminEpub }); await attendre();
  assert.equal(R.rechercher('Fonds-Rouge').resultats[0].livreId, 'e1'); assert.equal(fs.statSync(path.join(dir, 'textes', 'e1.json')).mtimeMs, avant);

  // Routes : recherche publique, relevé des recherches sans résultat, administration réservée
  const appel = async (methode, url, u = null, corps = {}) => { let out; await R.route({ url, method: methode }, {}, { db, utilisateur: u, json: (_, code, data) => out = { code, data }, lireCorps: async () => corps, sauverDB: () => {} }); return out; };
  let rep = await appel('GET', '/api/recherche?q=Fonds-Rouge');
  assert.equal(rep.code, 200); assert.equal(rep.data.resultats[0].livre.titre, 'Gouverneurs de la Rosée');
  await appel('GET', '/api/recherche?q=refor&journal=1'); await appel('GET', '/api/recherche?q=xylophone%20haitien&journal=1'); await appel('GET', '/api/recherche?q=xylophone%20haitien&journal=1');
  assert.equal(db.recherchesSansResultat.length, 1, '« refor » trouve des livres : non relevé'); assert.equal(db.recherchesSansResultat[0].nb, 2);
  await appel('GET', '/api/recherche?q=Rosée&journal=1'); assert.equal(db.recherchesSansResultat.length, 1, 'trouvé dans le catalogue : non relevé');
  const admin = { id: 'a', role: 'bibliothecaire' };
  assert.equal((await appel('GET', '/api/admin-recherche', { id: 'b', role: 'apprenant' })).code, 403);
  rep = await appel('GET', '/api/admin-recherche', admin);
  assert.equal(rep.data.documents.find(d => d.id === 'scan').statut, 'sans_texte'); assert.equal(rep.data.documents.find(d => d.id === 'phys').statut, 'sans_fichier');
  assert.equal((await appel('POST', '/api/admin-recherche/reindexer', admin, { id: 'e1' })).code, 200); await attendre();
  assert(fs.statSync(path.join(dir, 'textes', 'e1.json')).mtimeMs >= avant);
  assert.equal((await appel('DELETE', '/api/admin-recherche/sans-resultat', admin)).code, 200); assert.equal(db.recherchesSansResultat.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Recherche plein texte : PDF, EPUB, texte, accents, expressions, pages, réindexation, PDF scanné et relevé vérifiés.');
})().catch(e => { console.error(e); process.exit(1); });
