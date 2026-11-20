/* OASIS — Espace bibliothécaire : diffusions en direct et en différé (1.34.0) */
window.OasisAdminDirect = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ETATS = { en_direct: '🔴 En direct', programmee: '📅 Programmée', terminee: '🎞️ Terminée', annulee: '✖ Annulée' };
  const SOURCES = { youtube: '▶ YouTube', facebook: 'ⓕ Facebook', video: '🎬 Cinémathèque', lien: '🎙️ Visioconférence' };
  let api, liste = [], videos = [], edition = null;
  const local = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const quand = iso => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function formulaire(d) {
    const s = d?.source || { type: 'youtube' };
    const dans1h = new Date(Date.now() + 3600000); dans1h.setMinutes(0, 0, 0);
    const valeur = s.type === 'youtube' ? (s.mediaId ? '' : 'https://www.youtube.com/watch?v=' + s.youtube) : s.url || '';
    return `<div class="panneau diff-form" id="diffForm">
      <h4>${d ? '✏️ Modifier la diffusion' : '➕ Programmer une diffusion'}</h4>
      <div class="diff-form-grille">
        <div class="champ champ-large"><label for="dfTitre">Titre *</label><input id="dfTitre" maxlength="160" value="${E(d?.titre)}" placeholder="Ex. : Conférence — L’histoire de la Révolution haïtienne"></div>
        <div class="champ"><label for="dfIntervenant">Intervenant(e)</label><input id="dfIntervenant" maxlength="160" value="${E(d?.intervenant)}" placeholder="Nom du conférencier"></div>
        <div class="champ"><label for="dfCategorie">Thème</label><input id="dfCategorie" maxlength="80" value="${E(d?.categorie)}" placeholder="Histoire, Sciences, Lecture…"></div>
        <div class="champ"><label for="dfDebut">Date et heure de début *</label><input id="dfDebut" type="datetime-local" value="${local(d?.debut || dans1h)}"></div>
        <div class="champ"><label for="dfDuree">Durée prévue (minutes)</label><input id="dfDuree" type="number" min="5" max="720" value="${d?.dureeMin || 60}"></div>
        <div class="champ champ-large"><span class="diff-etiquette">Type de diffusion</span>
          <div class="diff-choix"><label><input type="radio" name="dfMode" value="direct" ${d?.mode !== 'differe' ? 'checked' : ''}> <b>🔴 En direct</b><small>La conférence a lieu à cette heure (YouTube Live, Facebook Live, Zoom, Meet…)</small></label>
          <label><input type="radio" name="dfMode" value="differe" ${d?.mode === 'differe' ? 'checked' : ''}> <b>⏱️ En différé</b><small>Une vidéo enregistrée démarre pour tout le monde à l’heure prévue, puis reste à revoir</small></label></div></div>
        <div class="champ"><label for="dfSource">Source de la vidéo</label><select id="dfSource">
          <option value="youtube" ${s.type === 'youtube' && !s.mediaId ? 'selected' : ''}>Lien YouTube (direct ou vidéo)</option>
          <option value="facebook" ${s.type === 'facebook' ? 'selected' : ''}>Lien Facebook (direct ou vidéo)</option>
          <option value="video" ${s.mediaId ? 'selected' : ''}>Vidéo de la cinémathèque OASIS</option>
          <option value="fichier">Téléverser une nouvelle vidéo</option>
          <option value="lien" ${s.type === 'lien' ? 'selected' : ''}>Lien de visioconférence (Zoom, Meet, Teams…)</option></select></div>
        <div class="champ" id="dfValeurZone"></div>
        <div class="champ champ-large"><label for="dfDescription">Présentation</label><textarea id="dfDescription" rows="3" maxlength="3000">${E(d?.description)}</textarea></div>
        <div class="champ champ-large diff-coches"><span class="diff-etiquette">Prévenir tous les membres</span>
          <label><input type="checkbox" checked disabled> Dans leurs notifications OASIS et par un bandeau « En direct » (toujours)</label>
          <label><input type="checkbox" id="dfMailAnnonce" ${d ? (d.emailAnnonce ? 'checked' : '') : 'checked'}> Par email dès la publication</label>
          <label><input type="checkbox" id="dfMailDirect" ${d ? (d.emailDirect ? 'checked' : '') : 'checked'}> Par email au début de la diffusion</label>
          ${d && d.statut === 'programmee' ? '<label><input type="checkbox" id="dfReannoncer"> Renvoyer l’email d’annonce (si la date a changé)</label>' : ''}</div>
      </div>
      <div class="diff-actions"><button class="btn btn-bleu" id="dfEnregistrer">${d ? 'Enregistrer' : '📣 Programmer et prévenir les membres'}</button>${d ? '<button class="btn" id="dfAnnulerEdition">Annuler la modification</button>' : ''}</div>
      <p id="dfMsg" role="status" class="diff-msg"></p>
    </div>`;
  }
  function zoneValeur(type, d) {
    const z = document.getElementById('dfValeurZone'); if (!z) return;
    const s = d?.source || {};
    if (type === 'video') z.innerHTML = `<label for="dfValeur">Vidéo</label><select id="dfValeur">${videos.length ? videos.map(v => `<option value="${E(v.id)}" ${s.mediaId === v.id ? 'selected' : ''}>${E(v.titre)}${v.youtube && !v.fichier ? ' (YouTube)' : ''}</option>`).join('') : '<option value="">Aucune vidéo dans la cinémathèque</option>'}</select>`;
    else if (type === 'fichier') z.innerHTML = `<label for="dfFichier">Fichier vidéo (MP4 ou WebM, 300 Mo max)</label><input id="dfFichier" type="file" accept="video/mp4,video/webm"><small>La vidéo est aussi ajoutée à la cinémathèque.</small>`;
    else {
      const ex = { youtube: 'https://www.youtube.com/live/… ou https://youtu.be/…', facebook: 'https://www.facebook.com/…/videos/…', lien: 'https://zoom.us/j/… ou https://meet.google.com/…' }[type];
      const v = type === s.type && !s.mediaId ? (s.youtube ? 'https://www.youtube.com/watch?v=' + s.youtube : s.url || '') : '';
      z.innerHTML = `<label for="dfValeur">Lien</label><input id="dfValeur" type="url" value="${E(v)}" placeholder="${E(ex)}">${type === 'youtube' ? '<small>Pour un direct YouTube, programmez-le dans YouTube Studio et collez son lien ici (public ou non répertorié).</small>' : ''}`;
    }
  }
  function televerser(fichier, titre, msg) {
    return new Promise(async (ok, ko) => {
      try {
        const mo = await api('/medias', { method: 'POST', body: JSON.stringify({ type: 'video', titre, description: 'Vidéo diffusée dans les Diffusions OASIS.' }) });
        const x = new XMLHttpRequest(); x.open('POST', `/api/medias/${encodeURIComponent(mo.id)}/fichier`);
        x.setRequestHeader('Authorization', 'Bearer ' + (localStorage.getItem('oasis_jeton') || '')); x.setRequestHeader('Content-Type', fichier.type || 'video/mp4');
        x.upload.onprogress = e => { if (e.lengthComputable) msg(`Envoi de la vidéo : ${Math.round(e.loaded / e.total * 100)} %…`); };
        x.onload = () => x.status < 300 ? ok(mo.id) : ko(new Error((() => { try { return JSON.parse(x.responseText).erreur; } catch { return 'Envoi refusé (' + x.status + ')'; } })()));
        x.onerror = () => ko(new Error('Connexion interrompue pendant l’envoi.')); x.send(fichier);
      } catch (e) { ko(e); }
    });
  }
  function ligne(d) {
    const env = d.envois || {}, mails = ['annonce', 'direct'].filter(k => env[k]).map(k => env[k].note ? '📭 ' + E(env[k].note) : `✉️ ${k === 'annonce' ? 'annonce' : 'début'} : ${env[k].envoyes}${env[k].total ? '/' + env[k].total : ''}${env[k].enCours ? ' (en cours)' : ''}${env[k].echecs ? ' · ' + env[k].echecs + ' échec(s)' : ''}`).join(' · ');
    const peutRevoir = d.statut === 'terminee';
    return `<li class="diff-ligne diff-ligne-${E(d.statut)}">
      <div class="diff-ligne-infos"><span class="diff-badge">${ETATS[d.statut]}</span><b>${E(d.titre)}</b>
        <small>${E(quand(d.debut))} · ${d.dureeMin} min · ${d.mode === 'direct' ? 'direct' : 'différé'} · ${SOURCES[d.source.type]}${d.statut === 'en_direct' ? ` · 👁 ${d.spectateurs} en ligne` : ''}${d.vues ? ` · ${d.vues} spectateur(s) au total` : ''}${d.replay ? ' · 🎞️ rediffusion ajoutée' : ''}</small>
        ${mails ? `<small class="diff-envois">${mails}</small>` : ''}</div>
      <div class="diff-ligne-boutons">
        ${d.statut === 'programmee' ? `<button class="mini-btn" data-dact="demarrer" data-id="${E(d.id)}">▶ Démarrer maintenant</button>` : ''}
        ${d.statut === 'en_direct' ? `<button class="mini-btn" data-dact="terminer" data-id="${E(d.id)}">⏹ Terminer</button>` : ''}
        ${peutRevoir ? `<button class="mini-btn" data-dact="replay" data-id="${E(d.id)}">🎞️ ${d.replay ? 'Changer' : 'Ajouter'} la rediffusion</button>` : ''}
        <a class="mini-btn" href="/?diffusion=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">👁 Voir</a>
        ${['programmee', 'en_direct'].includes(d.statut) ? `<button class="mini-btn" data-dact="modifier" data-id="${E(d.id)}">✏️ Modifier</button><button class="mini-btn" data-dact="annuler" data-id="${E(d.id)}">✖ Annuler</button>` : ''}
        <button class="mini-btn danger" data-dact="supprimer" data-id="${E(d.id)}">🗑 Supprimer</button>
      </div></li>`;
  }
  async function contenu() {
    const r = await api('/diffusions'); liste = r.diffusions;
    try { videos = (await api('/medias?type=video')).filter(v => v.fichier || v.youtube).sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr')); } catch { videos = []; }
    const d = edition && liste.find(x => x.id === edition);
    return `<div class="section-titre"><h3>🎥 Diffusions en direct et en différé</h3></div>
      <p class="diff-intro">Diffusez une conférence en direct ou une vidéo à heure fixe. Tous les membres sont prévenus dans OASIS (notification, bandeau « En direct », alerte sur leur appareil s’ils l’ont activée)${r.emailsActifs ? ' et par email' : ''}. ${r.emailsActifs ? '' : '<b>L’envoi d’emails n’est pas configuré sur le serveur (variables BREVO_API_KEY et BREVO_SENDER_EMAIL) : les membres sont prévenus dans OASIS seulement.</b>'}</p>
      ${formulaire(d)}
      <div class="panneau" style="margin-top:16px"><h4>Diffusions (${liste.length})</h4>${liste.length ? `<ul class="diff-liste">${liste.map(ligne).join('')}</ul>` : '<p class="vide">Aucune diffusion pour le moment.</p>'}</div>`;
  }
  async function rafraichir() { const z = document.getElementById('zoneAdmin'); if (!z || !document.getElementById('diffForm')) return; z.innerHTML = await contenu(); brancher(); }
  function brancher() {
    const d = edition && liste.find(x => x.id === edition);
    const msg = t => { const m = document.getElementById('dfMsg'); if (m) m.textContent = t; };
    const sel = document.getElementById('dfSource'); if (!sel) return;
    zoneValeur(sel.value, d); sel.onchange = () => zoneValeur(sel.value, d);
    document.getElementById('dfAnnulerEdition')?.addEventListener('click', () => { edition = null; rafraichir(); });
    document.getElementById('dfEnregistrer').onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const titre = document.getElementById('dfTitre').value.trim(); if (!titre) throw new Error('Le titre est requis.');
        const debutLocal = document.getElementById('dfDebut').value; if (!debutLocal) throw new Error('Indiquez la date et l’heure.');
        let sourceType = sel.value, sourceValeur = document.getElementById('dfValeur')?.value || '';
        if (sourceType === 'fichier') {
          const f = document.getElementById('dfFichier').files[0]; if (!f) throw new Error('Choisissez le fichier vidéo.');
          sourceValeur = await televerser(f, titre, msg); sourceType = 'video';
        }
        const corps = { titre, intervenant: document.getElementById('dfIntervenant').value, categorie: document.getElementById('dfCategorie').value, description: document.getElementById('dfDescription').value,
          debut: new Date(debutLocal).toISOString(), dureeMin: +document.getElementById('dfDuree').value, mode: document.querySelector('[name=dfMode]:checked').value,
          sourceType, sourceValeur, emailAnnonce: document.getElementById('dfMailAnnonce').checked, emailDirect: document.getElementById('dfMailDirect').checked, reannoncer: !!document.getElementById('dfReannoncer')?.checked };
        msg('Enregistrement…');
        await api('/diffusions' + (d ? '/' + encodeURIComponent(d.id) : ''), { method: d ? 'PUT' : 'POST', body: JSON.stringify(corps) });
        edition = null; await rafraichir(); const m = document.getElementById('dfMsg'); if (m) m.textContent = d ? 'Diffusion modifiée ✅' : 'Diffusion programmée ✅ Les membres sont prévenus.';
      } catch (err) { msg('⚠️ ' + err.message); } finally { b.disabled = false; }
    };
    document.querySelectorAll('[data-dact]').forEach(btn => btn.onclick = async () => {
      const id = btn.dataset.id, x = liste.find(y => y.id === id), act = btn.dataset.dact;
      try {
        if (act === 'modifier') { edition = id; await rafraichir(); document.getElementById('diffForm')?.scrollIntoView({ behavior: 'smooth' }); return; }
        if (act === 'supprimer' && !confirm(`Supprimer définitivement « ${x.titre} » ? Cette action est irréversible.`)) return;
        if (act === 'annuler' && !confirm(`Annuler « ${x.titre} » ? Les membres ne la verront plus.`)) return;
        if (act === 'terminer' && !confirm(`Terminer la diffusion « ${x.titre} » maintenant ?`)) return;
        if (act === 'demarrer' && !confirm(`Démarrer « ${x.titre} » maintenant ? Les membres seront alertés.`)) return;
        if (act === 'replay') {
          const li = btn.closest('li'); if (li.querySelector('.diff-replay')) return;
          li.insertAdjacentHTML('beforeend', `<div class="diff-replay"><select data-rtype><option value="youtube">Lien YouTube de l’enregistrement</option><option value="video">Vidéo de la cinémathèque</option><option value="">Retirer la rediffusion</option></select>
            <input data-rlien type="url" placeholder="https://www.youtube.com/watch?v=…" value="${x.replay?.youtube ? 'https://www.youtube.com/watch?v=' + E(x.replay.youtube) : ''}">
            <select data-rvideo hidden>${videos.map(v => `<option value="${E(v.id)}">${E(v.titre)}</option>`).join('')}</select>
            <button class="mini-btn" data-rok>Enregistrer</button></div>`);
          const z = li.querySelector('.diff-replay'), t = z.querySelector('[data-rtype]');
          t.onchange = () => { z.querySelector('[data-rlien]').hidden = t.value !== 'youtube'; z.querySelector('[data-rvideo]').hidden = t.value !== 'video'; };
          z.querySelector('[data-rok]').onclick = async () => {
            try { const corps = t.value === 'youtube' ? { sourceType: 'youtube', sourceValeur: z.querySelector('[data-rlien]').value } : t.value === 'video' ? { sourceType: 'video', sourceValeur: z.querySelector('[data-rvideo]').value } : {};
              await api(`/diffusions/${encodeURIComponent(id)}/replay`, { method: 'POST', body: JSON.stringify(corps) }); await rafraichir(); } catch (err) { alert(err.message); }
          };
          return;
        } else await api(`/diffusions/${encodeURIComponent(id)}${act === 'supprimer' ? '' : '/' + act}`, { method: act === 'supprimer' ? 'DELETE' : 'POST', body: act === 'supprimer' ? undefined : '{}' });
        await rafraichir();
      } catch (err) { alert(err.message); }
    });
  }
  async function page(a) { api = a; edition = null; const html = await contenu(); setTimeout(brancher, 0); return html; }
  return { page };
})();
