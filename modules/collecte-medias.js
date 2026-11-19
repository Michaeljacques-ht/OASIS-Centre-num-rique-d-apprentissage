'use strict';
/* OASIS 1.33.0 — Collecte automatique des médias et des ressources documentaires.
   - Vidéos : nouvelles vidéos de chaînes YouTube éducatives (flux RSS publics, lecture intégrée, rien n'est copié) ;
   - Podcasts : épisodes d'émissions éducatives (flux RSS, écoute en continu depuis l'éditeur) ;
   - Livres audio : LibriVox (domaine public, écoute en continu depuis Internet Archive) ;
   - Cartes : Wikimedia Commons (domaine public ou licences libres), avec vignette ;
   - Ressources : encyclopédies, dictionnaires, bases de données scientifiques, ressources spécialisées,
     laboratoires virtuels, outils technopédagogiques, sites officiels et administratifs (liste de référence).
   Les quotas quotidiens sont étalés sur la journée et réglables dans l'espace bibliothécaire. */
const { CHAINES_YOUTUBE, PODCASTS, CATEGORIES_CARTES, RESSOURCES } = require('./collecte-catalogues');

const QUOTAS = { videos: 15, podcasts: 10, livresAudio: 5, cartes: 10, ressources: 6 };
const NOMS = { videos: 'Vidéos', podcasts: 'Podcasts', livresAudio: 'Livres audio', cartes: 'Cartes', ressources: 'Ressources' };
const INTERVALLE = 10 * 60 * 1000;
const UA = 'OASIS-Bibliotheque/1.33 (bibliotheque numerique educative en Haiti)';

const texte = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const balise = (xml, nom) => { const m = xml.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`)); return m ? texte(m[1]) : ''; };
const attribut = (xml, nom, attr) => { const m = xml.match(new RegExp(`<${nom}\\b[^>]*\\b${attr}="([^"]*)"`)); return m ? m[1].replace(/&amp;/g, '&') : ''; };
const https = u => String(u || '').replace(/^http:\/\//i, 'https://');
const licenceOk = l => { const t = String(l || '').toLowerCase(); return !!t && !/\bnc\b|\bnd\b|-nc|-nd|non-commercial|noncommercial|noderiv|fair use|copyrighted/.test(t) && /public domain|\bpd\b|pd-|cc0|cc by|cc-by|attribution|gfdl|domaine public/.test(t); };
const duree = s => { s = String(s || '').trim(); if (/^\d+$/.test(s)) { const n = +s; return n >= 3600 ? `${Math.floor(n / 3600)} h ${Math.round(n % 3600 / 60)} min` : `${Math.max(1, Math.round(n / 60))} min`; } const p = s.split(':').map(Number); if (p.length >= 2 && p.every(x => !isNaN(x))) { const sec = p.reduce((a, b) => a * 60 + b, 0); return duree(String(sec)); } return s.slice(0, 20); };
const cleUrl = u => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase(); } catch { return String(u || '').toLowerCase(); } };

function creer(ctx) {
  // ctx : { db, sauverDB, uid, maintenant, importerFichierMedia, telechargerVignette, fetch, pause }
  const { db } = ctx;
  const req = async (url, type = 'json', delai = 60000) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), delai);
    try { const r = await (ctx.fetch || fetch)(url, { headers: { 'User-Agent': UA }, signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return type === 'json' ? await r.json() : await r.text(); }
    finally { clearTimeout(t); }
  };
  const reglages = () => { db.parametres.collecteMedias = { actif: true, ...(db.parametres.collecteMedias || {}), quotas: { ...QUOTAS, ...(db.parametres.collecteMedias?.quotas || {}) } }; return db.parametres.collecteMedias; };
  const etat = () => {
    const e = db.collecteMedias ||= {}; e.curseurs ||= {}; e.deja ||= {}; e.historique ||= []; e.aujourdhui ||= {}; e.totaux ||= {};
    // 1.33.1 : les flux lus (vidéos, podcasts) restent en mémoire ; ils ne sont plus recopiés dans la base à chaque enregistrement.
    for (const k of ['videos', 'podcasts']) if (e.curseurs[k]?.cache) delete e.curseurs[k].cache;
    if (e.curseurs.livresAudio?.file?.length && !e.curseurs.livresAudio.allege) { e.curseurs.livresAudio.file = e.curseurs.livresAudio.file.map(allegerLivre); e.curseurs.livresAudio.allege = 1; }
    return e;
  };
  const caches = { videos: {}, podcasts: {} };
  const allegerLivre = b => ({ id: b.id, title: b.title, language: b.language, authors: (b.authors || []).map(a => ({ first_name: a.first_name, last_name: a.last_name })), genres: (b.genres || []).map(g => ({ name: g.name })),
    description: String(b.description || '').slice(0, 900), totaltime: b.totaltime, copyright_year: b.copyright_year, sections: (b.sections || []).map(x => ({ section_number: x.section_number, title: x.title, listen_url: x.listen_url, playtime: x.playtime })) });
  const noter = (e, l) => { e.historique.unshift({ date: ctx.maintenant(), ...l }); e.historique = e.historique.slice(0, 200); };
  const nouveauMedia = (champs) => ({ id: ctx.uid(), titre: '', auteur: '', categorie: '', description: '', langue: 'Français', annee: new Date().getFullYear(), lieu: '', duree: '', motsCles: '', ext: '', mime: '', taille: 0, youtube: '', nbLectures: 0, creeLe: ctx.maintenant(), collecteAuto: true, ...champs });

  /* ---------- Vidéos YouTube ---------- */
  async function video(e) {
    const c = e.curseurs.videos ||= { i: 0 };
    const ids = new Set(db.medias.map(m => m.youtube).filter(Boolean));
    for (let n = 0; n < CHAINES_YOUTUBE.length; n++) {
      const [nom, chaine, categorie] = CHAINES_YOUTUBE[c.i++ % CHAINES_YOUTUBE.length];
      const cache = caches.videos[chaine];
      let entrees = cache && Date.now() - cache.t < 6 * 3600000 ? cache.entrees : null;
      if (!entrees) {
        let xml; try { xml = await req(`https://www.youtube.com/feeds/videos.xml?channel_id=${chaine}`, 'text'); } catch { continue; }
        entrees = xml.split('<entry>').slice(1).map(x => ({ id: balise(x, 'yt:videoId'), titre: balise(x, 'title'), lien: attribut(x, 'link', 'href'), date: balise(x, 'published'), description: balise(x, 'media:description') }));
        caches.videos[chaine] = { t: Date.now(), entrees: entrees.map(x => ({ ...x, description: x.description.slice(0, 700) })) };
      }
      const v = entrees.find(x => /^[\w-]{11}$/.test(x.id) && !ids.has(x.id) && !e.deja['yt:' + x.id] && !/\/shorts\//.test(x.lien) && !/#shorts?\b/i.test(x.titre + ' ' + x.description));
      if (!v) continue;
      e.deja['yt:' + v.id] = 1;
      const mo = nouveauMedia({ type: 'video', titre: v.titre.slice(0, 300), auteur: nom, categorie, youtube: v.id, annee: parseInt(v.date, 10) || new Date().getFullYear(),
        description: (v.description.slice(0, 600) + ` Source : chaîne YouTube « ${nom} ».`).trim(), motsCles: `${nom}, vidéo éducative`, sourceCollecte: 'youtube:' + v.id });
      db.medias.push(mo); return { ok: true, titre: mo.titre, source: nom };
    }
    return null;
  }

  /* ---------- Podcasts ---------- */
  async function podcast(e) {
    const c = e.curseurs.podcasts ||= { i: 0 };
    const urls = new Set(db.medias.flatMap(m => (m.pistes || []).map(p => p.url)));
    for (let n = 0; n < PODCASTS.length; n++) {
      const [nom, flux, categorie] = PODCASTS[c.i++ % PODCASTS.length];
      const cache = caches.podcasts[flux];
      let items = cache && Date.now() - cache.t < 12 * 3600000 ? cache.items : null;
      if (!items) {
        let xml; try { xml = await req(flux, 'text'); } catch { continue; }
        items = xml.split('<item>').slice(1).map(x => ({ titre: balise(x, 'title'), url: https(attribut(x, 'enclosure', 'url')), type: attribut(x, 'enclosure', 'type'), duree: balise(x, 'itunes:duration'), date: balise(x, 'pubDate'), description: balise(x, 'description') || balise(x, 'itunes:summary') })).filter(x => x.url && /audio|mpeg|mp3|m4a/i.test(x.type + x.url));
        items = items.slice(0, 60).map(x => ({ ...x, description: x.description.slice(0, 700) })); caches.podcasts[flux] = { t: Date.now(), items };
      }
      const ep = items.find(x => !urls.has(x.url) && !e.deja['pod:' + x.url]);
      if (!ep) continue;
      e.deja['pod:' + ep.url] = 1;
      const mo = nouveauMedia({ type: 'audio', titre: ep.titre.slice(0, 300), auteur: nom, categorie, duree: duree(ep.duree), annee: new Date(ep.date).getFullYear() || new Date().getFullYear(),
        description: (ep.description.slice(0, 600) + ` Podcast « ${nom} », écoute en ligne depuis le site de l'éditeur.`).trim(), motsCles: `podcast, ${nom}`,
        podcast: true, pistes: [{ titre: ep.titre.slice(0, 200), url: ep.url, duree: duree(ep.duree) }], sourceCollecte: 'podcast:' + ep.url, telechargementAutorise: false });
      db.medias.push(mo); return { ok: true, titre: mo.titre, source: nom };
    }
    return null;
  }

  /* ---------- Livres audio LibriVox ---------- */
  async function livreAudio(e) {
    const c = e.curseurs.livresAudio ||= { offset: 0, file: [], fini: false };
    for (let essai = 0; essai < 12; essai++) {
      while (c.file.length) {
        const b = c.file.shift();
        if (e.deja['librivox:' + b.id] || db.medias.some(m => m.sourceCollecte === 'librivox:' + b.id)) continue;
        const pistes = (b.sections || []).map(s => ({ titre: texte(s.title).slice(0, 200) || 'Partie ' + s.section_number, url: https(s.listen_url), duree: duree(s.playtime) })).filter(p => /^https:\/\//.test(p.url));
        if (!pistes.length) { e.deja['librivox:' + b.id] = 'sans pistes'; continue; }
        e.deja['librivox:' + b.id] = 1;
        const auteur = (b.authors || []).map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).filter(Boolean).join(', ') || 'Anonyme';
        const genres = (b.genres || []).map(g => g.name).join(' ').toLowerCase();
        const categorie = /poetry|poésie/.test(genres) ? 'Littérature' : /history|histo/.test(genres) ? 'Histoire' : /philosoph/.test(genres) ? 'Philosophie' : /religio/.test(genres) ? 'Religion et spiritualité' : /science/.test(genres) ? 'Sciences' : /children|enfant|jeunesse/.test(genres) ? 'Littérature jeunesse' : 'Littérature';
        const mo = nouveauMedia({ type: 'audio', titre: texte(b.title).slice(0, 300), auteur, categorie, duree: b.totaltime || '', annee: parseInt(b.copyright_year, 10) || new Date().getFullYear(),
          description: (texte(b.description).slice(0, 600) + ` Livre audio du domaine public lu par des bénévoles LibriVox (${pistes.length} partie${pistes.length > 1 ? 's' : ''}).`).trim(),
          motsCles: 'livre audio, LibriVox, domaine public', livreAudio: true, pistes, sourceCollecte: 'librivox:' + b.id });
        db.medias.push(mo); return { ok: true, titre: mo.titre, source: 'LibriVox' };
      }
      if (c.fini) return null;
      const d = await req(`https://librivox.org/api/feed/audiobooks/?format=json&extended=1&limit=50&offset=${c.offset}`);
      const livres = d.books || [];
      c.offset += 50; if (livres.length < 50) c.fini = true;
      c.file = livres.filter(b => /french|français/i.test(b.language || '') && !e.deja['librivox:' + b.id]).map(allegerLivre);
    }
    return null;
  }

  /* ---------- Cartes Wikimedia Commons ---------- */
  async function carte(e) {
    const c = e.curseurs.cartes ||= { cat: 0, suite: '', file: [], finies: [] };
    for (let essai = 0; essai < 10; essai++) {
      while (c.file.length) {
        const f = c.file.shift(), cle = 'commons:' + f.titre;
        if (e.deja[cle] || db.medias.some(m => m.sourceCollecte === cle)) continue;
        e.deja[cle] = 1;
        const mo = nouveauMedia({ type: 'carte', titre: f.nom.slice(0, 300), auteur: f.auteur.slice(0, 200), categorie: f.categorie, lieu: f.lieu, annee: f.annee || '', description: f.description, motsCles: `carte, ${f.lieu}`.replace(/, $/, ''), sourceCollecte: cle });
        db.medias.push(mo);
        try { await ctx.importerFichierMedia(mo, f.url); }
        catch (err) { db.medias.splice(db.medias.indexOf(mo), 1); e.deja[cle] = 'échec'; noter(e, { statut: 'echec', type: 'cartes', titre: mo.titre, message: err.message }); return { echec: true }; }
        if (f.vignette) await ctx.telechargerVignette(mo, f.vignette).catch(() => {});
        return { ok: true, titre: mo.titre, source: 'Wikimedia Commons' };
      }
      if (c.cat >= CATEGORIES_CARTES.length) c.cat = 0;
      if (c.finies.length >= CATEGORIES_CARTES.length) return null;
      const [nomCat, categorie, lieu] = CATEGORIES_CARTES[c.cat];
      if (c.finies.includes(nomCat)) { c.cat++; continue; }
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtype=file&gcmlimit=30&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1920&gcmtitle=' + encodeURIComponent('Category:' + nomCat) + (c.suite ? '&gcmcontinue=' + encodeURIComponent(c.suite) : '');
      let d; try { d = await req(url); } catch { c.cat++; continue; }
      const pages = Object.values(d.query?.pages || {});
      c.file = pages.map(p => {
        const ii = (p.imageinfo || [])[0] || {}, md = ii.extmetadata || {}, v = k => texte(md[k]?.value || '');
        const lic = v('LicenseShortName') || v('License');
        if (!/image\/(jpeg|png|tiff)/.test(ii.mime || '') || (ii.width || 0) < 800 || !licenceOk(lic) || !ii.thumburl) return null;
        const nom = (v('ObjectName') || p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ')).trim();
        return { titre: p.title, nom, url: ii.thumburl, vignette: ii.thumburl.replace(/\/\d+px-/, '/330px-'), categorie, lieu, auteur: v('Artist').slice(0, 200) || 'Wikimedia Commons',
          annee: parseInt((v('DateTimeOriginal').match(/1[5-9]\d\d|20\d\d/) || [])[0], 10) || null,
          description: `${v('ImageDescription').slice(0, 500)} Licence : ${lic}. Source : Wikimedia Commons (${p.title}).`.trim() };
      }).filter(Boolean);
      if (d.continue?.gcmcontinue) c.suite = d.continue.gcmcontinue; else { c.finies.push(nomCat); c.suite = ''; c.cat++; }
    }
    return null;
  }

  /* ---------- Ressources documentaires ---------- */
  async function ressource(e) {
    const existants = new Set(db.ressources.map(r => cleUrl(r.lien)).filter(Boolean));
    const titres = new Set(db.ressources.map(r => String(r.titre).toLowerCase()));
    for (const [genre, titre, lien, description, categorie] of RESSOURCES) {
      if (existants.has(cleUrl(lien)) || titres.has(titre.toLowerCase()) || e.deja['res:' + lien]) continue;
      e.deja['res:' + lien] = 1;
      const icones = { encyclopedie: '📚', dictionnaire: '📖', base: '🗄️', specialise: '🔬', laboratoire: '🧪', 'outil-enseignant': '🧑‍🏫', 'outil-apprenant': '🎒', officiel: '🏛️', administratif: '🗂️' };
      const r = { id: ctx.uid(), genre, titre, contenu: description, source: new URL(lien).hostname.replace(/^www\./, ''), lien, icone: icones[genre] || '🔗', image: false,
        categorie: db.categories.some(c => c.nom === categorie) ? categorie : '', fichier: '', creeLe: ctx.maintenant(), collecteAuto: true };
      db.ressources.push(r); return { ok: true, titre, source: genre };
    }
    return null;
  }

  const COLLECTEURS = { videos: video, podcasts: podcast, livresAudio: livreAudio, cartes: carte, ressources: ressource };

  let enCours = false, minuteur = null;
  async function passage({ force } = {}) {
    if (enCours) return { occupe: true };
    const r = reglages(), e = etat();
    if (!r.actif && !force) return { inactif: true };
    if (!force && ctx.occupe?.()) return { reporte: true }; // 1.33.1 : on laisse la place aux lecteurs
    const jour = new Date().toISOString().slice(0, 10);
    if (e.jour !== jour) { e.jour = jour; e.aujourdhui = {}; }
    const debut = new Date(); debut.setHours(0, 0, 0, 0);
    const fraction = Math.min(1, (Date.now() - debut) / 86400000 + INTERVALLE / 86400000);
    enCours = true; const bilan = {};
    try {
      for (const [type, f] of Object.entries(COLLECTEURS)) {
        if (force && force !== type) continue;
        const quota = force ? (e.aujourdhui[type] || 0) + 3 : Math.ceil((r.quotas[type] || 0) * fraction);
        let faits = 0;
        while ((e.aujourdhui[type] || 0) < quota && faits < 5) {
          let res; try { res = await f(e); } catch (err) { noter(e, { statut: 'erreur', type, message: err.message }); break; }
          if (!res) { e.epuises = { ...(e.epuises || {}), [type]: ctx.maintenant() }; break; }
          if (res.ok) { faits++; e.aujourdhui[type] = (e.aujourdhui[type] || 0) + 1; e.totaux[type] = (e.totaux[type] || 0) + 1; noter(e, { statut: 'ok', type, titre: res.titre, source: res.source }); ctx.sauverDB(); }
          if (!force && ctx.occupe?.()) break;
          await new Promise(ok => setTimeout(ok, ctx.pause ?? 2000));
        }
        bilan[type] = faits;
      }
    } finally { enCours = false; e.dernierPassage = ctx.maintenant(); ctx.sauverDB(); }
    return bilan;
  }

  function etatPublic() {
    const r = reglages(), e = etat(), jour = new Date().toISOString().slice(0, 10);
    const compte = { videos: db.medias.filter(m => m.type === 'video').length, podcasts: db.medias.filter(m => m.podcast).length, livresAudio: db.medias.filter(m => m.livreAudio).length,
      cartes: db.medias.filter(m => m.type === 'carte').length, ressources: db.ressources.length };
    return { reglages: r, noms: NOMS, aujourdhui: e.jour === jour ? e.aujourdhui : {}, totaux: e.totaux, compte, enCours, dernierPassage: e.dernierPassage || null,
      epuises: e.epuises || {}, historique: e.historique.slice(0, 50), sources: { chaines: CHAINES_YOUTUBE.length, podcasts: PODCASTS.length, categoriesCartes: CATEGORIES_CARTES.length, ressourcesRestantes: RESSOURCES.filter(([, t, l]) => !e.deja['res:' + l]).length } };
  }

  function demarrer() {
    if (minuteur) return;
    reglages(); etat();
    minuteur = setInterval(() => passage().catch(err => console.warn('Collecte des médias :', err.message)), INTERVALLE);
    setTimeout(() => passage().catch(() => {}), 3 * 60000);
  }

  async function route(req2, res, { utilisateur, json, lireCorps, journal }) {
    const url = req2.url.split('?')[0];
    if (!url.startsWith('/api/collecte/medias')) return false;
    if (utilisateur?.role !== 'bibliothecaire') { json(res, 403, { erreur: 'Réservé au bibliothécaire.' }); return true; }
    if (url === '/api/collecte/medias' && req2.method === 'GET') { json(res, 200, etatPublic()); return true; }
    if (url === '/api/collecte/medias' && req2.method === 'PUT') {
      const c = await lireCorps(req2), r = reglages();
      if (typeof c.actif === 'boolean') r.actif = c.actif;
      for (const k of Object.keys(QUOTAS)) { const v = c.quotas?.[k]; if (Number.isInteger(v) && v >= 0 && v <= 200) r.quotas[k] = v; }
      journal('Collecte des médias réglée', utilisateur, `${r.actif ? 'active' : 'suspendue'} — ` + Object.entries(r.quotas).map(([k, v]) => `${NOMS[k]} ${v}/j`).join(', '));
      ctx.sauverDB(); json(res, 200, etatPublic()); return true;
    }
    if (url === '/api/collecte/medias/lancer' && req2.method === 'POST') {
      const { type } = await lireCorps(req2);
      if (!COLLECTEURS[type]) { json(res, 400, { erreur: 'Type inconnu.' }); return true; }
      if (enCours) { json(res, 409, { erreur: 'Une collecte est déjà en cours.' }); return true; }
      passage({ force: type }).catch(() => {});
      json(res, 202, { ok: true, message: `Collecte de 3 élément(s) « ${NOMS[type]} » lancée.` }); return true;
    }
    return false;
  }

  return { enCours: () => enCours, demarrer, passage, route, etatPublic, reglages, etat };
}

module.exports = { creer, QUOTAS, licenceOk, duree, cleUrl };
