'use strict';
/* ============================================================
   OASIS — Recherche dans le texte des livres (plein texte)

   - Extraction automatique, sans dépendance externe :
       PDF  → page par page avec le pdf.js déjà fourni (public/vendor/pdfjs)
       EPUB → chapitre par chapitre, dans l'ordre de lecture (spine)
       Texte intégré → parties de 2 500 caractères (comme l'aperçu)
   - Le texte extrait est rangé dans data/textes/<id>.json (hors db.json).
   - Index en mémoire : mot → livres qui le contiennent. Les pages exactes
     et les extraits sont calculés à la demande sur les livres candidats.
   - Les PDF scannés (sans texte) sont signalés : ils demandent un OCR.
   - Les recherches sans aucun résultat sont relevées pour l'administration.

   Routes :
     GET    /api/recherche?q=…                    (public)
     GET    /api/admin-recherche                  (administrateur principal)
     POST   /api/admin-recherche/reindexer        { id? }
     DELETE /api/admin-recherche/sans-resultat
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { principal } = require('./administration-comptes');

const LIMITES = { pagesPdf: 2000, caracteresPage: 20000, caracteresTotal: 12e6, taillePartie: 2500, cacheDocs: 12 };
const VERSION_EXTRACTION = 1;
const MOTS_VIDES = new Set(('le la les l un une des du de d et ou a au aux en dans sur pour par avec sans ce ces cet cette se sa son ses qui que quoi dont est sont ete etre il elle ils elles on nous vous je tu y ne pas plus ' +
  'the of and or to in on for is are an be by with as at it this that from ' +
  'li yo nan ak pou ki se te ap pa sa mwen ou nou yon')
  .split(' '));

let cfg = null;               // { dossier, cheminPdf, cheminEpub }
const docs = new Map();       // id → { num, id, signature, unite, nbPages, etat, erreur, extraitLe, sansTexte }
const parNum = [];            // num → id
const index = new Map();      // mot → number[] (numéros de documents)
const cache = new Map();      // id → { pages, norm } (LRU)
let file = [], enCours = null, minuteur = null, pret = false;

/* ---------- Normalisation (même longueur que le texte d'origine) ---------- */
const carCache = new Map();
function norm(s) {
  s = String(s || '');
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) { o += c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : s[i]; continue; }
    let r = carCache.get(c);
    if (r === undefined) {
      r = s[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()[0] || ' ';
      if (c === 0x2019 || c === 0x2018) r = "'";
      carCache.set(c, r);
    }
    o += r;
  }
  return o;
}
const RE_MOT = /[\p{L}\p{N}]+/gu;
const estLettre = ch => !!ch && /[\p{L}\p{N}]/u.test(ch);
const mots = (texteNorm) => texteNorm.match(RE_MOT) || [];

/* ---------- Lecture minimale d'un ZIP (EPUB) ---------- */
function zipEntrees(b) {
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw Error('EPUB illisible (archive ZIP invalide).');
  const entrees = new Map();
  let pos = b.readUInt32LE(fin + 16);
  for (let n = 0, total = b.readUInt16LE(fin + 10); n < total; n++) {
    if (pos + 46 > b.length || b.readUInt32LE(pos) !== 0x02014b50) break;
    const methode = b.readUInt16LE(pos + 10), compresse = b.readUInt32LE(pos + 20), taille = b.readUInt32LE(pos + 24);
    const lng = b.readUInt16LE(pos + 28), local = b.readUInt32LE(pos + 42);
    const nom = b.subarray(pos + 46, pos + 46 + lng).toString();
    entrees.set(nom, { methode, compresse, taille, local });
    pos += 46 + lng + b.readUInt16LE(pos + 30) + b.readUInt16LE(pos + 32);
  }
  const lire = (nom) => {
    const e = entrees.get(nom);
    if (!e) return null;
    if (e.taille > 8 * 1024 * 1024) throw Error('Chapitre EPUB trop volumineux.');
    const debut = e.local + 30 + b.readUInt16LE(e.local + 26) + b.readUInt16LE(e.local + 28);
    const brut = b.subarray(debut, debut + e.compresse);
    return (e.methode === 0 ? brut : zlib.inflateRawSync(brut, { maxOutputLength: 8 * 1024 * 1024 })).toString('utf8');
  };
  return { entrees, lire };
}
const attribut = (b, n) => { const m = String(b).match(new RegExp('\\b' + n + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i')); return m ? (m[1] ?? m[2]) : undefined; };
const resoudre = (base, href) => {
  const parts = (base.slice(0, base.lastIndexOf('/') + 1) + decodeURIComponent(String(href).split('#')[0])).split('/'), out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
};
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', hellip: '…', mdash: '—', ndash: '–', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô' };
const htmlVersTexte = (h) => String(h)
  .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|div|h[1-6]|li|tr|br|section|blockquote)>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITES[e.toLowerCase()] ?? m)
  .replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

function texteEpub(buffer) {
  const z = zipEntrees(buffer);
  const container = z.lire('META-INF/container.xml');
  const opfChemin = container && attribut((container.match(/<rootfile\b[^>]*>/i) || [''])[0], 'full-path');
  if (!opfChemin) throw Error('EPUB sans fichier de description (container.xml).');
  const opf = z.lire(opfChemin) || '';
  const items = new Map();
  for (const b of opf.match(/<item\b[^>]*>/gi) || []) items.set(attribut(b, 'id'), attribut(b, 'href'));
  const chapitres = (opf.match(/<itemref\b[^>]*>/gi) || []).filter(b => attribut(b, 'linear') !== 'no')
    .map(b => items.get(attribut(b, 'idref'))).filter(Boolean).map(h => resoudre(opfChemin, h));
  if (!chapitres.length) throw Error('EPUB sans chapitre lisible.');
  return chapitres.map(c => htmlVersTexte(z.lire(c) || '').slice(0, LIMITES.caracteresPage));
}

let pdfjs = null;
async function textePdf(buffer) {
  if (!pdfjs) {
    const dossier = path.join(__dirname, '..', 'public', 'vendor', 'pdfjs');
    pdfjs = require(path.join(dossier, 'pdf.min.js'));
    pdfjs.GlobalWorkerOptions.workerSrc = path.join(dossier, 'pdf.worker.min.js');
  }
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  } catch (e) {
    throw Error(/password/i.test(e.name + e.message) ? 'PDF protégé par mot de passe.' : 'PDF illisible : ' + e.message);
  }
  try {
    const pages = [];
    const n = Math.min(doc.numPages, LIMITES.pagesPdf);
    for (let i = 1; i <= n; i++) {
      const p = await doc.getPage(i);
      const t = await p.getTextContent();
      pages.push(t.items.map(x => (x.str || '') + (x.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim().slice(0, LIMITES.caracteresPage));
      p.cleanup();
      await new Promise(r => setImmediate(r));   // laisse le serveur répondre entre deux pages
    }
    return pages;
  } finally { doc.destroy(); }
}

/* ---------- Source et signature d'un livre ---------- */
function source(l) {
  try {
    if (l.pdf && fs.existsSync(cfg.cheminPdf(l.id))) { const s = fs.statSync(cfg.cheminPdf(l.id)); return { type: 'pdf', unite: 'page', signature: `v${VERSION_EXTRACTION}:pdf:${s.size}:${Math.round(s.mtimeMs)}` }; }
    if (l.epub && fs.existsSync(cfg.cheminEpub(l.id))) { const s = fs.statSync(cfg.cheminEpub(l.id)); return { type: 'epub', unite: 'chapitre', signature: `v${VERSION_EXTRACTION}:epub:${s.size}:${Math.round(s.mtimeMs)}` }; }
    if (l.contenu) return { type: 'texte', unite: 'partie', signature: `v${VERSION_EXTRACTION}:txt:` + crypto.createHash('sha1').update(String(l.contenu)).digest('hex') };
  } catch {}
  return null;
}
const fichierTexte = id => path.join(cfg.dossier, String(id).replace(/[^\w-]/g, '_') + '.json');

/* ---------- Index ---------- */
function indexer(id, pages) {
  let d = docs.get(id);
  let num = d?.num;
  if (num === undefined) { num = parNum.length; parNum.push(id); }
  const vus = new Set();
  for (const p of pages) for (const m of mots(norm(p))) if (m.length > 1 && !MOTS_VIDES.has(m)) vus.add(m);
  for (const m of vus) { let l = index.get(m); if (!l) index.set(m, l = []); l.push(num); }
  return num;
}
function retirerDeIndex(id) {
  const d = docs.get(id);
  if (!d || !d.indexe) return;
  for (const [m, l] of index) {
    const i = l.indexOf(d.num);
    if (i >= 0) { l.splice(i, 1); if (!l.length) index.delete(m); }
  }
  d.indexe = false;
  cache.delete(id);
}

function enregistrerDoc(id, donnees) {
  const ancien = docs.get(id);
  retirerDeIndex(id);
  cache.delete(id);
  const d = { id, num: ancien?.num, signature: donnees.signature, unite: donnees.unite, nbPages: donnees.pages.length,
    erreur: donnees.erreur || null, sansTexte: !!donnees.sansTexte, extraitLe: donnees.extraitLe, indexe: false };
  docs.set(id, d);
  if (!d.erreur && d.nbPages) { d.num = indexer(id, donnees.pages); d.indexe = true; }
  return d;
}

async function extraire(db, id) {
  const l = (db.livres || []).find(x => x.id === id);
  if (!l) return supprimer(id);
  const src = source(l);
  if (!src) return supprimer(id);
  let pages = [], erreur = null;
  try {
    if (src.type === 'pdf') pages = await textePdf(await fs.promises.readFile(cfg.cheminPdf(id)));
    else if (src.type === 'epub') pages = texteEpub(await fs.promises.readFile(cfg.cheminEpub(id)));
    else pages = String(l.contenu).match(new RegExp(`[\\s\\S]{1,${LIMITES.taillePartie}}`, 'g')) || [];
    let total = 0;
    pages = pages.map(p => { const reste = Math.max(0, LIMITES.caracteresTotal - total); total += p.length; return p.slice(0, reste); });
  } catch (e) { erreur = e.message; pages = []; }
  const utiles = pages.filter(p => p.replace(/\s/g, '').length >= 30).length;
  const sansTexte = !erreur && src.type === 'pdf' && pages.length > 0 && utiles / pages.length < 0.2;
  const donnees = { version: VERSION_EXTRACTION, id, signature: src.signature, unite: src.unite, type: src.type, pages, erreur, sansTexte, extraitLe: new Date().toISOString() };
  fs.mkdirSync(cfg.dossier, { recursive: true });
  const tmp = fichierTexte(id) + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(donnees));
  await fs.promises.rename(tmp, fichierTexte(id));
  enregistrerDoc(id, donnees);
}

function supprimer(id) {
  retirerDeIndex(id);
  docs.delete(id);
  try { fs.unlinkSync(fichierTexte(id)); } catch {}
}

/* ---------- File de travail (un document à la fois) ---------- */
function synchroniser(db) {
  if (!cfg || !pret) return;
  const ids = new Set((db.livres || []).map(l => l.id));
  for (const id of [...docs.keys()]) if (!ids.has(id)) supprimer(id);
  for (const l of db.livres || []) {
    const src = source(l), d = docs.get(l.id);
    if (!src) { if (d) supprimer(l.id); continue; }
    if ((!d || d.signature !== src.signature) && !file.includes(l.id) && enCours !== l.id) file.push(l.id);
  }
  traiter(db);
}
async function traiter(db) {
  if (enCours || !file.length) return;
  enCours = file.shift();
  try { await extraire(db, enCours); }
  catch (e) { console.warn('Indexation impossible :', enCours, e.message); }
  finally { enCours = null; setImmediate(() => traiter(db)); }
}
/** À appeler après toute modification du catalogue : regroupe les appels. */
function planifier(db, delai = 3000) {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => synchroniser(db), delai);
  minuteur.unref?.();
}

async function demarrer(db, options) {
  cfg = options;
  fs.mkdirSync(cfg.dossier, { recursive: true });
  const fichiers = (await fs.promises.readdir(cfg.dossier)).filter(f => f.endsWith('.json'));
  for (const f of fichiers) {
    try {
      const d = JSON.parse(await fs.promises.readFile(path.join(cfg.dossier, f), 'utf8'));
      if (d && d.id && Array.isArray(d.pages)) enregistrerDoc(d.id, d);
    } catch (e) { console.warn('Texte indexé illisible ignoré :', f); }
    await new Promise(r => setImmediate(r));
  }
  pret = true;
  synchroniser(db);
}

/* ---------- Recherche ---------- */
function pagesDe(id) {
  let c = cache.get(id);
  if (c) { cache.delete(id); cache.set(id, c); return c; }
  try {
    const d = JSON.parse(fs.readFileSync(fichierTexte(id), 'utf8'));
    c = { pages: d.pages, norm: d.pages.map(norm) };
  } catch { return null; }
  cache.set(id, c);
  while (cache.size > LIMITES.cacheDocs) cache.delete(cache.keys().next().value);
  return c;
}

/** Analyse la requête : mots (sans mots vides) et expressions entre guillemets. */
function analyser(q) {
  const brut = String(q || '').slice(0, 200);
  const expressions = [...brut.matchAll(/["«“]([^"»”]{2,})["»”]/g)].map(m => norm(m[1]).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const termes = [...new Set(mots(norm(brut)).filter(m => m.length > 1 && !MOTS_VIDES.has(m)))];
  return { termes, expressions };
}

/** Positions de début de mot où `terme` apparaît (préfixe autorisé). */
function occurrences(texteNorm, terme, max = 50) {
  const pos = [];
  let i = texteNorm.indexOf(terme);
  while (i >= 0 && pos.length < max) {
    if (!estLettre(texteNorm[i - 1])) pos.push(i);
    i = texteNorm.indexOf(terme, i + terme.length);
  }
  return pos;
}

function extrait(page, pageNorm, termes, expressions, premier) {
  const avant = 90, apres = 170;
  let debut = Math.max(0, premier - avant), fin = Math.min(page.length, premier + apres);
  while (debut > 0 && estLettre(page[debut - 1])) debut--;
  while (fin < page.length && estLettre(page[fin])) fin++;
  const brut = page.slice(debut, fin), brutNorm = pageNorm.slice(debut, fin);
  // compacter les espaces en conservant la correspondance des positions
  let texte = '', carte = [];
  for (let i = 0; i < brut.length; i++) {
    const blanc = /\s/.test(brut[i]);
    if (blanc && (texte.endsWith(' ') || !texte.length)) continue;
    texte += blanc ? ' ' : brut[i]; carte.push(i);
  }
  const normCompact = carte.map(i => brutNorm[i]).join('');
  const surlignes = [];
  for (const t of [...termes, ...expressions]) {
    let i = normCompact.indexOf(t);
    while (i >= 0) {
      if (!estLettre(normCompact[i - 1])) {
        let l = t.length;
        while (estLettre(normCompact[i + l]) && !expressions.includes(t)) l++;    // surligner le mot entier
        surlignes.push([i, l]);
      }
      i = normCompact.indexOf(t, i + t.length);
    }
  }
  surlignes.sort((a, b) => a[0] - b[0]);
  const fusion = [];
  for (const s of surlignes) { const d = fusion[fusion.length - 1]; if (d && s[0] <= d[0] + d[1]) d[1] = Math.max(d[1], s[0] + s[1] - d[0]); else fusion.push([...s]); }
  return { texte: (debut > 0 ? '… ' : '') + texte.trim() + (fin < page.length ? ' …' : ''), surlignes: fusion.map(([a, l]) => [a + (debut > 0 ? 2 : 0), l]) };
}

function rechercher(q, { maxLivres = 30, maxPagesParLivre = 3 } = {}) {
  const { termes, expressions } = analyser(q);
  const tousTermes = [...new Set([...termes, ...expressions.flatMap(e => mots(e).filter(m => m.length > 1 && !MOTS_VIDES.has(m)))])];
  if (!tousTermes.length) return { resultats: [], total: 0, termes: [] };
  // 1. livres candidats : intersection des listes (préfixe pour les mots de 3 lettres et plus)
  let candidats = null;
  for (const t of tousTermes) {
    const nums = new Set();
    if (t.length >= 3) { for (const [m, l] of index) if (m.startsWith(t)) for (const n of l) nums.add(n); }
    else for (const n of index.get(t) || []) nums.add(n);
    candidats = candidats ? new Set([...candidats].filter(n => nums.has(n))) : nums;
    if (!candidats.size) break;
  }
  // 2. pages exactes et extraits
  const resultats = [];
  let total = 0;
  for (const num of [...(candidats || [])].slice(0, 300)) {
    const id = parNum[num], d = docs.get(id);
    if (!d?.indexe) continue;
    const c = pagesDe(id);
    if (!c) continue;
    const correspondances = [];
    c.norm.forEach((pn, i) => {
      if (expressions.some(e => !pn.replace(/\s+/g, ' ').includes(e))) return;
      let score = 0, premier = Infinity;
      for (const t of tousTermes) {
        const o = occurrences(pn, t, 20);
        if (!o.length) { score = -1; break; }
        score += Math.min(o.length, 10); premier = Math.min(premier, o[0]);
      }
      if (score > 0) correspondances.push({ i, score, premier });
    });
    if (!correspondances.length) continue;
    total += correspondances.length;
    const meilleures = correspondances.slice().sort((a, b) => b.score - a.score || a.i - b.i).slice(0, maxPagesParLivre).sort((a, b) => a.i - b.i);
    resultats.push({ livreId: id, unite: d.unite, nbPagesTrouvees: correspondances.length,
      score: Math.max(...correspondances.map(x => x.score)) + correspondances.length * 0.2,
      correspondances: meilleures.map(m => ({ page: m.i + 1, ...extrait(c.pages[m.i], c.norm[m.i], tousTermes, expressions, m.premier) })) });
  }
  resultats.sort((a, b) => b.score - a.score);
  return { resultats: resultats.slice(0, maxLivres), total, termes: tousTermes };
}

function etat() {
  const liste = [...docs.values()];
  return { indexes: liste.filter(d => d.indexe).length, erreurs: liste.filter(d => d.erreur).length,
    sansTexte: liste.filter(d => d.sansTexte).length, enAttente: file.length + (enCours ? 1 : 0), mots: index.size, pret };
}

/* ---------- Relevé des recherches sans résultat ---------- */
function noterSansResultat(db, q) {
  const cle = norm(q).replace(/\s+/g, ' ').trim();
  if (cle.length < 3) return;
  db.recherchesSansResultat ||= [];
  const l = db.recherchesSansResultat;
  // une frappe plus longue remplace son début (« refor » → « reforme »)
  for (let i = l.length - 1; i >= 0; i--) if (cle.startsWith(l[i].cle) && l[i].cle !== cle && Date.now() - new Date(l[i].dernier) < 120000 && l[i].nb === 1) l.splice(i, 1);
  let e = l.find(x => x.cle === cle);
  if (!e) l.push(e = { cle, texte: String(q).trim().slice(0, 120), nb: 0, premier: new Date().toISOString() });
  e.nb++; e.dernier = new Date().toISOString();
  if (l.length > 500) { l.sort((a, b) => b.nb - a.nb || b.dernier.localeCompare(a.dernier)); l.length = 500; }
}

/* ---------- Routes ---------- */
async function route(req, res, c) {
  const { db, utilisateur: u, json, lireCorps, sauverDB, journal } = c;
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname, m = req.method;
  const envoyer = (code, data) => { json(res, code, data); return true; };

  if (p === '/api/recherche' && m === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 200);
    if (q.length < 2) return envoyer(200, { requete: q, resultats: [], total: 0, catalogue: 0, indexation: etat() });
    const r = rechercher(q);
    const ql = q.toLowerCase();
    const catalogue = (db.livres || []).filter(l => [l.titre, l.auteur, l.categorie, l.isbn, l.editeur, l.langue, l.niveau, l.motsCles, l.resume].some(x => String(x || '').toLowerCase().includes(ql))).length;
    const resultats = r.resultats.map(x => {
      const l = db.livres.find(y => y.id === x.livreId);
      return l && { ...x, livre: { id: l.id, titre: l.titre, auteur: l.auteur, categorie: l.categorie, icone: l.icone, couleur: l.couleur, couverture: !!l.couverture } };
    }).filter(Boolean);
    if (url.searchParams.get('journal') === '1' && !resultats.length && !catalogue) { noterSansResultat(db, q); sauverDB(); }
    return envoyer(200, { requete: q, termes: r.termes, resultats, total: r.total, catalogue, indexation: etat() });
  }

  if (!p.startsWith('/api/admin-recherche')) return false;
  if (!principal(u)) return envoyer(403, { erreur: 'Réservé à l’administrateur principal.' });
  if (p === '/api/admin-recherche' && m === 'GET') {
    const documents = (db.livres || []).map(l => {
      const d = docs.get(l.id), src = cfg ? source(l) : null;
      const statut = !src ? 'sans_fichier' : file.includes(l.id) || enCours === l.id || !d || d.signature !== src.signature ? 'en_attente'
        : d.erreur ? 'erreur' : d.sansTexte ? 'sans_texte' : 'indexe';
      return { id: l.id, titre: l.titre, auteur: l.auteur, format: src?.type || null, statut, nbPages: d?.nbPages || 0, unite: d?.unite || src?.unite || null, erreur: d?.erreur || null, extraitLe: d?.extraitLe || null };
    }).sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr'));
    const sansResultat = (db.recherchesSansResultat || []).slice().sort((a, b) => b.nb - a.nb || b.dernier.localeCompare(a.dernier)).slice(0, 200);
    return envoyer(200, { etat: etat(), documents, sansResultat });
  }
  if (p === '/api/admin-recherche/reindexer' && m === 'POST') {
    const b = await lireCorps(req).catch(() => ({}));
    const ids = b.id ? [String(b.id)] : [...docs.keys()];
    for (const id of ids) { const d = docs.get(id); if (d) d.signature = 'a-refaire'; }
    journal?.('Réindexation de la recherche', u, b.id ? ids[0] : 'tous les documents');
    synchroniser(db);
    return envoyer(200, { ok: true, etat: etat() });
  }
  if (p === '/api/admin-recherche/sans-resultat' && m === 'DELETE') {
    db.recherchesSansResultat = []; sauverDB();
    return envoyer(200, { ok: true });
  }
  return envoyer(404, { erreur: 'Route introuvable.' });
}

/* ---------- Accès au texte pour l'assistant IA (lot 2) ---------- */
/** Texte d'une page / d'un chapitre / d'une partie (numérotation à partir de 1). */
function texteUnite(id, n) {
  const d = docs.get(id);
  if (!d?.indexe) return null;
  const c = pagesDe(id);
  const t = c?.pages[Number(n) - 1];
  return t === undefined ? null : { texte: t, unite: d.unite, nbPages: d.nbPages };
}
const infoDoc = id => { const d = docs.get(id); return d ? { unite: d.unite, nbPages: d.nbPages, indexe: !!d.indexe, sansTexte: d.sansTexte } : null; };

/** Score « au moins un mot » : utile pour les questions en langage naturel. */
function scorerPages(c, termes, filtrePage) {
  const res = [];
  c.norm.forEach((pn, i) => {
    if (filtrePage && !filtrePage(i + 1)) return;
    let distincts = 0, total = 0, premier = Infinity;
    for (const t of termes) { const o = occurrences(pn, t, 15); if (o.length) { distincts++; total += o.length; premier = Math.min(premier, o[0]); } }
    if (distincts) res.push({ page: i + 1, score: distincts * 10 + Math.min(total, 20), distincts, premier });
  });
  return res.sort((a, b) => b.score - a.score);
}
/** Pages d'un livre les plus proches d'une question. */
function pagesPertinentes(id, question, max = 5, filtrePage) {
  const d = docs.get(id);
  if (!d?.indexe) return [];
  const c = pagesDe(id);
  if (!c) return [];
  const { termes } = analyser(question);
  if (!termes.length) return [];
  return scorerPages(c, termes, filtrePage).slice(0, max).map(x => ({ page: x.page, texte: c.pages[x.page - 1], score: x.score }));
}
/** Livres et pages les plus proches d'une question, dans toute la bibliothèque. */
function rechercherLarge(question, { maxLivres = 6, pagesParLivre = 2, ids = null } = {}) {
  const { termes } = analyser(question);
  if (!termes.length) return [];
  const scores = new Map();
  for (const t of termes) {
    const vus = new Set();
    if (t.length >= 4) { for (const [m, l] of index) if (m.startsWith(t)) for (const n of l) vus.add(n); }
    else for (const n of index.get(t) || []) vus.add(n);
    for (const n of vus) scores.set(n, (scores.get(n) || 0) + 1);
  }
  const minimum = termes.length >= 3 ? 2 : 1;
  const candidats = [...scores].filter(([n, sc]) => sc >= minimum && (!ids || ids.has(parNum[n]))).sort((a, b) => b[1] - a[1]).slice(0, 40);
  const res = [];
  for (const [num] of candidats) {
    const id = parNum[num], d = docs.get(id), c = d?.indexe && pagesDe(id);
    if (!c) continue;
    const pages = scorerPages(c, termes).slice(0, pagesParLivre);
    if (pages.length) res.push({ livreId: id, unite: d.unite, score: pages[0].score, pages: pages.map(x => ({ page: x.page, texte: c.pages[x.page - 1] })) });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, maxLivres);
}

module.exports = { texteUnite, infoDoc, pagesPertinentes, rechercherLarge, demarrer, planifier, synchroniser, rechercher, route, etat, norm, analyser, texteEpub, textePdf, noterSansResultat, _interne: { docs, index, file } };
