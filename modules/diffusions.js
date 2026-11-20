'use strict';
/* OASIS — Diffusions en direct et en différé (1.34.0)
   Le bibliothécaire programme une conférence ou une vidéo :
   - en direct : YouTube Live, Facebook Live ou lien de visioconférence (Zoom, Meet, Teams, Jitsi…) ;
   - en différé : une vidéo (YouTube ou fichier de la cinémathèque) qui démarre pour tout le monde à l'heure prévue.
   Tous les membres sont prévenus dans OASIS (notifications + bandeau « En direct ») et, si l'envoi d'emails est
   configuré, par email (annonce à la publication, alerte au début), avec un lien de désabonnement.
   Aucun flux vidéo ne passe par le serveur OASIS : la vidéo est lue chez YouTube / Facebook, ou depuis la cinémathèque. */

const crypto = require('node:crypto');
const courriel = require('./courriel');

const MODES = ['direct', 'differe'];
const SOURCES = ['youtube', 'facebook', 'video', 'lien'];
const MARGE_DIRECT_MIN = 60;       // un direct se ferme seul 1 h après la durée prévue (sauf « Terminer »)
const PRESENCE_MS = 90000;         // un spectateur compte pendant 90 s après son dernier signal
const FUSEAU = 'America/Port-au-Prince';

const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const texte = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

/** Identifiant YouTube depuis un lien (watch, youtu.be, live, shorts, embed) ou l'identifiant seul. */
function idYoutube(v) {
  const s = String(v || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u; try { u = new URL(s); } catch { return ''; }
  if (!/(^|\.)youtube(-nocookie)?\.com$|(^|\.)youtu\.be$/i.test(u.hostname)) return '';
  if (/youtu\.be$/i.test(u.hostname)) return (u.pathname.slice(1).match(/^[\w-]{11}/) || [''])[0];
  const v2 = u.searchParams.get('v'); if (v2 && /^[\w-]{11}$/.test(v2)) return v2;
  return (u.pathname.match(/\/(?:live|embed|shorts|v)\/([\w-]{11})/) || ['', ''])[1];
}
/** Lien Facebook d'une vidéo ou d'un direct (seuls facebook.com et fb.watch sont acceptés). */
function lienFacebook(v) {
  let u; try { u = new URL(String(v || '').trim()); } catch { return ''; }
  return u.protocol === 'https:' && /(^|\.)facebook\.com$|^fb\.watch$/i.test(u.hostname) ? u.href : '';
}
/** Lien de visioconférence : https uniquement. */
function lienHttps(v) {
  let u; try { u = new URL(String(v || '').trim()); } catch { return ''; }
  return u.protocol === 'https:' ? u.href : '';
}

function fin(d) { return new Date(d.debut).getTime() + (d.dureeMin || 60) * 60000; }
/** programmee → en_direct → terminee (ou annulee). Le bibliothécaire peut démarrer plus tôt ou terminer plus tôt. */
function statut(d, t = Date.now()) {
  if (d.annuleeLe) return 'annulee';
  if (d.termineeLe) return 'terminee';
  const debut = new Date(d.debut).getTime();
  const limite = fin(d) + (d.mode === 'direct' ? MARGE_DIRECT_MIN * 60000 : 0);
  if (t >= limite) return 'terminee';
  if (d.demarreeLe || t >= debut) return 'en_direct';
  return 'programmee';
}
const dateLisible = iso => { try { return new Date(iso).toLocaleString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' (heure d’Haïti)'; } catch { return new Date(iso).toISOString(); } };

/** Source vérifiée à partir du formulaire ; renvoie { source } ou { erreur }. */
function lireSource(c, db, prefixe = '') {
  const type = c[prefixe + 'sourceType'] ?? c.source?.type;
  const valeur = c[prefixe + 'sourceValeur'] ?? c.source?.youtube ?? c.source?.url ?? c.source?.mediaId;
  if (type === 'youtube') { const id = idYoutube(valeur); return id ? { source: { type, youtube: id } } : { erreur: 'Lien YouTube invalide. Exemple : https://www.youtube.com/live/XXXXXXXXXXX' }; }
  if (type === 'facebook') { const url = lienFacebook(valeur); return url ? { source: { type, url } } : { erreur: 'Lien Facebook invalide (adresse https://www.facebook.com/… de la vidéo ou du direct).' }; }
  if (type === 'lien') { const url = lienHttps(valeur); return url ? { source: { type, url } } : { erreur: 'Lien de conférence invalide (adresse https:// requise).' }; }
  if (type === 'video') {
    const mo = (db.medias || []).find(m => m.id === valeur && m.type === 'video');
    if (!mo) return { erreur: 'Vidéo introuvable dans la cinémathèque.' };
    return { source: mo.youtube && !mo.fichier ? { type: 'youtube', youtube: mo.youtube, mediaId: mo.id } : { type: 'video', mediaId: mo.id } };
  }
  return { erreur: 'Choisissez une source : YouTube, Facebook, vidéo de la cinémathèque ou lien de conférence.' };
}

function creer(ctx) {
  const { db, sauverDB, uid, journal = () => {} } = ctx;
  const maintenant = ctx.maintenant || (() => new Date().toISOString());
  const heure = ctx.heure || (() => Date.now());
  const envoyer = ctx.envoyer || courriel.envoyer;
  const emailActif = ctx.emailActif || (() => courriel.actif());
  const site = () => (ctx.siteUrl || courriel.siteUrl)();
  const presences = new Map();      // en mémoire seulement : idDiffusion → Map(idUtilisateur → dernier signal)
  const liste = () => (db.diffusions ||= []);

  // Secret des liens de désabonnement : hors de db.parametres (qui est lisible publiquement)
  const secret = () => { if (!db.secretDiffusions) { db.secretDiffusions = crypto.randomBytes(24).toString('hex'); sauverDB(); } return db.secretDiffusions; };
  const signature = id => crypto.createHmac('sha256', secret()).update('desabonnement-diffusions:' + id).digest('hex').slice(0, 32);
  const lienDesabonnement = u => `${site()}/api/diffusions/desabonnement?u=${encodeURIComponent(u.id)}&s=${signature(u.id)}`;

  function spectateurs(id) {
    const p = presences.get(id); if (!p) return 0;
    const limite = heure() - PRESENCE_MS; for (const [k, t] of p) if (t < limite) p.delete(k);
    return p.size;
  }
  function vue(d, admin = false) {
    const o = { id: d.id, titre: d.titre, description: d.description, intervenant: d.intervenant, categorie: d.categorie, debut: d.debut, dureeMin: d.dureeMin, fin: new Date(fin(d)).toISOString(),
      mode: d.mode, source: d.source, replay: d.replay || null, statut: statut(d, heure()), demarreeLe: d.demarreeLe || null, termineeLe: d.termineeLe || null, spectateurs: spectateurs(d.id), vues: d.vues || 0 };
    if (admin) Object.assign(o, { emailAnnonce: !!d.emailAnnonce, emailDirect: !!d.emailDirect, envois: d.envois || {}, creeLe: d.creeLe });
    return o;
  }
  const ordre = { en_direct: 0, programmee: 1, terminee: 2, annulee: 3 };
  function trier(xs) {
    return xs.sort((a, b) => (ordre[a.statut] - ordre[b.statut]) || (a.statut === 'programmee' ? new Date(a.debut) - new Date(b.debut) : new Date(b.debut) - new Date(a.debut)));
  }

  /** Notifications calculées pour /api/notifications (tous les membres). */
  function notifications() {
    const t = heure(), jour = 86400000, out = [];
    for (const d of liste()) {
      const s = statut(d, t), quand = dateLisible(d.debut);
      if (s === 'en_direct') out.push({ id: 'diff-direct-' + d.id, type: 'diffusion-direct', icone: '🔴', titre: d.mode === 'direct' ? 'En direct maintenant' : 'Diffusion en cours', texte: `« ${d.titre} »${d.intervenant ? ' avec ' + d.intervenant : ''}. Rejoignez-nous !`, date: d.demarreeLe || d.debut, action: { diffusion: d.id } });
      else if (s === 'programmee' && t - new Date(d.creeLe).getTime() < 30 * jour) out.push({ id: 'diff-annonce-' + d.id + '-' + d.debut, type: 'diffusion', icone: '📅', titre: d.mode === 'direct' ? 'Conférence en direct programmée' : 'Diffusion programmée', texte: `« ${d.titre} » — ${quand}.`, date: d.creeLe, action: { diffusion: d.id } });
      else if (s === 'terminee' && d.replay && t - fin(d) < 14 * jour) out.push({ id: 'diff-replay-' + d.id, type: 'diffusion', icone: '🎞️', titre: 'Rediffusion disponible', texte: `Revoyez « ${d.titre} » quand vous voulez.`, date: d.replayLe || new Date(fin(d)).toISOString(), action: { diffusion: d.id } });
    }
    return out;
  }

  /* ---------- Emails : annonce à la publication, alerte au début du direct ---------- */
  let envoiEnCours = false;
  function destinataires() {
    return (db.utilisateurs || []).filter(u => u.email && /@/.test(u.email) && u.emailVerifie !== false && !u.desactive && !u.sansEmailDiffusion);
  }
  function message(d, u, genre) {
    const lien = `${site()}/?diffusion=${encodeURIComponent(d.id)}`, quand = dateLisible(d.debut);
    const titreMail = genre === 'direct' ? `🔴 C’est commencé : ${d.titre}` : `📅 ${d.mode === 'direct' ? 'Conférence en direct' : 'Diffusion'} sur OASIS : ${d.titre}`;
    const intro = genre === 'direct' ? 'La diffusion vient de commencer sur OASIS. Rejoignez-nous maintenant :' : `Une ${d.mode === 'direct' ? 'conférence en direct' : 'diffusion vidéo'} est programmée sur OASIS le ${quand}.`;
    const stop = lienDesabonnement(u);
    const txt = `Bonjour ${u.nom || ''},\n\n${intro}\n\n« ${d.titre} »${d.intervenant ? '\nAvec : ' + d.intervenant : ''}${d.description ? '\n\n' + d.description : ''}\n\nRegarder : ${lien}\n\n—\nOASIS Bibliothèque numérique intelligente\nNe plus recevoir ces annonces : ${stop}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10243e">
      <div style="background:linear-gradient(135deg,#06152f,#123f85);color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">
        <div style="font-size:22px;font-weight:800;letter-spacing:3px">OASIS</div><div style="color:#ffc76b;font-weight:700;font-size:13px">${genre === 'direct' ? '🔴 EN DIRECT' : '📅 Diffusion programmée'}</div></div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 14px 14px">
        <p>Bonjour ${E(u.nom || '')},</p><p>${E(intro)}</p>
        <h2 style="margin:16px 0 4px;font-size:20px">${E(d.titre)}</h2>${d.intervenant ? `<p style="margin:0;color:#5b6b82">Avec ${E(d.intervenant)}</p>` : ''}
        <p style="color:#5b6b82">${E(quand)}</p>${d.description ? `<p>${E(d.description).replace(/\n/g, '<br>')}</p>` : ''}
        <p style="text-align:center;margin:26px 0"><a href="${E(lien)}" style="background:${genre === 'direct' ? '#dc2626' : '#ff920c'};color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;display:inline-block">${genre === 'direct' ? '▶ Regarder maintenant' : 'Voir sur OASIS'}</a></p>
        <p style="font-size:12px;color:#8a99ad">Vous recevez cet email car vous êtes membre d’OASIS. <a href="${E(stop)}" style="color:#8a99ad">Ne plus recevoir les annonces de diffusion</a>.</p></div></div>`;
    return { a: u.email, nom: u.nom, sujet: titreMail, texte: txt, html };
  }
  async function envoyerA(d, genre) {
    d.envois ||= {};
    if (d.envois[genre]) return;
    if (!emailActif()) { d.envois[genre] = { date: maintenant(), envoyes: 0, echecs: 0, note: 'Envoi d’emails non configuré : notification dans OASIS seulement.' }; sauverDB(); return; }
    const dest = destinataires();
    d.envois[genre] = { date: maintenant(), envoyes: 0, echecs: 0, total: dest.length, enCours: true }; sauverDB();
    for (const u of dest) {
      try { const r = await envoyer(message(d, u, genre)); if (r?.ok) d.envois[genre].envoyes++; else d.envois[genre].echecs++; } catch { d.envois[genre].echecs++; }
      if (ctx.pauseEmail !== 0) await new Promise(ok => setTimeout(ok, ctx.pauseEmail ?? 250));
    }
    delete d.envois[genre].enCours; sauverDB();
    journal('Diffusion', `Emails « ${genre === 'direct' ? 'début du direct' : 'annonce'} » pour « ${d.titre} » : ${d.envois[genre].envoyes} envoyé(s)${d.envois[genre].echecs ? ', ' + d.envois[genre].echecs + ' échec(s)' : ''}`);
  }
  /** Passage périodique (chaque minute) : envoie les emails dus. */
  async function traiter() {
    if (envoiEnCours) return; envoiEnCours = true;
    try {
      for (const d of liste()) {
        const s = statut(d, heure());
        if (s === 'annulee' || s === 'terminee') continue;
        if (d.emailAnnonce && !d.envois?.annonce && s === 'programmee') await envoyerA(d, 'annonce');
        if (d.emailDirect && !d.envois?.direct && s === 'en_direct' && heure() - new Date(d.demarreeLe || d.debut).getTime() < 30 * 60000) await envoyerA(d, 'direct');
      }
    } finally { envoiEnCours = false; }
  }
  let minuteur = null;
  function demarrer() { if (minuteur) return; setTimeout(() => traiter().catch(e => console.error('Diffusions :', e.message)), 20000).unref?.(); minuteur = setInterval(() => traiter().catch(e => console.error('Diffusions :', e.message)), 60000); minuteur.unref?.(); }

  /* ---------- Saisie ---------- */
  function lireFormulaire(c, ancien = {}) {
    const d = { ...ancien };
    if (c.titre !== undefined) d.titre = texte(c.titre, 160);
    if (!d.titre) return { erreur: 'Le titre est requis.' };
    if (c.description !== undefined) d.description = texte(c.description, 3000);
    if (c.intervenant !== undefined) d.intervenant = texte(c.intervenant, 160);
    if (c.categorie !== undefined) d.categorie = texte(c.categorie, 80);
    if (c.mode !== undefined) { if (!MODES.includes(c.mode)) return { erreur: 'Mode invalide (direct ou différé).' }; d.mode = c.mode; }
    d.mode ||= 'direct';
    if (c.debut !== undefined) { const t = new Date(c.debut).getTime(); if (!t) return { erreur: 'Date et heure de début invalides.' }; d.debut = new Date(t).toISOString(); }
    if (!d.debut) return { erreur: 'Indiquez la date et l’heure de début.' };
    if (c.dureeMin !== undefined) { const n = parseInt(c.dureeMin, 10); if (!(n >= 5 && n <= 720)) return { erreur: 'Durée entre 5 et 720 minutes.' }; d.dureeMin = n; }
    d.dureeMin ||= 60;
    if (c.sourceType !== undefined || c.source !== undefined || !d.source) { const s = lireSource(c, db); if (s.erreur) return s; d.source = s.source; }
    if (d.mode === 'differe' && d.source.type === 'lien') return { erreur: 'Une diffusion en différé utilise une vidéo (YouTube ou cinémathèque), pas un lien de conférence.' };
    if (c.emailAnnonce !== undefined) d.emailAnnonce = !!c.emailAnnonce;
    if (c.emailDirect !== undefined) d.emailDirect = !!c.emailDirect;
    return { diffusion: d };
  }

  /* ---------- Routes ---------- */
  async function route(req, res, o) {
    const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
    if (!p.startsWith('/api/diffusions')) return false;
    const { utilisateur, json, lireCorps } = o;
    const biblio = utilisateur?.role === 'bibliothecaire';
    const seg = p.split('/').filter(Boolean);     // api, diffusions, id, action
    const trouver = () => liste().find(d => d.id === seg[2]);

    if (p === '/api/diffusions/desabonnement' && m === 'GET') {
      const u = (db.utilisateurs || []).find(x => x.id === url.searchParams.get('u'));
      const s = url.searchParams.get('s') || '';
      const ok = u && s.length === 32 && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(signature(u.id)));
      if (ok) { u.sansEmailDiffusion = true; sauverDB(); }
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OASIS</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#10243e"><h2>OASIS</h2><p>${ok ? 'C’est fait : vous ne recevrez plus d’emails pour les diffusions. Les annonces restent visibles dans vos notifications OASIS. Vous pouvez les réactiver depuis la page Diffusions.' : 'Lien invalide ou incomplet.'}</p><p><a href="/">Retour à OASIS</a></p></body>`);
      return true;
    }
    if (!utilisateur) { json(res, 401, { erreur: 'Connexion requise.' }); return true; }

    if (p === '/api/diffusions' && m === 'GET') {
      const xs = trier(liste().map(d => vue(d, biblio))).filter(d => biblio || d.statut !== 'annulee');
      const t = heure();
      json(res, 200, { diffusions: xs.filter(d => d.statut !== 'terminee' || biblio || t - new Date(d.fin).getTime() < 180 * 86400000).slice(0, biblio ? 200 : 60), emailsActifs: emailActif(), recoitEmails: !utilisateur.sansEmailDiffusion });
      return true;
    }
    if (p === '/api/diffusions/preferences' && m === 'PUT') {
      const c = await lireCorps(req); utilisateur.sansEmailDiffusion = !c.recevoirEmails; sauverDB();
      json(res, 200, { recoitEmails: !utilisateur.sansEmailDiffusion }); return true;
    }
    if (p === '/api/diffusions' && m === 'POST') {
      if (!biblio) { json(res, 403, { erreur: 'Réservé au bibliothécaire.' }); return true; }
      const r = lireFormulaire(await lireCorps(req));
      if (r.erreur) { json(res, 400, { erreur: r.erreur }); return true; }
      const d = { id: uid(), ...r.diffusion, creePar: utilisateur.id, creeLe: maintenant(), envois: {}, vues: 0 };
      if (d.emailAnnonce === undefined) d.emailAnnonce = true;
      if (d.emailDirect === undefined) d.emailDirect = true;
      liste().push(d); sauverDB(); journal('Diffusion', `Programmée : « ${d.titre} » (${dateLisible(d.debut)})`);
      setTimeout(() => traiter().catch(() => {}), ctx.delaiTraitement ?? 3000).unref?.();
      json(res, 201, vue(d, true)); return true;
    }
    const d = seg[2] && !['desabonnement', 'preferences'].includes(seg[2]) ? trouver() : null;
    if (seg[2] && !d) { json(res, 404, { erreur: 'Diffusion introuvable.' }); return true; }

    if (seg.length === 3 && m === 'GET') {
      if (d.annuleeLe && !biblio) { json(res, 404, { erreur: 'Cette diffusion a été annulée.' }); return true; }
      json(res, 200, vue(d, biblio)); return true;
    }
    if (seg[3] === 'presence' && m === 'POST') {
      if (statut(d, heure()) !== 'en_direct') { json(res, 200, { spectateurs: 0 }); return true; }
      if (!presences.has(d.id)) presences.set(d.id, new Map());
      const p2 = presences.get(d.id); if (!p2.has(utilisateur.id)) { d.vues = (d.vues || 0) + 1; }
      p2.set(utilisateur.id, heure());
      json(res, 200, { spectateurs: spectateurs(d.id) }); return true;
    }
    if (!biblio) { json(res, 403, { erreur: 'Réservé au bibliothécaire.' }); return true; }

    if (seg.length === 3 && m === 'PUT') {
      const c = await lireCorps(req);
      const r = lireFormulaire(c, d);
      if (r.erreur) { json(res, 400, { erreur: r.erreur }); return true; }
      const avant = d.debut; Object.assign(d, r.diffusion);
      if (d.debut !== avant && statut(d, heure()) === 'programmee') { d.envois ||= {}; delete d.envois.direct; if (c.reannoncer) delete d.envois.annonce; }
      sauverDB(); journal('Diffusion', `Modifiée : « ${d.titre} »`); json(res, 200, vue(d, true)); return true;
    }
    if (seg.length === 3 && m === 'DELETE') {
      db.diffusions = liste().filter(x => x !== d); presences.delete(d.id); sauverDB(); journal('Diffusion', `Supprimée : « ${d.titre} »`);
      json(res, 200, { ok: true }); return true;
    }
    if (seg[3] === 'demarrer' && m === 'POST') {
      if (d.annuleeLe) { json(res, 400, { erreur: 'Diffusion annulée.' }); return true; }
      d.demarreeLe = maintenant(); delete d.termineeLe;
      if (new Date(d.debut).getTime() > heure()) { d.debutPrevu = d.debut; d.debut = d.demarreeLe; } // démarrage anticipé : la durée prévue court à partir de maintenant
      sauverDB(); journal('Diffusion', `Démarrée : « ${d.titre} »`); setTimeout(() => traiter().catch(() => {}), ctx.delaiTraitement ?? 1000).unref?.();
      json(res, 200, vue(d, true)); return true;
    }
    if (seg[3] === 'terminer' && m === 'POST') {
      d.termineeLe = maintenant(); presences.delete(d.id); sauverDB(); journal('Diffusion', `Terminée : « ${d.titre} »`);
      json(res, 200, vue(d, true)); return true;
    }
    if (seg[3] === 'annuler' && m === 'POST') {
      d.annuleeLe = maintenant(); presences.delete(d.id); sauverDB(); journal('Diffusion', `Annulée : « ${d.titre} »`);
      json(res, 200, vue(d, true)); return true;
    }
    if (seg[3] === 'replay' && m === 'POST') {
      const c = await lireCorps(req);
      if (!c.sourceType) { delete d.replay; delete d.replayLe; }
      else { const s = lireSource(c, db); if (s.erreur) { json(res, 400, { erreur: s.erreur }); return true; } if (s.source.type === 'lien') { json(res, 400, { erreur: 'La rediffusion doit être une vidéo.' }); return true; } d.replay = s.source; d.replayLe = maintenant(); }
      sauverDB(); journal('Diffusion', `Rediffusion ${d.replay ? 'ajoutée' : 'retirée'} : « ${d.titre} »`); json(res, 200, vue(d, true)); return true;
    }
    json(res, 404, { erreur: 'Action inconnue.' }); return true;
  }

  return { route, notifications, traiter, demarrer, statut, vue };
}

module.exports = { creer, idYoutube, lienFacebook, lienHttps, statut, lireSource, MODES, SOURCES };
