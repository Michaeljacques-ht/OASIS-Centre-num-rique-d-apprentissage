'use strict';
/* OASIS — Vitrine (1.25.0)
   1. Annonces : messages courts affichés dans une barre défilante en haut de toutes les pages.
   2. Partenaires supporteurs : petites publicités (logo, slogan, offre, contacts, lien) sur l'accueil
      et dans une page dédiée, avec compteur de visites.

   Public :      GET  /api/annonces            GET  /api/partenaires
                 GET  /api/partenaires/:id/logo POST /api/partenaires/:id/clic
   Bibliothécaire : ?tous=1 sur les listes, POST /api/annonces | /api/partenaires,
                 PUT / DELETE /api/annonces/:id | /api/partenaires/:id, POST /api/partenaires/:id/logo */
const fs = require('fs'), path = require('path');
const DOSSIER_LOGOS = path.join(__dirname, '..', 'data', 'partenaires');
const TYPES_ANNONCE = { info: 'ℹ️', important: '⚠️', evenement: '📅', nouveaute: '✨', partenaire: '🤝', don: '💝' };
const NIVEAUX = { or: 'Partenaire Or', argent: 'Partenaire Argent', bronze: 'Partenaire Bronze', soutien: 'Supporteur' };
const ORDRE_NIVEAU = { or: 0, argent: 1, bronze: 2, soutien: 3 };
const MIMES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const clicsParIP = new Map();

const texte = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
const lienValide = v => { const s = texte(v, 500); if (!s) return ''; try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
const dateValide = v => { if (v === undefined || v === null || v === '') return ''; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const enCours = (x, maintenant = Date.now()) => x.actif !== false && (!x.debut || new Date(x.debut).getTime() <= maintenant) && (!x.fin || new Date(x.fin).getTime() + 86400000 > maintenant);

function lireAnnonce(b, ancien = {}) {
  const r = { ...ancien };
  if (b.texte !== undefined || !ancien.id) { r.texte = texte(b.texte, 280); if (!r.texte) throw Error('Le message est requis (280 caractères maximum).'); }
  if (b.type !== undefined || !ancien.id) r.type = Object.hasOwn(TYPES_ANNONCE, b.type) ? b.type : 'info';
  if (b.lien !== undefined) { const l = lienValide(b.lien); if (l === null) throw Error('Le lien doit commencer par http:// ou https://'); r.lien = l; }
  for (const k of ['debut', 'fin']) if (b[k] !== undefined) { const d = dateValide(b[k]); if (d === null) throw Error('Date invalide.'); r[k] = d; }
  if (b.actif !== undefined) r.actif = b.actif !== false;
  if (r.actif === undefined) r.actif = true;
  if (b.ordre !== undefined) r.ordre = Math.max(0, Math.min(999, Number(b.ordre) || 0));
  return r;
}

function lirePartenaire(b, ancien = {}) {
  const r = { ...ancien };
  if (b.nom !== undefined || !ancien.id) { r.nom = texte(b.nom, 120); if (!r.nom) throw Error('Le nom du partenaire est requis.'); }
  if (b.niveau !== undefined || !ancien.id) r.niveau = Object.hasOwn(NIVEAUX, b.niveau) ? b.niveau : 'soutien';
  for (const [k, max] of [['slogan', 140], ['description', 700], ['offre', 200], ['adresse', 200], ['secteur', 80], ['boutonTexte', 40]]) if (b[k] !== undefined) r[k] = texte(b[k], max);
  if (b.telephone !== undefined) r.telephone = texte(b.telephone, 40).replace(/[^\d+()\-. ]/g, '');
  if (b.whatsapp !== undefined) r.whatsapp = texte(b.whatsapp, 40).replace(/[^\d+]/g, '');
  if (b.email !== undefined) { r.email = texte(b.email, 160); if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) throw Error('Adresse email invalide.'); }
  for (const k of ['site', 'facebook', 'instagram']) if (b[k] !== undefined) { const l = lienValide(b[k]); if (l === null) throw Error('Les liens doivent commencer par http:// ou https://'); r[k] = l; }
  if (b.couleur !== undefined) r.couleur = /^#[0-9a-f]{6}$/i.test(b.couleur) ? b.couleur : '#1e4fa3';
  for (const k of ['debut', 'fin']) if (b[k] !== undefined) { const d = dateValide(b[k]); if (d === null) throw Error('Date invalide.'); r[k] = d; }
  if (b.actif !== undefined) r.actif = b.actif !== false;
  if (r.actif === undefined) r.actif = true;
  if (b.ordre !== undefined) r.ordre = Math.max(0, Math.min(999, Number(b.ordre) || 0));
  return r;
}

const vuePartenaire = (p, gestion) => {
  const v = { id: p.id, nom: p.nom, niveau: p.niveau, niveauNom: NIVEAUX[p.niveau], slogan: p.slogan || '', description: p.description || '', offre: p.offre || '',
    secteur: p.secteur || '', adresse: p.adresse || '', telephone: p.telephone || '', whatsapp: p.whatsapp || '', email: p.email || '', site: p.site || '',
    facebook: p.facebook || '', instagram: p.instagram || '', boutonTexte: p.boutonTexte || '', couleur: p.couleur || '#1e4fa3', logo: !!p.logo, logoV: p.logoV || 0 };
  if (gestion) Object.assign(v, { actif: p.actif !== false, debut: p.debut || '', fin: p.fin || '', ordre: p.ordre || 0, clics: p.clics || 0, enLigne: enCours(p), creeLe: p.creeLe });
  return v;
};
const trierPartenaires = (a, b) => (ORDRE_NIVEAU[a.niveau] ?? 9) - (ORDRE_NIVEAU[b.niveau] ?? 9) || (a.ordre || 0) - (b.ordre || 0) || a.nom.localeCompare(b.nom, 'fr');
const trierAnnonces = (a, b) => (a.type === 'important' ? -1 : 0) - (b.type === 'important' ? -1 : 0) || (a.ordre || 0) - (b.ordre || 0) || String(b.creeLe).localeCompare(String(a.creeLe));

function lireCorpsBinaire(req, max) {
  return new Promise((ok, ko) => {
    const morceaux = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > max) { ko(Error('Logo trop volumineux (1 Mo maximum).')); req.destroy(); } else morceaux.push(c); });
    req.on('end', () => ok(Buffer.concat(morceaux))); req.on('error', ko);
  });
}
const natureImage = b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? 'image/png'
  : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'image/jpeg'
  : b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : '';

async function route(req, res, c) {
  const { db, utilisateur: u, json, lireCorps, sauverDB, uid, journal } = c;
  const url = new URL(req.url, 'http://localhost'), s = url.pathname.split('/').filter(Boolean), m = req.method;
  if (s[0] !== 'api' || !['annonces', 'partenaires'].includes(s[1])) return false;
  const envoyer = (code, data) => { json(res, code, data); return true; };
  const biblio = u?.role === 'bibliothecaire';
  const exigeBiblio = () => { if (biblio) return true; envoyer(u ? 403 : 401, { erreur: u ? 'Réservé aux bibliothécaires.' : 'Connexion requise.' }); return false; };
  db.annonces ||= []; db.partenaires ||= [];

  /* ---------- Annonces ---------- */
  if (s[1] === 'annonces') {
    if (s.length === 2 && m === 'GET') {
      if (url.searchParams.get('tous') === '1') { if (!exigeBiblio()) return true; return envoyer(200, db.annonces.slice().sort(trierAnnonces).map(a => ({ ...a, enLigne: enCours(a) }))); }
      return envoyer(200, db.annonces.filter(a => enCours(a)).sort(trierAnnonces).map(a => ({ id: a.id, texte: a.texte, type: a.type, icone: TYPES_ANNONCE[a.type] || 'ℹ️', lien: a.lien || '' })));
    }
    if (!exigeBiblio()) return true;
    if (s.length === 2 && m === 'POST') {
      if (db.annonces.length >= 200) return envoyer(409, { erreur: 'Trop d’annonces enregistrées : supprimez les anciennes.' });
      let a; try { a = lireAnnonce(await lireCorps(req)); } catch (e) { return envoyer(400, { erreur: e.message }); }
      a.id = uid(); a.creeLe = new Date().toISOString(); db.annonces.push(a); journal?.('Annonce publiée', u, a.texte.slice(0, 80)); sauverDB();
      return envoyer(201, a);
    }
    const i = db.annonces.findIndex(a => a.id === s[2]);
    if (i === -1) return envoyer(404, { erreur: 'Annonce introuvable.' });
    if (s.length === 3 && m === 'PUT') { try { db.annonces[i] = lireAnnonce(await lireCorps(req), db.annonces[i]); } catch (e) { return envoyer(400, { erreur: e.message }); } sauverDB(); return envoyer(200, db.annonces[i]); }
    if (s.length === 3 && m === 'DELETE') { const [a] = db.annonces.splice(i, 1); journal?.('Annonce supprimée', u, a.texte.slice(0, 80)); sauverDB(); return envoyer(200, { ok: true }); }
    return envoyer(404, { erreur: 'Route introuvable.' });
  }

  /* ---------- Partenaires ---------- */
  if (s.length === 2 && m === 'GET') {
    if (url.searchParams.get('tous') === '1') { if (!exigeBiblio()) return true; return envoyer(200, db.partenaires.slice().sort(trierPartenaires).map(p => vuePartenaire(p, true))); }
    return envoyer(200, db.partenaires.filter(p => enCours(p)).sort(trierPartenaires).map(p => vuePartenaire(p, false)));
  }
  const p = s[2] ? db.partenaires.find(x => x.id === s[2]) : null;
  if (s[3] === 'logo' && m === 'GET') {
    if (!p?.logo || (!enCours(p) && !biblio)) return envoyer(404, { erreur: 'Logo introuvable.' });
    const f = path.join(DOSSIER_LOGOS, p.id + '.' + MIMES[p.logoMime]);
    if (!fs.existsSync(f)) return envoyer(404, { erreur: 'Logo introuvable.' });
    res.writeHead(200, { 'Content-Type': p.logoMime, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(f).pipe(res); return true;
  }
  if (s[3] === 'clic' && m === 'POST') {
    if (!p || !enCours(p)) return envoyer(404, { erreur: 'Partenaire introuvable.' });
    const cle = (req.socket?.remoteAddress || 'local') + '|' + p.id, now = Date.now();
    if (now - (clicsParIP.get(cle) || 0) > 60000) { clicsParIP.set(cle, now); p.clics = (p.clics || 0) + 1; if (clicsParIP.size > 20000) clicsParIP.clear(); sauverDB(); }
    return envoyer(200, { ok: true });
  }
  if (!exigeBiblio()) return true;
  if (s.length === 2 && m === 'POST') {
    if (db.partenaires.length >= 300) return envoyer(409, { erreur: 'Nombre maximal de partenaires atteint.' });
    let x; try { x = lirePartenaire(await lireCorps(req)); } catch (e) { return envoyer(400, { erreur: e.message }); }
    x.id = uid(); x.creeLe = new Date().toISOString(); x.clics = 0; db.partenaires.push(x); journal?.('Partenaire ajouté', u, x.nom); sauverDB();
    return envoyer(201, vuePartenaire(x, true));
  }
  if (!p) return envoyer(404, { erreur: 'Partenaire introuvable.' });
  if (s.length === 3 && m === 'PUT') { try { Object.assign(p, lirePartenaire(await lireCorps(req), p)); } catch (e) { return envoyer(400, { erreur: e.message }); } sauverDB(); return envoyer(200, vuePartenaire(p, true)); }
  if (s.length === 3 && m === 'DELETE') {
    if (p.logo) fs.rm(path.join(DOSSIER_LOGOS, p.id + '.' + MIMES[p.logoMime]), { force: true }, () => {});
    db.partenaires.splice(db.partenaires.indexOf(p), 1); journal?.('Partenaire supprimé', u, p.nom); sauverDB(); return envoyer(200, { ok: true });
  }
  if (s[3] === 'logo' && m === 'POST') {
    let b; try { b = await lireCorpsBinaire(req, 1024 * 1024); } catch (e) { return envoyer(413, { erreur: e.message }); }
    const mime = natureImage(b); if (!mime) return envoyer(400, { erreur: 'Le logo doit être une image PNG, JPEG ou WebP.' });
    fs.mkdirSync(DOSSIER_LOGOS, { recursive: true });
    if (p.logo) fs.rmSync(path.join(DOSSIER_LOGOS, p.id + '.' + MIMES[p.logoMime]), { force: true });
    fs.writeFileSync(path.join(DOSSIER_LOGOS, p.id + '.' + MIMES[mime]), b);
    p.logo = true; p.logoMime = mime; p.logoV = Date.now(); sauverDB();
    return envoyer(201, { ok: true, logoV: p.logoV });
  }
  return envoyer(404, { erreur: 'Route introuvable.' });
}

module.exports = { route, TYPES_ANNONCE, NIVEAUX, enCours };
