/* OASIS — Administration de l'assistant OASIS IA */
window.OasisAdminIA = (() => {
  let api, d, filtre = '', recherche = '';
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const FONCTIONS = { comprendre: '💡 Comprendre cette page', resumer: '📝 Résumé', traduire: '🌐 Traduction', question: '❓ Questions sur un livre', bibliotheque: '📚 Questions à la bibliothèque', quiz: '🧠 Brouillons de quiz (admin)' };
  const TEXTE = { ok: '✅ Texte indexé', attente: '⏳ Indexation en attente', scanne: '🖼️ Scanné (OCR requis)', aucun: '— Pas de version numérique' };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  async function ouvrir(request) {
    api = request; d = await api('/admin-ia');
    const c = d.config, p = d.parametres;
    const total = d.usage.reduce((s, j) => ({ demandes: s.demandes + j.total, cache: s.cache + j.cache, entree: s.entree + j.entree, sortie: s.sortie + j.sortie }), { demandes: 0, cache: 0, entree: 0, sortie: 0 });
    const aujourdhui = d.usage.find(j => j.date === new Date().toISOString().slice(0, 10)) || { total: 0 };
    return `<div class="section-titre"><h3>✨ OASIS IA</h3></div>
      <p>L’assistant explique, résume et traduit les pages, répond aux questions sur un livre en citant les pages, et prépare des brouillons de quiz. Il ne lit que le texte indexé des documents que vous ouvrez à l’IA et n’invente pas de références : une page citée qui ne lui a pas été fournie est retirée de la réponse.</p>
      ${c.configuree ? `<div class="succes">Service configuré : ${E(c.fournisseur === 'openai' ? 'API compatible OpenAI' : 'Claude (Anthropic)')} · modèle <code>${E(c.modele)}</code> <button class="mini-btn" id="iaTester">Tester la connexion</button> <span id="iaTest" role="status"></span></div>`
        : `<div class="erreur"><b>Clé API absente.</b> Ajoutez la variable d’environnement <code>OASIS_IA_CLE</code> (ou <code>ANTHROPIC_API_KEY</code>) dans les réglages Render du service, puis redémarrez. Facultatif : <code>OASIS_IA_MODELE</code>, <code>OASIS_IA_FOURNISSEUR=openai</code> et <code>OASIS_IA_URL</code> pour un autre fournisseur.</div>`}
      <div class="stats">
        <div class="stat"><div class="libelle">Demandes aujourd’hui</div><div class="valeur">${aujourdhui.total} <small>/ ${p.plafondJour}</small></div></div>
        <div class="stat"><div class="libelle">Demandes (30 j)</div><div class="valeur">${total.demandes}</div></div>
        <div class="stat"><div class="libelle">Servies par le cache</div><div class="valeur">${total.cache}</div></div>
        <div class="stat"><div class="libelle">Jetons (entrée / sortie)</div><div class="valeur ia-jetons">${(total.entree / 1000).toFixed(1)} k / ${(total.sortie / 1000).toFixed(1)} k</div></div>
        <div class="stat"><div class="libelle">Documents ouverts à l’IA</div><div class="valeur">${d.documents.filter(x => d.parametres.politique === 'tous' ? x.iaAutorisee !== false && x.texte !== 'aucun' : x.iaAutorisee === true).length}</div></div>
      </div>
      <section class="panneau" style="margin:16px 0"><h4>Réglages</h4><form id="iaParam" class="ia-param">
        <label class="don-case"><input type="checkbox" name="actif" ${p.actif ? 'checked' : ''}> Assistant activé</label>
        <fieldset class="ia-politique"><legend>Documents utilisables par l’IA (droits d’auteur)</legend>
          <label class="don-case"><input type="radio" name="politique" value="selection" ${p.politique !== 'tous' ? 'checked' : ''}> Seulement les documents que je coche ci-dessous <small>(recommandé)</small></label>
          <label class="don-case"><input type="radio" name="politique" value="tous" ${p.politique === 'tous' ? 'checked' : ''}> Tous les documents, sauf ceux que j’exclus</label></fieldset>
        <fieldset class="ia-fonctions"><legend>Fonctions proposées</legend>${Object.entries(FONCTIONS).map(([k, v]) => `<label class="don-case"><input type="checkbox" name="f_${k}" ${p.fonctions[k] ? 'checked' : ''}> ${v}</label>`).join('')}</fieldset>
        <div class="dons-param-grille">
          <div class="champ"><label for="iaQuota">Demandes par lecteur et par jour</label><input id="iaQuota" name="quotaJour" type="number" min="0" max="1000" value="${p.quotaJour}"></div>
          <div class="champ"><label for="iaPlafond">Plafond total par jour</label><input id="iaPlafond" name="plafondJour" type="number" min="0" max="100000" value="${p.plafondJour}"></div>
          <div class="champ"><label for="iaMax">Caractères envoyés par page</label><input id="iaMax" name="maxCaracteres" type="number" min="1000" max="20000" step="500" value="${p.maxCaracteres}"></div>
        </div>
        <p class="rt-aide">Les réponses déjà produites (${d.cacheTaille} en mémoire) sont resservies sans nouvel appel ni décompte du quota. L’administrateur principal n’a pas de quota personnel.</p>
        <button class="btn btn-bleu">Enregistrer</button> <span id="iaParamMsg" role="status"></span></form></section>
      <section><div class="section-titre"><h4>Documents</h4><span class="rt-compte" id="iaCompte"></span></div>
        <div class="abo-admin-filtres"><div class="champ"><label for="iaRecherche">Titre ou auteur</label><input id="iaRecherche" type="search"></div>
          <div class="champ"><label for="iaFiltre">Afficher</label><select id="iaFiltre"><option value="">Tous</option><option value="oui">Ouverts à l’IA</option><option value="non">Fermés à l’IA</option><option value="scanne">Scannés (OCR requis)</option></select></div></div>
        <p class="rangee-boutons" style="margin:0 0 10px"><button class="mini-btn bleu" id="iaTousOui">Ouvrir les documents affichés</button><button class="mini-btn" id="iaTousNon">Fermer les documents affichés</button></p>
        <div id="iaDocuments"></div></section>
      ${d.usage.length ? `<section style="margin-top:18px"><h4>Utilisation des 30 derniers jours</h4><div class="catalogue-table-scroll"><table><thead><tr><th>Jour</th><th>Demandes</th><th>Cache</th><th>Détail</th><th>Jetons</th></tr></thead><tbody>
        ${d.usage.map(j => `<tr><td>${E(new Date(j.date + 'T12:00:00Z').toLocaleDateString('fr-FR'))}</td><td>${j.total}</td><td>${j.cache}</td><td><small>${Object.entries(j.actions).map(([k, v]) => E((FONCTIONS[k] || k).replace(/^\S+\s/, '')) + ' : ' + v).join(' · ')}</small></td><td><small>${j.entree.toLocaleString('fr-FR')} / ${j.sortie.toLocaleString('fr-FR')}</small></td></tr>`).join('')}
        </tbody></table></div></section>` : ''}`;
  }

  const ouvert = x => d.parametres.politique === 'tous' ? x.iaAutorisee !== false : x.iaAutorisee === true;
  function affiches() {
    return d.documents.filter(x => x.texte !== 'aucun' && (!recherche || norm(x.titre + ' ' + x.auteur).includes(recherche))
      && (!filtre || (filtre === 'oui' ? ouvert(x) : filtre === 'non' ? !ouvert(x) : x.texte === filtre)));
  }
  function peindre() {
    const docs = affiches();
    $('iaCompte').textContent = `${docs.length} document(s)`;
    $('iaDocuments').innerHTML = `<div class="catalogue-table-scroll"><table><thead><tr><th>IA</th><th>Document</th><th>Texte</th></tr></thead><tbody>
      ${docs.map(x => `<tr><td><label class="ia-interrupteur"><input type="checkbox" data-ia-doc="${E(x.id)}" ${ouvert(x) ? 'checked' : ''} ${d.config.configuree && d.parametres.actif ? '' : 'title="Assistant désactivé ou non configuré"'}><span>${ouvert(x) ? 'Ouvert' : 'Fermé'}</span></label></td>
        <td><b>${E(x.titre)}</b><br><small>${E(x.auteur || '')}${x.categorie ? ' · ' + E(x.categorie) : ''}</small></td>
        <td><small>${E(TEXTE[x.texte])}${x.nbPages ? ` · ${x.nbPages} ${E(x.unite)}${x.nbPages > 1 ? 's' : ''}` : ''}</small></td></tr>`).join('') || '<tr><td colspan="3">Aucun document.</td></tr>'}</tbody></table></div>`;
  }
  async function changer(ids, autorise) {
    // En politique « sélection », fermer = retirer la coche ; en politique « tous », fermer = exclure.
    const valeur = autorise ? true : d.parametres.politique === 'tous' ? false : null;
    await api('/admin-ia/documents', { method: 'PUT', body: JSON.stringify({ ids, autorise: valeur }) });
    d = await api('/admin-ia'); peindre();
  }

  function brancher() {
    if (!$('iaDocuments')) return;
    peindre();
    $('iaRecherche').oninput = e => { recherche = norm(e.target.value); peindre(); };
    $('iaFiltre').oninput = e => { filtre = e.target.value; peindre(); };
    $('iaDocuments').onchange = async e => { const c = e.target.closest('[data-ia-doc]'); if (!c) return; c.disabled = true; try { await changer([c.dataset.iaDoc], c.checked); } catch (err) { alert(err.message); } };
    $('iaTousOui').onclick = () => { const ids = affiches().map(x => x.id); if (ids.length && confirm(`Ouvrir ${ids.length} document(s) à l’IA ? Vérifiez que leurs droits le permettent.`)) changer(ids, true).catch(err => alert(err.message)); };
    $('iaTousNon').onclick = () => { const ids = affiches().map(x => x.id); if (ids.length) changer(ids, false).catch(err => alert(err.message)); };
    $('iaTester') && ($('iaTester').onclick = async () => { $('iaTest').textContent = 'Test en cours…'; try { const r = await api('/admin-ia/tester', { method: 'POST' }); $('iaTest').textContent = `✅ Réponse « ${r.reponse} » en ${r.duree} ms`; } catch (err) { $('iaTest').textContent = '⚠️ ' + err.message; } });
    $('iaParam').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try {
        d.parametres = await api('/admin-ia/parametres', { method: 'PUT', body: JSON.stringify({ actif: f.elements.actif.checked, politique: f.elements.politique.value,
          fonctions: Object.fromEntries(Object.keys(FONCTIONS).map(k => [k, f.elements['f_' + k].checked])),
          quotaJour: Number(f.elements.quotaJour.value), plafondJour: Number(f.elements.plafondJour.value), maxCaracteres: Number(f.elements.maxCaracteres.value) }) });
        $('iaParamMsg').textContent = '✅ Réglages enregistrés.'; d = await api('/admin-ia'); peindre();
      } catch (err) { $('iaParamMsg').textContent = err.message; }
    };
  }
  return { ouvrir, brancher };
})();
