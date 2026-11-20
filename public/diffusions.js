/* OASIS — Diffusions en direct et en différé (1.34.0)
   Page « Diffusions » des membres, lecteur (YouTube, Facebook, vidéo de la cinémathèque, lien de conférence),
   bandeau « En direct » en haut du site et alertes du navigateur. */
window.OasisDirect = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let minuteurs = [];
  const nettoyer = () => { minuteurs.forEach(clearInterval); minuteurs = []; };
  const quand = iso => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const ETATS = { en_direct: ['🔴', 'En direct', 'direct'], programmee: ['📅', 'À venir', 'avenir'], terminee: ['🎞️', 'Terminée', 'fini'], annulee: ['✖', 'Annulée', 'annule'] };
  const SOURCES = { youtube: 'YouTube', facebook: 'Facebook', video: 'Cinémathèque OASIS', lien: 'Visioconférence' };
  function rebours(iso) {
    let s = Math.max(0, Math.round((new Date(iso) - Date.now()) / 1000));
    const j = Math.floor(s / 86400); s -= j * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
    return j ? `${j} j ${h} h ${m} min` : h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s).padStart(2, '0')} s`;
  }

  /* ---------- Liste ---------- */
  function carte(d) {
    const [ic, lib, cl] = ETATS[d.statut] || ETATS.programmee;
    const vignette = (d.replay?.youtube || d.source?.youtube) ? `<img src="https://i.ytimg.com/vi/${encodeURIComponent(d.replay?.youtube || d.source.youtube)}/hqdefault.jpg" alt="" loading="lazy">` : (d.replay?.mediaId || d.source?.mediaId) ? `<img src="/api/medias/${encodeURIComponent(d.replay?.mediaId || d.source.mediaId)}/vignette" alt="" loading="lazy" data-diff-img>` : '';
    return `<button class="diff-carte diff-${cl}" data-diffusion="${E(d.id)}">
      <div class="diff-visuel">${vignette}<span class="diff-etat diff-etat-${cl}">${ic} ${lib}</span>${d.statut === 'en_direct' && d.spectateurs ? `<span class="diff-spect">👁 ${d.spectateurs}</span>` : ''}</div>
      <div class="diff-infos"><b>${E(d.titre)}</b>${d.intervenant ? `<span>avec ${E(d.intervenant)}</span>` : ''}
        <small>${d.statut === 'programmee' ? '🗓️ ' + E(quand(d.debut)) + ` · dans <span data-rebours="${E(d.debut)}">${rebours(d.debut)}</span>` : d.statut === 'en_direct' ? (d.mode === 'direct' ? 'Diffusion en direct' : 'Diffusion en différé') + ' · ' + SOURCES[d.source.type] : E(quand(d.debut)) + (d.replay || ['youtube', 'video'].includes(d.source.type) ? ' · ▶ à revoir' : '')}</small></div>
    </button>`;
  }
  async function render(api, moi, id) {
    nettoyer();
    if (id) return ouvrir(api, moi, id);
    const r = await api('/diffusions');
    const xs = r.diffusions.filter(d => d.statut !== 'annulee');
    const direct = xs.filter(d => d.statut === 'en_direct'), avenir = xs.filter(d => d.statut === 'programmee'), fini = xs.filter(d => d.statut === 'terminee');
    setTimeout(() => brancherListe(api, moi, r), 0);
    const alertes = 'Notification' in window ? (Notification.permission === 'granted' ? '<span class="diff-ok">🔔 Alertes activées sur cet appareil</span>' : Notification.permission === 'denied' ? '<small>Alertes bloquées par le navigateur pour ce site.</small>' : '<button class="mini-btn" id="diffAlertes">🔔 M’alerter sur cet appareil</button>') : '';
    return `<div class="section-titre"><h3>🎥 Diffusions et conférences</h3></div>
      <p class="diff-intro">Conférences en direct et vidéos diffusées à heure fixe pour tous les membres. Vous êtes prévenu dans vos notifications${r.emailsActifs ? ' et par email' : ''} quand une diffusion est programmée et quand elle commence.</p>
      <div class="diff-prefs">${alertes}${r.emailsActifs ? `<label><input type="checkbox" id="diffEmails" ${r.recoitEmails ? 'checked' : ''}> Recevoir les annonces par email</label>` : ''}</div>
      ${direct.length ? `<h4 class="diff-groupe">🔴 En ce moment</h4><div class="diff-grille">${direct.map(carte).join('')}</div>` : ''}
      <h4 class="diff-groupe">📅 À venir</h4>${avenir.length ? `<div class="diff-grille">${avenir.map(carte).join('')}</div>` : '<p class="vide">Aucune diffusion programmée pour le moment. Vous serez prévenu dès qu’une conférence sera annoncée.</p>'}
      ${fini.length ? `<h4 class="diff-groupe">🎞️ Rediffusions et diffusions passées</h4><div class="diff-grille">${fini.map(carte).join('')}</div>` : ''}`;
  }
  function brancherListe(api, moi, r) {
    const zone = document.getElementById('zonePrincipale');
    zone.querySelectorAll('[data-diff-img]').forEach(i => i.addEventListener('error', () => i.remove(), { once: true }));
    zone.querySelectorAll('[data-diffusion]').forEach(b => b.onclick = async () => { zone.innerHTML = await ouvrir(api, moi, b.dataset.diffusion); });
    document.getElementById('diffAlertes')?.addEventListener('click', async () => { await activerAlertes(); zone.innerHTML = await render(api, moi); });
    document.getElementById('diffEmails')?.addEventListener('change', async e => { try { await api('/diffusions/preferences', { method: 'PUT', body: JSON.stringify({ recevoirEmails: e.target.checked }) }); } catch (err) { e.target.checked = !e.target.checked; alert(err.message); } });
    minuteurs.push(setInterval(() => { if (!document.querySelector('[data-rebours]')) return nettoyer(); document.querySelectorAll('[data-rebours]').forEach(x => { x.textContent = rebours(x.dataset.rebours); if (new Date(x.dataset.rebours) <= Date.now()) x.textContent = 'maintenant'; }); }, 1000));
  }

  /* ---------- Lecteur ---------- */
  const jeton = () => localStorage.getItem('oasis_jeton') || '';
  function lecteur(src, d, enCours) {
    if (!src) return '';
    // En différé, la vidéo démarre pour tout le monde à l'heure prévue : on rejoint au bon moment.
    const decalage = enCours && d.mode === 'differe' ? Math.max(0, Math.floor((Date.now() - new Date(d.debut)) / 1000)) : 0;
    if (src.type === 'youtube') return `<div class="diff-cadre"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(src.youtube)}?rel=0&autoplay=1&playsinline=1${decalage ? '&start=' + decalage : ''}" title="${E(d.titre)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    if (src.type === 'facebook') return `<div class="diff-cadre"><iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(src.url)}&show_text=false&autoplay=true" title="${E(d.titre)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><p class="diff-note">Diffusé depuis Facebook. Si la vidéo ne s’affiche pas, <a href="${E(src.url)}" target="_blank" rel="noopener">ouvrez-la sur Facebook ↗</a>.</p>`;
    if (src.type === 'video') return `<div class="diff-cadre"><video id="diffVideo" controls playsinline autoplay preload="metadata" data-decalage="${decalage}" src="/api/medias/${encodeURIComponent(src.mediaId)}/fichier?jeton=${encodeURIComponent(jeton())}"></video></div>${decalage ? '<button class="mini-btn" id="diffResync">⏩ Revenir au direct</button>' : ''}`;
    if (src.type === 'lien') return `<div class="diff-salle"><span>🎙️</span><b>La conférence se déroule en visioconférence.</b><p>Cliquez pour rejoindre la salle (Zoom, Google Meet, Teams…). Elle s’ouvre dans un nouvel onglet.</p>
      <a class="btn btn-bleu" href="${E(src.url)}" target="_blank" rel="noopener">Rejoindre la conférence ↗</a></div>`;
    return '';
  }
  function agenda(d) {
    const f = x => new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lien = location.origin + '/?diffusion=' + encodeURIComponent(d.id);
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OASIS//Diffusions//FR', 'BEGIN:VEVENT', 'UID:' + d.id + '@oasis', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(d.debut), 'DTEND:' + f(d.fin),
      'SUMMARY:' + (d.titre + (d.intervenant ? ' — ' + d.intervenant : '')).replace(/[,;\\]/g, m => '\\' + m), 'DESCRIPTION:' + ('Sur OASIS : ' + lien).replace(/[,;\\]/g, m => '\\' + m), 'URL:' + lien,
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Bientôt sur OASIS', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'oasis-diffusion.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function ouvrir(api, moi, id) {
    nettoyer();
    let d; try { d = await api('/diffusions/' + encodeURIComponent(id)); } catch (e) { return `<div class="erreur">${E(e.message)}</div><button class="mini-btn" data-vue-retour>← Toutes les diffusions</button>`; }
    const [ic, lib, cl] = ETATS[d.statut] || ETATS.programmee;
    const enCours = d.statut === 'en_direct', fini = d.statut === 'terminee';
    const revoir = fini ? (d.replay || (['youtube', 'video'].includes(d.source.type) ? d.source : null)) : null;
    let corps;
    if (enCours) corps = lecteur(d.source, d, true);
    else if (fini) corps = revoir ? lecteur(revoir, d, false) : '<div class="diff-salle"><span>🎞️</span><b>Cette diffusion est terminée.</b><p>La rediffusion sera ajoutée ici dès qu’elle sera disponible. Vous en serez averti.</p></div>';
    else if (d.statut === 'annulee') corps = '<div class="diff-salle"><span>✖</span><b>Cette diffusion a été annulée.</b></div>';
    else corps = `<div class="diff-salle diff-attente"><span>⏳</span><b>Début dans <span data-rebours-ouvert="${E(d.debut)}">${rebours(d.debut)}</span></b><p>${E(quand(d.debut))}. Restez sur cette page : la diffusion s’affichera ici automatiquement.</p>
      <button class="btn" id="diffAgenda">🗓️ Ajouter à mon agenda</button></div>`;
    setTimeout(() => brancherLecteur(api, moi, d), 0);
    return `<button class="mini-btn" data-vue-retour>← Toutes les diffusions</button>
      <article class="diff-page">
        <div class="diff-tete"><span class="diff-etat diff-etat-${cl}">${ic} ${lib}</span>${enCours ? `<span class="diff-spect" id="diffSpect">👁 ${d.spectateurs || 1} en ligne</span>` : ''}<small>${d.mode === 'direct' ? 'En direct' : 'En différé'} · ${SOURCES[(revoir || d.source).type]}</small></div>
        <h2>${E(d.titre)}</h2>${d.intervenant ? `<p class="diff-intervenant">avec <b>${E(d.intervenant)}</b></p>` : ''}
        ${corps}
        <p class="diff-date">🗓️ ${E(quand(d.debut))} · ${d.dureeMin} min${d.categorie ? ' · ' + E(d.categorie) : ''}</p>
        ${d.description ? `<div class="diff-description">${E(d.description).replace(/\n/g, '<br>')}</div>` : ''}
      </article>`;
  }
  function brancherLecteur(api, moi, d) {
    const zone = document.getElementById('zonePrincipale');
    zone.querySelectorAll('[data-vue-retour]').forEach(b => b.onclick = async () => { zone.innerHTML = await render(api, moi); });
    document.getElementById('diffAgenda')?.addEventListener('click', () => agenda(d));
    const v = document.getElementById('diffVideo');
    if (v) {
      const caler = () => { const dec = Math.max(0, (Date.now() - new Date(d.debut)) / 1000); if (+v.dataset.decalage && dec < (v.duration || Infinity)) v.currentTime = dec; };
      v.addEventListener('loadedmetadata', caler, { once: true });
      document.getElementById('diffResync')?.addEventListener('click', () => { caler(); v.play().catch(() => {}); });
    }
    if (d.statut === 'en_direct') {
      const signal = async () => { try { const r = await api('/diffusions/' + encodeURIComponent(d.id) + '/presence', { method: 'POST', body: '{}' }); const s = document.getElementById('diffSpect'); if (s) s.textContent = `👁 ${r.spectateurs} en ligne`; } catch {} };
      signal(); minuteurs.push(setInterval(() => document.getElementById('diffSpect') ? signal() : nettoyer(), 60000));
    }
    if (d.statut === 'programmee') {
      // Compte à rebours ; à l'heure dite, la page se recharge et affiche la diffusion.
      minuteurs.push(setInterval(async () => {
        const x = document.querySelector('[data-rebours-ouvert]'); if (!x) return nettoyer();
        x.textContent = rebours(d.debut);
        if (new Date(d.debut) <= Date.now() || Date.now() % 30000 < 1000) {
          try { const n = await api('/diffusions/' + encodeURIComponent(d.id)); if (n.statut !== 'programmee' && document.querySelector('[data-rebours-ouvert]')) zone.innerHTML = await ouvrir(api, moi, d.id); else if (n.debut !== d.debut) { d.debut = n.debut; x.dataset.reboursOuvert = n.debut; } } catch {}
        }
      }, 1000));
    }
  }

  /* ---------- Bandeau « En direct » et alertes ---------- */
  const vues = () => { try { return JSON.parse(localStorage.getItem('oasis-diff-alertes') || '[]'); } catch { return []; } };
  async function activerAlertes() {
    if (!('Notification' in window)) return;
    try { await Notification.requestPermission(); } catch {}
  }
  async function alerter(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const deja = vues(); if (deja.includes(n.id)) return;
    try { localStorage.setItem('oasis-diff-alertes', JSON.stringify([...deja, n.id].slice(-50))); } catch {}
    const options = { body: n.texte, icon: '/logo.png', badge: '/logo.png', tag: n.id, data: { url: '/?diffusion=' + encodeURIComponent(n.action.diffusion) } };
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification('OASIS — ' + n.titre, options); } catch {}
    try { const x = new Notification('OASIS — ' + n.titre, options); x.onclick = () => { window.focus(); location.href = options.data.url; }; } catch {}
  }
  /** Appelé à chaque rafraîchissement des notifications (toutes les 2 min). */
  function suivre(notifs, ouvrirDiffusion) {
    const directs = (notifs || []).filter(n => n.type === 'diffusion-direct');
    directs.forEach(alerter);
    let b = document.getElementById('bandeauDirect');
    const fermes = (() => { try { return sessionStorage.getItem('oasis-bandeau-direct') || ''; } catch { return ''; } })();
    const n = directs[0];
    if (!n || fermes === n.id) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'bandeauDirect'; b.className = 'bandeau-direct'; b.setAttribute('role', 'status'); const entete = document.querySelector('.principal .entete'); if (!entete) return; entete.insertAdjacentElement('afterend', b); }
    b.innerHTML = `<span class="pastille-direct">● ${E(n.titre.toUpperCase())}</span><span class="bandeau-direct-texte">${E(n.texte)}</span><button class="btn-direct" type="button">▶ Regarder</button><button class="bandeau-direct-fermer" type="button" aria-label="Masquer">✕</button>`;
    b.querySelector('.btn-direct').onclick = () => ouvrirDiffusion(n.action.diffusion);
    b.querySelector('.bandeau-direct-fermer').onclick = () => { try { sessionStorage.setItem('oasis-bandeau-direct', n.id); } catch {} b.remove(); };
  }
  return { render, ouvrir, suivre, activerAlertes, quitter: nettoyer };
})();
