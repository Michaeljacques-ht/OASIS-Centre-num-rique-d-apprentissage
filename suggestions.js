/* OASIS — « Continuer votre lecture » et « Les lecteurs ont aussi lu » */
window.OasisSuggestions = (() => {
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const couv = l => l.couverture
    ? `<span class="sg-couv"><img src="/api/livres/${encodeURIComponent(l.id)}/couverture" alt="" loading="lazy"></span>`
    : `<span class="sg-couv" style="background:linear-gradient(150deg, ${E(l.couleur || '#1e4fa3')}, #10243e)">${E(l.icone || '📘')}</span>`;

  async function continuer(api) {
    const d = await api('/suggestions/continuer').catch(() => null);
    if (!d || d.desactivees || !d.livres.length) return '';
    return `<section class="sg-continuer"><div class="section-titre"><h3>📖 Continuer votre lecture</h3><button data-sg-desactiver title="Ne plus afficher de suggestions personnalisées">Masquer les suggestions</button></div>
      <div class="sg-rangee">${d.livres.map(l => `<article class="sg-carte">${couv(l)}<div><b>${E(l.titre)}</b><small>${E(l.auteur || '')}</small>
        <div class="barre-progression" aria-label="${l.pourcentageLu} % lu"><div style="width:${l.pourcentageLu}%"></div></div><small>${l.pourcentageLu} % lu</small>
        <button class="mini-btn bleu" data-lire="${E(l.id)}">Reprendre</button></div></article>`).join('')}</div></section>`;
  }

  /** Emplacement pour la fiche d'un livre, rempli juste après l'ouverture. */
  function aussiLus(id, api) {
    setTimeout(async () => {
      const zone = document.querySelector(`[data-sg-aussi="${CSS.escape(id)}"]`); if (!zone) return;
      const d = await api('/livres/' + encodeURIComponent(id) + '/aussi-lus').catch(() => null);
      if (!d || !d.livres.length || !zone.isConnected) return;
      const communs = d.livres.some(l => l.lecteursCommuns);
      zone.innerHTML = `<h4>${communs ? '👥 Les lecteurs de ce livre ont aussi lu' : '📚 Dans la même catégorie'}</h4>
        <div class="sg-mini">${d.livres.map(l => `<button class="sg-mini-livre" data-livre="${E(l.id)}">${couv(l)}<span>${E(l.titre)}<small>${l.lecteursCommuns ? l.lecteursCommuns + ' lecteurs en commun' : E(l.auteur || '')}</small></span></button>`).join('')}</div>`;
    }, 0);
    return `<div class="sg-aussi" data-sg-aussi="${E(id)}"></div>`;
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-sg-desactiver]'); if (!b) return;
    if (!confirm('Masquer « Continuer votre lecture » et les suggestions basées sur vos lectures ? Vous pourrez les réactiver depuis Mon espace.')) return;
    const j = localStorage.getItem('oasis_jeton') || '';
    await fetch('/api/suggestions/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j }, body: JSON.stringify({ desactivees: true }) }).catch(() => {});
    b.closest('.sg-continuer')?.remove();
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-sg-reactiver]'); if (!b) return;
    const j = localStorage.getItem('oasis_jeton') || '';
    await fetch('/api/suggestions/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j }, body: JSON.stringify({ desactivees: false }) }).catch(() => {});
    b.replaceWith(Object.assign(document.createElement('span'), { textContent: '✅ Suggestions réactivées.' }));
  });
  return { continuer, aussiLus };
})();
