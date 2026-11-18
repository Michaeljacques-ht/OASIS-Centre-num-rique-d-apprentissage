/* OASIS 1.31.0 — Espace bibliothécaire : collecte automatique d'ouvrages du domaine public. */
window.OasisAdminCollecte = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = x => Number(x || 0).toLocaleString('fr-FR');
  let api, minuteur;
  const SOURCES = [
    ['gutenberg', 'Project Gutenberg', 'classiques du domaine public'], ['wikisource', 'Wikisource', 'textes du domaine public relus par des bénévoles'],
    ['ecampus', 'eCampusOntario Open Library', 'manuels universitaires libres'], ['zenodo', 'Zenodo', 'livres de recherche en libre accès'],
    ['hal', 'HAL', 'ouvrages de la recherche française en libre accès'], ['oapen', 'OAPEN Library', 'livres universitaires européens en libre accès']];

  async function page(a) {
    api = a;
    const d = await api('/collecte').catch(e => ({ erreur: e.statut === 404 ? 'La collecte automatique est absente du serveur déployé : mettez à jour server.js et le dossier modules, puis redéployez.' : e.message }));
    if (d.erreur) return `<div class="section-titre"><h3>🤖 Collecte automatique</h3></div><p class="vide">${E(d.erreur)}</p>`;
    clearInterval(minuteur); minuteur = setInterval(() => { if (document.getElementById('collectePage')) { rafraichir(); rafraichirMedias(); } else clearInterval(minuteur); }, 30000);
    setTimeout(() => { brancher(); brancherMedias(); }, 0);
    const dm = await api('/collecte/medias').catch(() => null);
    return `<div id="collectePage">${contenu(d)}</div><div id="collecteMediasPage">${dm ? contenuMedias(dm) : ''}</div>`;
  }

  function contenu(d) {
    const r = d.reglages, pct = Math.min(100, Math.round(d.total / r.objectif * 1000) / 10);
    const etat = !r.actif ? ['⏸️', 'Suspendue', 'gris'] : d.pause ? ['⚠️', d.pause, 'orange'] : d.restant === 0 ? ['🎉', 'Objectif atteint', 'vert'] : d.enCours ? ['⏳', 'Import en cours…', 'bleu'] : ['✅', 'Active — import continu jour et nuit', 'vert'];
    return `<div class="section-titre"><h3>🤖 Collecte automatique d’ouvrages</h3></div>
      <p style="color:var(--gris);margin-bottom:14px">Le serveur importe en continu des livres en français du <b>domaine public</b> ou sous licence libre <b>CC BY / CC BY-SA</b> (classiques, manuels et ouvrages universitaires), en étalant les imports sur la journée pour atteindre l’objectif à la date choisie. Les doublons et les livres encore protégés sont ignorés.</p>
      <div class="panneau collecte-etat collecte-${etat[2]}"><span class="collecte-icone">${etat[0]}</span><div><b>${E(etat[1])}</b><small>${d.dernierPassage ? 'Dernier passage : ' + new Date(d.dernierPassage).toLocaleString('fr-FR') : 'Premier passage dans quelques minutes'}${d.espaceLibreMo != null ? ' · Espace disque libre : ' + n(d.espaceLibreMo) + ' Mo' : ''}</small></div></div>
      <div class="panneau" style="margin:14px 0">
        <div class="collecte-objectif"><b>${n(d.total)}</b> / ${n(r.objectif)} ouvrages <span>(${pct} %)</span></div>
        <div class="collecte-barre"><span style="width:${pct}%"></span></div>
        <div class="collecte-chiffres">
          <div><b>${n(d.restant)}</b><small>restants</small></div>
          <div><b>${n(d.joursRestants || 0)}</b><small>jours jusqu’au ${new Date(r.dateCible + 'T12:00').toLocaleDateString('fr-FR')}</small></div>
          <div><b>${n(d.parJour)}</b><small>à importer par jour</small></div>
          <div><b>${n(d.aujourdhui)}</b><small>importés aujourd’hui</small></div>
          <div><b>${n(d.importesAuto)}</b><small>importés automatiquement</small></div>
        </div>
        ${d.epuise ? '<p class="collecte-alerte">Les sources configurées sont épuisées : ajoutez des ouvrages manuellement ou activez une autre source.</p>' : ''}
      </div>
      <div class="panneau" style="margin-bottom:14px"><h4 style="margin-bottom:10px">Réglages</h4>
        <div class="admin-form-grid">
          <div class="champ"><label><input type="checkbox" id="colActif" ${r.actif ? 'checked' : ''}> Collecte active</label></div>
          <div class="champ"><label for="colObjectif">Objectif (nombre total d’ouvrages)</label><input id="colObjectif" type="number" min="100" max="200000" value="${r.objectif}"></div>
          <div class="champ"><label for="colDate">Date cible</label><input id="colDate" type="date" value="${E(r.dateCible)}"></div>
          <div class="champ"><label for="colMax">Maximum par heure</label><input id="colMax" type="number" min="1" max="60" value="${r.maxParHeure}"></div>
          <div class="champ"><label for="colEspace">Arrêt si espace libre &lt; (Mo)</label><input id="colEspace" type="number" min="100" value="${r.espaceMinMo}"></div>
          <div class="champ" style="grid-column:1/-1"><span>Sources (livres en français, domaine public ou licence CC BY / CC BY-SA)</span><div class="collecte-sources">${SOURCES.map(([k, nom, desc]) => { const c = d.sources[k]; return `<label><input type="checkbox" data-source="${k}" ${r.sources[k] ? 'checked' : ''}> <span><b>${nom}</b><small>${desc}${c ? ` · ${c.fini ? 'parcours terminé' : c.pause ? 'indisponible, nouvel essai dans 1 h' : 'en cours (' + E(c.position) + ')'}` : ''}</small></span></label>`; }).join('')}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-bleu" id="colEnregistrer">Enregistrer</button><button class="btn" id="colLancer">▶ Importer 5 ouvrages maintenant</button></div>
        <p id="colMsg" role="status" style="margin-top:8px;font-size:13.5px"></p>
      </div>
      <div class="panneau"><h4 style="margin-bottom:8px">Derniers imports</h4>
        ${d.historique.length ? `<ul class="collecte-historique">${d.historique.map(h => `<li class="collecte-${h.statut}"><span>${h.statut === 'ok' ? '✅' : h.statut === 'echec' ? '❌' : '⚠️'}</span><div><b>${E(h.titre || h.message)}</b>${h.auteur ? ' — ' + E(h.auteur) : ''}<small>${new Date(h.date).toLocaleString('fr-FR')} · ${E(h.source || '')}${h.statut === 'echec' ? ' · ' + E(h.message) : ''}</small></div></li>`).join('')}</ul>` : '<p class="vide">Aucun import pour le moment.</p>'}
      </div>`;
  }

  const ICONES = { videos: '🎬', podcasts: '🎙️', livresAudio: '🎧', cartes: '🗺️', ressources: '🔎' };
  const DETAILS = { videos: 'Nouvelles vidéos de chaînes éducatives (YouTube intégré)', podcasts: 'Émissions éducatives (France Culture, France Inter…)', livresAudio: 'LibriVox, domaine public, en français', cartes: 'Wikimedia Commons, domaine public ou licence libre, avec vignette', ressources: 'Encyclopédies, dictionnaires, bases scientifiques, labos virtuels, outils, sites officiels et administratifs' };
  function contenuMedias(d) {
    const r = d.reglages;
    return `<div class="section-titre" style="margin-top:22px"><h3>🎞️ Collecte des médias et des ressources</h3></div>
      <p style="color:var(--gris);margin-bottom:12px">Chaque jour, le serveur ajoute aussi des vidéos, podcasts, livres audio, cartes et ressources documentaires, en étalant les ajouts sur la journée. Les vidéos et les podcasts sont lus en ligne depuis leur éditeur : rien n’est copié sur le serveur.</p>
      <div class="panneau">
        <label class="collecte-actif-medias"><input type="checkbox" id="colMedActif" ${r.actif ? 'checked' : ''}> Collecte des médias et ressources active</label>
        <div class="collecte-types">${Object.keys(d.noms).map(k => `<div class="collecte-type">
          <div class="collecte-type-tete"><span>${ICONES[k]}</span><div><b>${d.noms[k]}</b><small>${DETAILS[k]}</small></div></div>
          <div class="collecte-type-chiffres"><span><b>${(d.aujourdhui[k] || 0)}</b> aujourd’hui</span><span><b>${d.totaux[k] || 0}</b> ajoutés au total</span><span><b>${d.compte[k] || 0}</b> dans OASIS</span></div>
          <label>Par jour : <input type="number" min="0" max="200" data-quota="${k}" value="${r.quotas[k]}"></label>
          ${d.epuises[k] ? '<small class="collecte-epuise">Plus rien de nouveau pour le moment : la source sera revérifiée.</small>' : ''}
          <button class="mini-btn" data-lancer-type="${k}">▶ Ajouter 3 maintenant</button>
        </div>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-bleu" id="colMedEnregistrer">Enregistrer</button><button class="btn" id="colVignettesCartes">🗺️ Créer les vignettes des cartes existantes</button></div>
        <p id="colMedMsg" role="status" style="margin-top:8px;font-size:13.5px"></p>
      </div>
      <div class="panneau" style="margin-top:14px"><h4 style="margin-bottom:8px">Derniers ajouts (médias et ressources)</h4>
        ${d.historique.length ? `<ul class="collecte-historique">${d.historique.map(h => `<li class="collecte-${h.statut}"><span>${h.statut === 'ok' ? ICONES[h.type] || '✅' : '⚠️'}</span><div><b>${E(h.titre || h.message)}</b><small>${new Date(h.date).toLocaleString('fr-FR')} · ${E(d.noms[h.type] || '')}${h.source ? ' · ' + E(h.source) : ''}${h.statut !== 'ok' && h.message && h.titre ? ' · ' + E(h.message) : ''}</small></div></li>`).join('')}</ul>` : '<p class="vide">Aucun ajout pour le moment.</p>'}
      </div>`;
  }
  async function rafraichirMedias() { try { const d = await api('/collecte/medias'); const z = document.getElementById('collecteMediasPage'); if (z) { z.innerHTML = contenuMedias(d); brancherMedias(); } } catch {} }
  function brancherMedias() {
    const msg = t => { const m = document.getElementById('colMedMsg'); if (m) m.textContent = t; };
    document.getElementById('colMedEnregistrer')?.addEventListener('click', async () => {
      try { await api('/collecte/medias', { method: 'PUT', body: JSON.stringify({ actif: document.getElementById('colMedActif').checked, quotas: Object.fromEntries([...document.querySelectorAll('[data-quota]')].map(i => [i.dataset.quota, parseInt(i.value, 10) || 0])) }) }); msg('Réglages enregistrés ✅'); setTimeout(rafraichirMedias, 800); }
      catch (e) { msg(e.message); }
    });
    document.querySelectorAll('[data-lancer-type]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await api('/collecte/medias/lancer', { method: 'POST', body: JSON.stringify({ type: b.dataset.lancerType }) }); msg(r.message); setTimeout(rafraichirMedias, 8000); } catch (e) { msg(e.message); }
    }));
    document.getElementById('colVignettesCartes')?.addEventListener('click', async e => {
      const bouton = e.currentTarget; bouton.disabled = true;
      try {
        const cartes = (await api('/medias?type=carte')).filter(c => c.fichier && !c.vignette);
        if (!cartes.length) { msg('Toutes les cartes ont déjà une vignette ✅'); return; }
        const jeton = localStorage.getItem('oasis_jeton') || '';
        const r = await OasisVignetteCarte.toutes(cartes, jeton, (f, k, n) => msg(`Vignettes : ${f + k} / ${n}${k ? ` (${k} échec(s))` : ''}… gardez cette page ouverte.`));
        msg(`${r.fait} vignette(s) créée(s)${r.echec ? `, ${r.echec} échec(s)` : ''} ✅`);
      } catch (err) { msg(err.message); } finally { bouton.disabled = false; }
    });
  }
  async function rafraichir() { try { const d = await api('/collecte'); const z = document.getElementById('collectePage'); if (z) { z.innerHTML = contenu(d); brancher(); } } catch {} }
  function brancher() {
    const msg = t => { const m = document.getElementById('colMsg'); if (m) m.textContent = t; };
    document.getElementById('colEnregistrer')?.addEventListener('click', async () => {
      try {
        await api('/collecte', { method: 'PUT', body: JSON.stringify({ actif: document.getElementById('colActif').checked, objectif: parseInt(document.getElementById('colObjectif').value, 10), dateCible: document.getElementById('colDate').value, maxParHeure: parseInt(document.getElementById('colMax').value, 10), espaceMinMo: parseInt(document.getElementById('colEspace').value, 10), sources: Object.fromEntries([...document.querySelectorAll('[data-source]')].map(c => [c.dataset.source, c.checked])) }) });
        msg('Réglages enregistrés ✅'); setTimeout(rafraichir, 800);
      } catch (e) { msg(e.message); }
    });
    document.getElementById('colLancer')?.addEventListener('click', async () => {
      try { const r = await api('/collecte/lancer', { method: 'POST', body: JSON.stringify({ nombre: 5 }) }); msg(r.message + ' La page se met à jour toute seule.'); setTimeout(rafraichir, 5000); }
      catch (e) { msg(e.message); }
    });
  }
  return { page };
})();
