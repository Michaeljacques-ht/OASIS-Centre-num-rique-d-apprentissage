'use strict';
/* OASIS 1.31.0 — Collecte automatique d'ouvrages libres de droits.
   Objectif : atteindre un nombre d'ouvrages (10 000 par défaut) à une date cible (31 décembre 2026),
   en important régulièrement, jour et nuit, des livres du domaine public :
   - Project Gutenberg (catalogue via l'API Gutendex), en français ;
   - Wikisource francophone (EPUB générés par ws-export) ;
   - eCampusOntario Open Library, Zenodo, HAL et OAPEN : livres et manuels universitaires en français
     sous licence Creative Commons CC BY, CC BY-SA ou CC0 (jamais « NC » ni « ND », l'accès complet à OASIS passant par un don).
   La collecte s'étale sur la journée, respecte les sites sources (un livre à la fois, pauses),
   s'arrête si le disque se remplit, et peut être réglée ou suspendue dans l'espace bibliothécaire. */
const fs = require('fs');
const path = require('path');

const PAR_DEFAUT = {
  actif: true,
  objectif: 10000,
  dateCible: '2026-12-31',
  sources: { gutenberg: true, wikisource: true, ecampus: true, zenodo: true, hal: true, oapen: true },
  maxParHeure: 20,            // plafond de sécurité
  espaceMinMo: 800,           // la collecte s'arrête si le disque a moins d'espace libre
  tailleMaxMo: 40             // fichiers plus lourds ignorés
};
const INTERVALLE = 5 * 60 * 1000; // un passage toutes les 5 minutes
const UA = 'OASIS-Bibliotheque/1.31 (bibliotheque numerique educative en Haiti; collecte de livres du domaine public)';

/* Catégories Wikisource parcourues, avec la catégorie OASIS correspondante. */
const CATEGORIES_WIKISOURCE = [
  ['Romans', 'Roman'], ['Nouvelles', 'Littérature'], ['Contes', 'Littérature'], ['Théâtre', 'Littérature'],
  ['Recueils de poèmes', 'Littérature'], ['Poésie', 'Littérature'], ['Essais', 'Culture générale'], ['Philosophie', 'Philosophie'],
  ['Histoire', 'Histoire'], ['Mémoires', 'Histoire'], ['Biographies', 'Histoire'], ['Récits de voyage', 'Géographie'],
  ['Sciences', 'Sciences'], ['Économie', 'Économie'], ['Politique', 'Sciences politiques'], ['Droit', 'Droit'],
  ['Religion', 'Religion et spiritualité'], ['Éducation', 'Pédagogie'], ['Pédagogie', 'Pédagogie'], ['Littérature jeunesse', 'Littérature'],
  ['Fables', 'Littérature'], ['Correspondances', 'Littérature'], ['Discours', 'Histoire'], ['Médecine', 'Médecine'], ['Mathématiques', 'Mathématiques']
];

/** Catégorie OASIS à partir des sujets Gutenberg. */
function categorieGutenberg(sujets = []) {
  const t = sujets.join(' | ').toLowerCase();
  const regles = [
    [/poetry|poésie|poèmes/, 'Littérature'], [/drama|théâtre|comedies|tragedies/, 'Littérature'],
    [/history|histoire|biography|mémoires/, 'Histoire'], [/philosophy|philosophie|ethics/, 'Philosophie'],
    [/religion|bible|christian|theology|catholic/, 'Religion et spiritualité'], [/travel|voyages|description and travel/, 'Géographie'],
    [/law|droit/, 'Droit'], [/economics|économie|commerce/, 'Économie'], [/education|pédagogie|teaching/, 'Pédagogie'],
    [/medicine|médecine|hygiene/, 'Médecine'], [/mathematics|mathématiques|geometry|algebra/, 'Mathématiques'],
    [/science|physics|chemistry|botany|zoology|natural history|astronomy/, 'Sciences'], [/politic|government/, 'Sciences politiques'],
    [/juvenile|children|enfants|fairy tales|contes/, 'Littérature'], [/fiction|romans|novel/, 'Roman']
  ];
  for (const [re, c] of regles) if (re.test(t)) return c;
  return 'Littérature';
}
/** Catégorie OASIS à partir d'un texte libre (sujets, mots-clés, titre), en français ou en anglais. */
function categorieTexte(texte = '') {
  const t = String(texte).toLowerCase();
  const regles = [
    [/éducation|education|pédagog|pedagog|enseign|apprentissage|didacti|école|scolaire|teaching/, 'Pédagogie'], [/numérique|technolog|informati|digital|computer/, 'Technologie éducative'],
    [/santé|health|médec|medic|soins|infirm|nursing|épidémi/, 'Médecine'], [/mathémat|mathemat|statisti|calcul|algèbre/, 'Mathématiques'],
    [/droit|juridi|law|legal/, 'Droit'], [/économ|econom|finance|gestion|management|entrepr/, 'Économie'],
    [/histoire|history|histori|archéolog/, 'Histoire'], [/philosoph|éthique|ethics/, 'Philosophie'], [/sociolog|anthropolog|sociét|social/, 'Sciences sociales'],
    [/politi|gouvern|relations internationales|géopoliti/, 'Sciences politiques'], [/linguisti|langue|language|traduction|lexi/, 'Linguistique'],
    [/littérat|literat|roman|poésie|poetry|théâtre/, 'Littérature'], [/psycholog/, 'Psychologie'], [/géograph|geograph|territoir|urban/, 'Géographie'],
    [/environnement|environment|climat|écolog|ecolog|développement durable|énergie|energy/, 'Environnement'], [/agricult|agronom/, 'Agriculture'],
    [/religion|théolog|theolog|spiritu/, 'Religion et spiritualité'], [/communication|médias|journalis/, 'Communication'],
    [/chimie|chemist|physique|physics|biolog|scien/, 'Sciences']
  ];
  for (const [re, c] of regles) if (re.test(t)) return c;
  return 'Culture générale';
}
/** Licence acceptée : CC BY, CC BY-SA, CC0 ou domaine public ; jamais NC (non commercial) ni ND (pas de modification). */
function licenceLibre(texte = '') {
  const t = String(texte).toLowerCase();
  if (!t.trim()) return false;
  if (/by-nc|by-sa-nc|by-nd|\bnc\b|noncommercial|non-commercial|non commercial|\bnd\b|noderiv|pas d.utilisation commerciale|pas de modification/.test(t)) return false;
  return /cc[- ]?by|creativecommons\.org\/licenses\/by(-sa)?\/|cc0|publicdomain|public domain|domaine public|etalab|licence ouverte|attribution/.test(t);
}
const html = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const nomInverse = n => { n = String(n || '').trim(); return n.includes(',') ? n.split(',').map(x => x.trim()).filter(Boolean).reverse().join(' ') : n; };
const auteurs = liste => { const l = (liste || []).map(nomInverse).filter(Boolean); return l.length ? l.slice(0, 3).join(', ') + (l.length > 3 ? ' et al.' : '') : ''; };
const nomAuteur = a => { // « Hugo, Victor » → « Victor Hugo »
  const n = String(a?.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return n.includes(',') ? n.split(',').map(x => x.trim()).filter(Boolean).reverse().join(' ') : n;
};

/** Combien faut-il en importer à ce passage pour finir à temps, en étalant sur la journée ? */
function plan({ total, objectif, dateCible, faitsAujourdhui, maintenant = new Date(), maxParHeure = 20 }) {
  const fin = new Date(dateCible + 'T23:59:59');
  const restant = Math.max(0, objectif - total);
  if (!restant) return { restant, parJour: 0, cetteFois: 0, termine: true };
  const debutJour = new Date(maintenant); debutJour.setHours(0, 0, 0, 0);
  const joursRestants = Math.max(1, Math.ceil((fin - debutJour) / 86400000));
  const parJour = Math.ceil((restant + faitsAujourdhui) / joursRestants);
  const fractionJour = Math.min(1, (maintenant - debutJour) / 86400000 + INTERVALLE / 86400000);
  const attendu = Math.ceil(parJour * fractionJour);
  const plafond = Math.max(1, Math.round(maxParHeure * INTERVALLE / 3600000));
  return { restant, parJour, joursRestants, cetteFois: Math.max(0, Math.min(plafond, attendu - faitsAujourdhui, restant)), termine: false, enRetard: fin < maintenant };
}

function creer(ctx) {
  // ctx : { db, sauverDB, uid, maintenant, journal, importerDocumentLivre, doublons, dossierDonnees, fetch }
  const { db } = ctx;
  const fetchJson = async (url, delai = 60000) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), delai);
    try { const r = await (ctx.fetch || fetch)(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  };
  const reglages = () => { db.parametres.collecte = { ...PAR_DEFAUT, ...(db.parametres.collecte || {}), sources: { ...PAR_DEFAUT.sources, ...(db.parametres.collecte?.sources || {}) } }; return db.parametres.collecte; };
  const etat = () => { db.collecte ||= { curseurs: {}, deja: {}, historique: [], jour: '', faitsAujourdhui: 0, total: 0, echecs: 0 }; db.collecte.deja ||= {}; db.collecte.curseurs ||= {}; db.collecte.historique ||= []; return db.collecte; };
  const noter = (e, ligne) => { e.historique.unshift({ date: ctx.maintenant(), ...ligne }); e.historique = e.historique.slice(0, 300); };

  function espaceLibreMo() {
    try { const s = fs.statfsSync(ctx.dossierDonnees); return Math.round(s.bavail * s.bsize / 1048576); } catch { return null; }
  }

  /* ---------- Sources : chacune renvoie le prochain candidat, ou null quand elle est épuisée ---------- */
  async function candidatGutenberg(e) {
    const c = e.curseurs.gutenberg ||= { page: 1, file: [], fini: false };
    while (true) {
      while (c.file.length) {
        const b = c.file.shift();
        if (e.deja['gutenberg:' + b.id]) continue;
        if (b.copyright !== false && b.copyright !== null) { e.deja['gutenberg:' + b.id] = 'droits'; continue; }
        const auteur = (b.authors || []).map(nomAuteur).filter(Boolean).slice(0, 3).join(', ') || 'Anonyme';
        const morts = (b.authors || []).map(a => a.death_year).filter(Boolean);
        return {
          cle: 'gutenberg:' + b.id, source: 'Project Gutenberg (domaine public)',
          titre: String(b.title || '').replace(/\s*\r?\n\s*/g, ' : ').replace(/\s+/g, ' ').trim().slice(0, 300), auteur,
          categorie: categorieGutenberg([...(b.subjects || []), ...(b.bookshelves || [])]),
          resume: ((b.summaries || [])[0] ? 'Résumé (en anglais, Project Gutenberg) : ' + b.summaries[0].slice(0, 700) + ' ' : '') + `Ouvrage du domaine public, Project Gutenberg n° ${b.id}.`,
          annee: morts.length ? Math.min(...morts) : null,
          urls: [`https://www.gutenberg.org/ebooks/${b.id}.epub3.images`, `https://www.gutenberg.org/ebooks/${b.id}.epub.noimages`]
        };
      }
      if (c.fini) return null;
      const d = await fetchJson(`https://gutendex.com/books/?languages=fr&mime_type=application%2Fepub&page=${c.page}`);
      c.file = (d.results || []).filter(b => (b.languages || []).includes('fr'));
      c.page++; if (!d.next) c.fini = true;
    }
  }

  async function candidatWikisource(e) {
    const c = e.curseurs.wikisource ||= { categorie: 0, suite: '', file: [], fini: false };
    while (true) {
      while (c.file.length) {
        const page = c.file.shift();
        const cle = 'wikisource:' + page.title;
        if (e.deja[cle] || page.title.includes('/')) continue;
        const [, cat] = CATEGORIES_WIKISOURCE[Math.min(c.categorie, CATEGORIES_WIKISOURCE.length - 1)];
        return {
          cle, source: 'Wikisource (domaine public)', titre: page.title.replace(/\s*\(.*?\)\s*$/, '').slice(0, 300), auteur: '', categorie: page.categorie || cat,
          resume: `Texte du domaine public transcrit et relu par les bénévoles de Wikisource. Source : https://fr.wikisource.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
          annee: null, urls: ['https://ws-export.wmcloud.org/?format=epub&lang=fr&page=' + encodeURIComponent(page.title)], wikisource: true
        };
      }
      if (c.fini || c.categorie >= CATEGORIES_WIKISOURCE.length) { c.fini = true; return null; }
      const [nom, cat] = CATEGORIES_WIKISOURCE[c.categorie];
      const url = 'https://fr.wikisource.org/w/api.php?action=query&list=categorymembers&cmnamespace=0&cmlimit=200&format=json&cmtitle=' + encodeURIComponent('Catégorie:' + nom) + (c.suite ? '&cmcontinue=' + encodeURIComponent(c.suite) : '');
      let d; try { d = await fetchJson(url); } catch { d = {}; }
      c.file = (d.query?.categorymembers || []).map(p => ({ title: p.title, categorie: cat }));
      if (d.continue?.cmcontinue) c.suite = d.continue.cmcontinue; else { c.categorie++; c.suite = ''; }
    }
  }


  /* ---------- Sources universitaires en libre accès (CC BY / CC BY-SA) ---------- */
  const fetchTexte = async (url, delai = 60000) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), delai);
    try { const r = await (ctx.fetch || fetch)(url, { headers: { 'User-Agent': UA }, signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
    finally { clearTimeout(t); }
  };
  const ECAMPUS = 'https://openlibrary-repo.ecampusontario.ca';
  async function candidatEcampus(e) {
    const c = e.curseurs.ecampus ||= { offset: 0, file: [], fini: false };
    while (true) {
      while (c.file.length) {
        const id = c.file.shift(), cle = 'ecampus:' + id;
        if (e.deja[cle]) continue;
        let page; try { page = await fetchTexte(`${ECAMPUS}/jspui/handle/123456789/${id}?mode=full`); } catch { e.deja[cle] = 'erreur'; continue; }
        const md = {};
        for (const m of page.matchAll(/metadataFieldLabel[^>]*>\s*([\w.]+)[^<]*<\/td>\s*<td[^>]*metadataFieldValue[^>]*>([\s\S]*?)<\/td>/g)) (md[m[1]] ||= []).push(html(m[2]));
        const langue = (md['dc.language.iso'] || []).join(' '), lic = (md['dc.rights'] || md['dc.rights.license'] || md['dc.rights.uri'] || []).join(' ');
        if (!/fr/i.test(langue) || !licenceLibre(lic)) { e.deja[cle] = 'hors critères'; continue; }
        const fichiers = [...new Set([...page.matchAll(/href="(\/jspui\/bitstream\/123456789\/\d+\/\d+\/[^"]+\.(?:epub|pdf))"/gi)].map(m => m[1]))];
        const epub = fichiers.filter(x => /\.epub$/i.test(x)), pdf = fichiers.filter(x => /\.pdf$/i.test(x)).sort((a, b) => /_print/.test(a) - /_print/.test(b));
        if (!fichiers.length) { e.deja[cle] = 'sans fichier'; continue; }
        const titre = (md['dc.title'] || [''])[0];
        const aut = auteurs(md['dc.contributor.author']) || (md['dc.contributor.editor'] ? auteurs(md['dc.contributor.editor']) + ' (dir.)' : '') || (md['dc.publisher'] || [''])[0];
        return { cle, source: 'eCampusOntario Open Library (libre accès)', titre: titre.slice(0, 300), auteur: aut, categorie: categorieTexte([titre, ...(md['dc.subject'] || [])].join(' ')),
          resume: ((md['dc.description.abstract'] || [''])[0].slice(0, 700) + ` Ouvrage en libre accès sous licence ${lic.split(' ').slice(0, 2).join(' ')}. Source : ${ECAMPUS}/jspui/handle/123456789/${id}`).trim(),
          annee: parseInt((md['dc.date.issued'] || [''])[0], 10) || null, editeur: (md['dc.publisher'] || [''])[0], isbn: (md['dc.identifier.isbn'] || [''])[0],
          public: 'universitaire', natures: ['epub', 'pdf'], urls: [...epub, ...pdf].map(x => ECAMPUS + x), pagesMin: 20 };
      }
      if (c.fini) return null;
      const liste = await fetchTexte(`${ECAMPUS}/jspui/browse?type=dateissued&sort_by=2&order=DESC&rpp=100&offset=${c.offset}`);
      c.file = [...new Set([...liste.matchAll(/\/jspui\/handle\/123456789\/(\d+)/g)].map(m => m[1]))];
      c.offset += 100; if (c.file.length < 20) c.fini = true;
    }
  }

  async function candidatZenodo(e) {
    const c = e.curseurs.zenodo ||= { page: 1, file: [], fini: false };
    while (true) {
      while (c.file.length) {
        const h = c.file.shift(), m = h.metadata || {}, cle = 'zenodo:' + h.id;
        if (e.deja[cle]) continue;
        const lic = m.license?.id || (m.rights || []).map(x => x.id || x.title?.en || '').join(' ');
        const fichiers = (h.files || []).filter(f => /\.(epub|pdf)$/i.test(f.key || f.filename || '') && (f.size || 0) < 60 * 1048576);
        if (!licenceLibre(lic) || !fichiers.length) { e.deja[cle] = 'hors critères'; continue; }
        fichiers.sort((a, b) => /\.epub$/i.test(b.key || '') - /\.epub$/i.test(a.key || ''));
        return { cle, source: 'Zenodo (libre accès)', titre: String(m.title || '').slice(0, 300), auteur: auteurs((m.creators || []).map(x => x.name || x.person_or_org?.name)),
          categorie: categorieTexte([m.title, ...(m.keywords || []), ...(m.subjects || []).map(x => x.term || x.subject || '')].join(' ')),
          resume: (html(m.description || '').slice(0, 700) + ` Ouvrage en libre accès (${lic}). Source : https://zenodo.org/records/${h.id}`).trim(),
          annee: parseInt(String(m.publication_date || ''), 10) || null, editeur: m.imprint?.publisher || m.publisher || '', isbn: m.imprint?.isbn || '',
          public: 'universitaire', natures: ['epub', 'pdf'], urls: fichiers.map(f => f.links?.self || f.links?.content || `https://zenodo.org/records/${h.id}/files/${encodeURIComponent(f.key)}?download=1`) };
      }
      if (c.fini) return null;
      const q = encodeURIComponent('resource_type.subtype:book AND language:fra AND access_right:open');
      const d = await fetchJson(`https://zenodo.org/api/records?q=${q}&size=50&page=${c.page}&sort=mostviewed`);
      c.file = d.hits?.hits || []; c.page++; if (c.file.length < 50 || c.page > 200) c.fini = true;
    }
  }

  async function candidatHal(e) {
    const c = e.curseurs.hal ||= { start: 0, file: [], fini: false };
    while (true) {
      while (c.file.length) {
        const d = c.file.shift(), cle = 'hal:' + d.halId_s;
        if (e.deja[cle]) continue;
        if (!d.fileMain_s || !licenceLibre(d.licence_s)) { e.deja[cle] = 'hors critères'; continue; }
        const titre = (Array.isArray(d.title_s) ? d.title_s[0] : d.title_s) || '';
        return { cle, source: 'HAL — archive ouverte (libre accès)', titre: String(titre).slice(0, 300), auteur: auteurs(d.authFullName_s),
          categorie: categorieTexte([titre, ...(d.keyword_s || []), ...(d.domain_s || [])].join(' ')),
          resume: ((Array.isArray(d.abstract_s) ? d.abstract_s[0] : d.abstract_s || '').slice(0, 700) + ` Ouvrage en libre accès (${d.licence_s}). Source : https://hal.science/${d.halId_s}`).trim(),
          annee: d.producedDateY_i || null, editeur: (d.publisher_s || [''])[0] || '', isbn: d.isbn_s || '', public: 'universitaire', natures: ['pdf', 'epub'], urls: [d.fileMain_s] };
      }
      if (c.fini) return null;
      const fl = 'halId_s,title_s,authFullName_s,producedDateY_i,fileMain_s,licence_s,abstract_s,publisher_s,isbn_s,keyword_s,domain_s';
      const d = await fetchJson(`https://api.archives-ouvertes.fr/search/?q=*:*&fq=docType_s:OUV&fq=language_s:fr&fq=submitType_s:file&fl=${fl}&rows=100&start=${c.start}&sort=producedDateY_i%20desc&wt=json`);
      c.file = d.response?.docs || []; c.start += 100; if (c.file.length < 100) c.fini = true;
    }
  }

  async function candidatOapen(e) {
    const c = e.curseurs.oapen ||= { offset: 0, file: [], fini: false };
    while (true) {
      while (c.file.length) {
        const it = c.file.shift(), cle = 'oapen:' + (it.handle || it.uuid);
        if (e.deja[cle]) continue;
        const md = {}; for (const x of it.metadata || []) (md[x.key] ||= []).push(x.value);
        const lic = [...(md['dc.rights'] || []), ...(md['dc.rights.uri'] || []), ...(md['oapen.relation.isPublishedBy'] ? [] : [])].join(' ');
        const fichiers = (it.bitstreams || []).filter(b => /pdf|epub/i.test(b.mimeType || b.name || '') && b.bundleName !== 'THUMBNAIL' && b.bundleName !== 'TEXT');
        const langues = (md['dc.language'] || md['dc.language.iso'] || []).join(' ').toLowerCase();
        if (!licenceLibre(lic) || !fichiers.length || (langues && !/fr|fre|fra|french|français/.test(langues))) { e.deja[cle] = 'hors critères'; continue; }
        const titre = (md['dc.title'] || [it.name || ''])[0];
        return { cle, source: 'OAPEN Library (libre accès)', titre: String(titre).slice(0, 300), auteur: auteurs(md['dc.contributor.author']) || (md['dc.contributor.editor'] ? auteurs(md['dc.contributor.editor']) + ' (dir.)' : ''),
          categorie: categorieTexte([titre, ...(md['dc.subject.other'] || []), ...(md['dc.subject.classification'] || [])].join(' ')),
          resume: (String((md['dc.description.abstract'] || [''])[0]).slice(0, 700) + ` Ouvrage en libre accès (${lic.slice(0, 80)}). Source : https://library.oapen.org/handle/${it.handle}`).trim(),
          annee: parseInt((md['dc.date.issued'] || [''])[0], 10) || null, editeur: (md['publisher.name'] || md['dc.publisher'] || [''])[0], isbn: (md['oapen.identifier.isbn'] || [''])[0],
          public: 'universitaire', natures: ['pdf', 'epub'], urls: fichiers.map(b => 'https://library.oapen.org' + b.retrieveLink) };
      }
      if (c.fini) return null;
      const d = await fetchJson(`https://library.oapen.org/rest/search?query=${encodeURIComponent('dc.language.iso:fre')}&expand=metadata,bitstreams&limit=25&offset=${c.offset}`);
      c.file = Array.isArray(d) ? d : []; c.offset += 25; if (c.file.length < 25) c.fini = true;
    }
  }

  const SOURCES = { gutenberg: candidatGutenberg, wikisource: candidatWikisource, ecampus: candidatEcampus, zenodo: candidatZenodo, hal: candidatHal, oapen: candidatOapen };

  /* ---------- Un import ---------- */
  async function importerUn(e, r) {
    // Les sources actives sont utilisées à tour de rôle, pour varier le catalogue.
    const epuisee = k => !!(e.curseurs[k]?.fini && !e.curseurs[k]?.file?.length);
    const actives = Object.keys(SOURCES).filter(k => r.sources[k] && !epuisee(k) && !(e.indispo?.[k] > Date.now()));
    if (!actives.length) return { epuise: !Object.keys(SOURCES).some(k => r.sources[k] && !epuisee(k)), attente: true };
    e.tour = ((e.tour || 0) + 1) % 1e9;
    const ordre = actives.map((_, i) => actives[(e.tour + i) % actives.length]);
    for (const nomSource of ordre) {
      let cand; try { cand = await SOURCES[nomSource](e); }
      catch (err) { (e.indispo ||= {})[nomSource] = Date.now() + 3600000; noter(e, { statut: 'erreur', source: nomSource, message: 'Source indisponible pendant 1 h : ' + err.message }); continue; }
      if (!cand) continue;
      if (!cand.titre) { e.deja[cand.cle] = 'sans titre'; return { suite: true }; }
      const proto = { titre: cand.titre, auteur: cand.auteur || 'Anonyme', langue: 'Français', edition: '' };
      if (cand.auteur && ctx.doublons.trouver(db.livres, proto, 'livres')) { e.deja[cand.cle] = 'doublon'; return { suite: true }; }
      const l = {
        id: ctx.uid(), titre: cand.titre, auteur: cand.auteur || 'Anonyme', categorie: cand.categorie, type: 'numerique',
        resume: cand.resume, couleur: '#1e4fa3', icone: '📘', annee: cand.annee || '', isbn: cand.isbn || '', edition: '', editeur: cand.editeur || '',
        sourceNumerique: cand.source, sourceCollecte: cand.cle, langue: 'Français', seuilLecture: undefined, publicCible: cand.public || 'tous',
        contenu: null, notes: [], nbLectures: 0, nbTelechargements: 0, creeLe: ctx.maintenant(), collecteAuto: true
      };
      db.livres.push(l);
      let ok = false, dernier = '';
      for (const url of cand.urls) {
        try { await ctx.importerDocumentLivre(l, url, null, { natures: cand.natures || ['epub'], tailleMax: r.tailleMaxMo * 1048576, sansJournal: true }); ok = true; break; }
        catch (err) { dernier = err.message; if (err.statut === 409) break; }
      }
      if (!ok) {
        db.livres.splice(db.livres.indexOf(l), 1);
        e.deja[cand.cle] = 'échec'; e.echecs++;
        noter(e, { statut: 'echec', titre: cand.titre, source: cand.source, message: dernier.slice(0, 200) });
        ctx.sauverDB(); return { suite: true };
      }
      // Pas de « documents » de quelques pages présentés comme des ouvrages
      if (l.pdf && l.nbPagesLecture && l.nbPagesLecture < (cand.pagesMin || 15)) { ctx.supprimerLivre(l); e.deja[cand.cle] = 'trop court'; ctx.sauverDB(); return { suite: true }; }
      // Wikisource : auteur et année lus dans le fichier EPUB
      if (cand.wikisource && ctx.completerDepuisEpub) await ctx.completerDepuisEpub(l).catch(() => {});
      if (cand.wikisource && l.auteur !== 'Anonyme' && db.livres.some(x => x.id !== l.id && ctx.doublons.trouver([x], l, 'livres'))) {
        ctx.supprimerLivre(l); e.deja[cand.cle] = 'doublon'; ctx.sauverDB(); return { suite: true };
      }
      e.deja[cand.cle] = l.id; e.total++; e.faitsAujourdhui++;
      noter(e, { statut: 'ok', titre: l.titre, auteur: l.auteur, source: cand.source, livreId: l.id });
      ctx.sauverDB();
      return { ok: true };
    }
    return { epuise: true };
  }

  let enCours = false, minuteur = null, dernierPassage = null;
  async function passage({ force = 0 } = {}) {
    if (enCours) return { occupe: true };
    const r = reglages(), e = etat();
    if (!r.actif && !force) return { inactif: true };
    const aujourdHui = new Date().toISOString().slice(0, 10);
    if (e.jour !== aujourdHui) { e.jour = aujourdHui; e.faitsAujourdhui = 0; }
    const libre = espaceLibreMo();
    if (libre !== null && libre < r.espaceMinMo) { e.pause = `Espace disque insuffisant (${libre} Mo libres)`; ctx.sauverDB(); return { disque: libre }; }
    e.pause = ''; e.epuise = false;
    const p = plan({ total: db.livres.length, objectif: r.objectif, dateCible: r.dateCible, faitsAujourdhui: e.faitsAujourdhui, maxParHeure: r.maxParHeure });
    const nombre = force || p.cetteFois;
    enCours = true; dernierPassage = ctx.maintenant();
    let faits = 0, essais = 0;
    try {
      while (faits < nombre && essais < nombre * 6 + 6) {
        essais++;
        const res = await importerUn(e, r);
        if (res.epuise) { e.epuise = true; break; }
        if (res.attente) break;
        if (res.ok) faits++;
        await new Promise(ok => setTimeout(ok, ctx.pause ?? 4000)); // politesse envers les sites sources
      }
    } finally { enCours = false; e.dernierPassage = dernierPassage; ctx.sauverDB(); }
    return { faits, prevus: nombre };
  }

  function etatPublic() {
    const r = reglages(), e = etat();
    const curseurs = Object.fromEntries(Object.keys(SOURCES).map(k => [k, e.curseurs[k] ? { fini: !!(e.curseurs[k].fini && !e.curseurs[k].file?.length), position: e.curseurs[k].page || e.curseurs[k].offset || e.curseurs[k].start || (CATEGORIES_WIKISOURCE[e.curseurs[k].categorie]?.[0]) || 0, pause: e.indispo?.[k] > Date.now() } : null]));
    const p = plan({ total: db.livres.length, objectif: r.objectif, dateCible: r.dateCible, faitsAujourdhui: e.faitsAujourdhui, maxParHeure: r.maxParHeure });
    return { reglages: r, total: db.livres.length, importesAuto: e.total, echecs: e.echecs, aujourdhui: e.jour === new Date().toISOString().slice(0, 10) ? e.faitsAujourdhui : 0,
      parJour: p.parJour, restant: p.restant, joursRestants: p.joursRestants, enCours, pause: e.pause || '', epuise: !!e.epuise, espaceLibreMo: espaceLibreMo(),
      dernierPassage: e.dernierPassage || null, historique: e.historique.slice(0, 60),
      sources: curseurs };
  }

  function demarrer() {
    if (minuteur) return;
    reglages(); etat();
    minuteur = setInterval(() => passage().catch(err => console.warn('Collecte automatique :', err.message)), INTERVALLE);
    setTimeout(() => passage().catch(() => {}), 60000); // premier passage une minute après le démarrage
    console.log('Collecte automatique : active (objectif ' + reglages().objectif + ' ouvrages au ' + reglages().dateCible + ').');
  }

  /* ---------- Routes (espace bibliothécaire) ---------- */
  async function route(req, res, { utilisateur, json, lireCorps, journal }) {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api/collecte')) return false;
    if (utilisateur?.role !== 'bibliothecaire') { json(res, 403, { erreur: 'Réservé au bibliothécaire.' }); return true; }
    if (url === '/api/collecte' && req.method === 'GET') { json(res, 200, etatPublic()); return true; }
    if (url === '/api/collecte' && req.method === 'PUT') {
      const c = await lireCorps(req), r = reglages();
      if (typeof c.actif === 'boolean') r.actif = c.actif;
      if (Number.isInteger(c.objectif) && c.objectif >= 100 && c.objectif <= 200000) r.objectif = c.objectif;
      if (/^\d{4}-\d{2}-\d{2}$/.test(c.dateCible || '')) r.dateCible = c.dateCible;
      if (Number.isInteger(c.maxParHeure) && c.maxParHeure >= 1 && c.maxParHeure <= 60) r.maxParHeure = c.maxParHeure;
      if (Number.isInteger(c.espaceMinMo) && c.espaceMinMo >= 100) r.espaceMinMo = c.espaceMinMo;
      if (c.sources && typeof c.sources === 'object') for (const k of Object.keys(SOURCES)) if (typeof c.sources[k] === 'boolean') r.sources[k] = c.sources[k];
      journal('Collecte automatique réglée', utilisateur, `${r.actif ? 'active' : 'suspendue'} — objectif ${r.objectif} au ${r.dateCible}`);
      ctx.sauverDB(); json(res, 200, etatPublic()); return true;
    }
    if (url === '/api/collecte/lancer' && req.method === 'POST') {
      const { nombre } = await lireCorps(req);
      const n = Math.min(20, Math.max(1, parseInt(nombre, 10) || 5));
      if (enCours) { json(res, 409, { erreur: 'Une collecte est déjà en cours.' }); return true; }
      passage({ force: n }).catch(err => console.warn('Collecte manuelle :', err.message));
      json(res, 202, { ok: true, message: `Collecte de ${n} ouvrage(s) lancée en arrière-plan.` }); return true;
    }
    return false;
  }

  return { demarrer, passage, route, etatPublic, importerUn, reglages, etat };
}

module.exports = { creer, plan, categorieGutenberg, categorieTexte, licenceLibre, nomAuteur, PAR_DEFAUT, CATEGORIES_WIKISOURCE };
