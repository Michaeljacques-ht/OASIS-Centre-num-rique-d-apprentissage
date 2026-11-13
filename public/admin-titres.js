/* OASIS 1.28.0 — Espace bibliothécaire : correction des titres du catalogue.
   Le serveur propose des corrections ; le bibliothécaire coche, retouche et applique. Chaque lot peut être annulé. */
window.OasisAdminTitres = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAR_PAGE = 100;

  async function ouvrir({ api, modale, toast, apresModification, fermer }) {
    let donnees;
    try { donnees = await api('/titres/corrections'); }
    catch (e) { return toast(e.statut === 404 ? 'La correction des titres est absente du serveur déployé : mettez à jour server.js et le dossier modules, puis redéployez.' : e.message); }
    const lignes = donnees.corrections.map(c => ({ ...c, coche: true, valeur: c.propose }));
    const raisons = [...new Set(lignes.flatMap(l => l.raisons))].sort((a, b) => a.localeCompare(b, 'fr'));
    let filtreRaison = '', recherche = '', page = 1;

    modale(`<div class="titres-outil">
      <div class="titres-entete"><h3>🔤 Corriger les titres du catalogue</h3><button class="fermer" type="button" id="titresFermer" aria-label="Fermer">✕</button></div>
      <p class="titres-intro">${donnees.total.toLocaleString('fr-FR')} titres analysés · <b>${lignes.length.toLocaleString('fr-FR')}</b> correction${lignes.length > 1 ? 's' : ''} proposée${lignes.length > 1 ? 's' : ''}.
        Vérifiez chaque proposition : vous pouvez la retoucher dans le champ ou la décocher. Rien n’est modifié avant « Appliquer », et chaque lot peut être annulé.</p>
      ${donnees.doublons.length ? `<p class="titres-info">📚 ${donnees.doublons.length} groupe${donnees.doublons.length > 1 ? 's' : ''} de titres identiques (même auteur) : utilisez « Détecter les doublons » pour les fusionner.</p>` : ''}
      ${lignes.length ? `<div class="titres-barre">
        <div class="titres-filtres" role="group" aria-label="Type de correction"><button data-raison="" class="actif">Toutes (${lignes.length})</button>${raisons.map(r => `<button data-raison="${E(r)}">${E(r)} (${lignes.filter(l => l.raisons.includes(r)).length})</button>`).join('')}</div>
        <input type="search" id="titresRecherche" placeholder="Filtrer par titre ou auteur…" aria-label="Filtrer les titres">
      </div>
      <div class="titres-actions-haut"><label><input type="checkbox" id="titresTout" checked> Tout cocher (filtre actuel)</label><span id="titresCompte" role="status"></span></div>
      <div id="titresListe" class="titres-liste"></div>
      <div id="titresPagination" class="titres-pagination"></div>
      <div class="titres-pied"><button class="btn btn-bleu" id="titresAppliquer">Appliquer les corrections cochées</button></div>` : '<p class="vide">✅ Aucun titre à corriger selon les règles automatiques.</p>'}
      <details class="titres-historique" id="titresHistorique"><summary>Historique et annulation</summary><div id="titresLots"><p class="vide">Chargement…</p></div></details>
    </div>`);

    const visibles = () => lignes.filter(l => (!filtreRaison || l.raisons.includes(filtreRaison)) && (!recherche || (l.titre + ' ' + l.auteur + ' ' + l.valeur).toLowerCase().includes(recherche)));
    function compte() {
      const n = lignes.filter(l => l.coche && l.valeur.trim() && l.valeur.trim() !== l.titre).length;
      const c = document.getElementById('titresCompte'); if (c) c.textContent = `${n} correction${n > 1 ? 's' : ''} cochée${n > 1 ? 's' : ''}`;
      const b = document.getElementById('titresAppliquer'); if (b) { b.disabled = !n; b.textContent = n ? `Appliquer ${n} correction${n > 1 ? 's' : ''}` : 'Aucune correction cochée'; }
    }
    function dessiner() {
      const liste = document.getElementById('titresListe'); if (!liste) return;
      const vs = visibles(), pages = Math.max(1, Math.ceil(vs.length / PAR_PAGE)); page = Math.min(page, pages);
      const tranche = vs.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);
      liste.innerHTML = tranche.length ? tranche.map(l => `<div class="titre-ligne${l.coche ? '' : ' decoche'}" data-id="${E(l.id)}">
          <input type="checkbox" class="titre-coche" ${l.coche ? 'checked' : ''} aria-label="Appliquer la correction de ${E(l.titre)}">
          <div class="titre-contenu">
            <div class="titre-avant"><span>Actuel</span><s>${E(l.titre)}</s></div>
            <label class="titre-apres"><span>Corrigé</span><input class="titre-valeur" value="${E(l.valeur)}" maxlength="300"></label>
            <div class="titre-meta">${l.auteur ? `<small>✍️ ${E(l.auteur)}</small>` : ''}${l.categorie ? `<small>🗂️ ${E(l.categorie)}</small>` : ''}${l.raisons.map(r => `<em>${E(r)}</em>`).join('')}${l.valeur !== l.propose ? `<button class="mini-btn titre-retablir" type="button">↺ Proposition</button>` : ''}</div>
          </div></div>`).join('') : '<p class="vide">Aucune proposition pour ce filtre.</p>';
      const pag = document.getElementById('titresPagination');
      pag.innerHTML = pages > 1 ? `<button class="mini-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ Précédent</button><span>Page ${page} / ${pages} · ${vs.length} titres</span><button class="mini-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Suivant ›</button>` : '';
      const tout = document.getElementById('titresTout'); if (tout) tout.checked = vs.length > 0 && vs.every(l => l.coche);
      compte();
    }
    async function historique() {
      const zone = document.getElementById('titresLots'); if (!zone) return;
      try {
        const lots = await api('/titres/lots');
        zone.innerHTML = lots.length ? lots.map(l => `<div class="titres-lot"><div><b>${new Date(l.date).toLocaleString('fr-FR')}</b> · ${l.nombre} titre${l.nombre > 1 ? 's' : ''}${l.par ? ' · ' + E(l.par) : ''}<small>${l.exemples.map(x => `${E(x.avant)} → ${E(x.apres)}`).join('<br>')}</small></div>
          ${l.annule ? '<span class="titres-annule">Annulé</span>' : `<button class="mini-btn rouge" data-annuler-lot="${E(l.id)}">↩ Annuler ce lot</button>`}</div>`).join('') : '<p class="vide">Aucune correction appliquée pour le moment.</p>';
      } catch (e) { zone.innerHTML = `<p class="vide">${E(e.message)}</p>`; }
    }

    const racine = document.querySelector('.titres-outil');
    racine.addEventListener('input', e => {
      if (e.target.id === 'titresRecherche') { recherche = e.target.value.trim().toLowerCase(); page = 1; return dessiner(); }
      const ligne = e.target.closest('.titre-ligne'); if (!ligne) return;
      const l = lignes.find(x => x.id === ligne.dataset.id);
      if (e.target.classList.contains('titre-valeur')) { l.valeur = e.target.value; if (!l.coche) { l.coche = true; ligne.querySelector('.titre-coche').checked = true; ligne.classList.remove('decoche'); } compte(); }
    });
    racine.addEventListener('change', e => {
      if (e.target.id === 'titresTout') { visibles().forEach(l => { l.coche = e.target.checked; }); return dessiner(); }
      if (e.target.classList.contains('titre-coche')) { const ligne = e.target.closest('.titre-ligne'); const l = lignes.find(x => x.id === ligne.dataset.id); l.coche = e.target.checked; ligne.classList.toggle('decoche', !l.coche); compte(); }
    });
    racine.addEventListener('click', async e => {
      const f = e.target.closest('[data-raison]'); if (f) { filtreRaison = f.dataset.raison; page = 1; racine.querySelectorAll('[data-raison]').forEach(b => b.classList.toggle('actif', b === f)); return dessiner(); }
      const p = e.target.closest('[data-page]'); if (p) { page = +p.dataset.page; dessiner(); return document.getElementById('titresListe').scrollIntoView({ block: 'start' }); }
      if (e.target.closest('.titre-retablir')) { const l = lignes.find(x => x.id === e.target.closest('.titre-ligne').dataset.id); l.valeur = l.propose; return dessiner(); }
      if (e.target.id === 'titresAppliquer') {
        const choix = lignes.filter(l => l.coche && l.valeur.trim() && l.valeur.trim() !== l.titre).map(l => ({ id: l.id, titre: l.valeur.trim() }));
        if (!choix.length) return;
        if (!confirm(`Appliquer ${choix.length} correction(s) de titre ? Vous pourrez annuler ce lot dans l’historique.`)) return;
        e.target.disabled = true;
        try {
          const r = await api('/titres/corrections', { method: 'POST', body: JSON.stringify({ corrections: choix }) });
          toast(`${r.modifies} titre${r.modifies > 1 ? 's' : ''} corrigé${r.modifies > 1 ? 's' : ''} ✅`);
          const faits = new Set(choix.map(c => c.id));
          for (let i = lignes.length - 1; i >= 0; i--) if (faits.has(lignes[i].id)) lignes.splice(i, 1);
          dessiner(); historique(); apresModification?.();
        } catch (err) { toast(err.message); e.target.disabled = false; }
      }
      const a = e.target.closest('[data-annuler-lot]');
      if (a) {
        if (!confirm('Remettre les anciens titres de ce lot ?')) return;
        try { const r = await api('/titres/annuler', { method: 'POST', body: JSON.stringify({ lot: a.dataset.annulerLot }) }); toast(`${r.restaures} titre(s) restauré(s).`); historique(); apresModification?.(); }
        catch (err) { toast(err.message); }
      }
    });
    document.getElementById('titresFermer').onclick = () => fermer?.();
    document.getElementById('titresHistorique').addEventListener('toggle', historique, { once: true });
    dessiner();
  }
  return { ouvrir };
})();
