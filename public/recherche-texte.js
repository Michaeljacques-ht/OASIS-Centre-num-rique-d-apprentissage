/* OASIS — Résultats de la recherche dans le texte des livres (portail) */
window.OasisRechercheTexte = (() => {
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UNITES = { page: ['page', 'pages'], chapitre: ['chapitre', 'chapitres'], partie: ['partie', 'parties'] };
  const unite = (u, n) => (UNITES[u] || UNITES.page)[n > 1 ? 1 : 0];
  let minuteur, api;

  /** Texte d'extrait avec les mots trouvés en <mark>, échappé morceau par morceau. */
  function surligner(texte, zones) {
    let html = '', pos = 0;
    for (const [debut, longueur] of zones) {
      if (debut < pos) continue;
      html += E(texte.slice(pos, debut)) + '<mark>' + E(texte.slice(debut, debut + longueur)) + '</mark>';
      pos = debut + longueur;
    }
    return html + E(texte.slice(pos));
  }

  function couverture(l) {
    return l.couverture
      ? `<div class="rt-couv"><img src="/api/livres/${encodeURIComponent(l.id)}/couverture" alt="" loading="lazy"></div>`
      : `<div class="rt-couv" style="background:linear-gradient(150deg, ${E(l.couleur || '#1e4fa3')}, #10243e)">${E(l.icone || '📘')}</div>`;
  }

  function rendu(d) {
    const ind = d.indexation || {};
    const attente = ind.enAttente ? `<p class="rt-note">⏳ Indexation en cours : ${ind.enAttente} document${ind.enAttente > 1 ? 's' : ''} restant${ind.enAttente > 1 ? 's' : ''}. Les résultats se compléteront.</p>` : '';
    if (!d.resultats.length) return `<div class="section-titre"><h3>📄 Dans le texte des livres</h3></div>${attente}<p class="vide">Aucun passage ne contient ${d.termes?.length > 1 ? 'tous ces mots' : 'ce mot'}. Essayez un autre mot, un synonyme ou une expression plus courte.</p>`;
    const nbLivres = d.resultats.length;
    return `<div class="section-titre"><h3>📄 Dans le texte des livres</h3><span class="rt-compte">${d.total} passage${d.total > 1 ? 's' : ''} · ${nbLivres} livre${nbLivres > 1 ? 's' : ''}</span></div>${attente}
      <p class="rt-aide">Astuce : mettez une expression entre guillemets pour la chercher telle quelle, par exemple <code>"école fondamentale"</code>.</p>
      <ol class="rt-liste">${d.resultats.map(r => `<li class="rt-livre">
        <button class="rt-entete" data-livre="${E(r.livre.id)}">${couverture(r.livre)}<span><b>${E(r.livre.titre)}</b><small>${E(r.livre.auteur || '')}${r.livre.categorie ? ' · ' + E(r.livre.categorie) : ''}</small>
          <small class="rt-trouve">Trouvé dans ${r.nbPagesTrouvees} ${unite(r.unite, r.nbPagesTrouvees)}</small></span></button>
        <ul>${r.correspondances.map(c => `<li><button class="rt-passage" data-lire="${E(r.livre.id)}" data-page="${c.page}" data-unite="${E(r.unite)}" data-extrait="${E(c.texte.slice(0, 220))}">
          <span class="rt-page">${E(unite(r.unite, 1).replace(/^./, x => x.toUpperCase()))} ${c.page}</span><span class="rt-extrait">${surligner(c.texte, c.surlignes)}</span><span class="rt-ouvrir" aria-hidden="true">Ouvrir →</span></button></li>`).join('')}
          ${r.nbPagesTrouvees > r.correspondances.length ? `<li class="rt-plus">+ ${r.nbPagesTrouvees - r.correspondances.length} autre${r.nbPagesTrouvees - r.correspondances.length > 1 ? 's' : ''} ${unite(r.unite, 2)}. Précisez votre recherche pour les voir.</li>` : ''}</ul>
      </li>`).join('')}</ol>`;
  }

  /** Emplacement à insérer dans la vue ; il est rempli dès que la saisie se stabilise. */
  function section(q, requete) {
    api = requete;
    clearTimeout(minuteur);
    if (!q || q.trim().length < 2) return '';
    minuteur = setTimeout(async () => {
      const zone = document.getElementById('rechercheTexte');
      if (!zone || zone.dataset.q !== q) return;
      try {
        const d = await api('/recherche?journal=1&q=' + encodeURIComponent(q));
        const encart = d.resultats.length && window.OasisIA ? await OasisIA.encartBibliotheque(q).catch(() => '') : '';
        const finale = document.getElementById('rechercheTexte');
        if (finale && finale.dataset.q === q) finale.innerHTML = encart + rendu(d);
      } catch (err) { zone.innerHTML = `<p class="vide">Recherche dans le texte indisponible : ${E(err.message)}</p>`; }
    }, 650);
    return `<section id="rechercheTexte" class="rt-section" data-q="${E(q)}" aria-live="polite"><div class="section-titre"><h3>📄 Dans le texte des livres</h3></div><p class="vide">Recherche dans le texte des livres…</p></section>`;
  }
  return { section, surligner };
})();
