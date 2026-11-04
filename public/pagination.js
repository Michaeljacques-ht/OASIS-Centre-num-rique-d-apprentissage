/* OASIS — Pagination commune (catalogue, bibliothèque, ressources) : groupes de 50 documents. */
window.OasisPagination = (() => {
  const TAILLE = 50;
  /** Découpe une liste. etat = { page, tout } ; renvoie { elements, debut, fin, pages, page }. */
  function decouper(liste, etat = {}) {
    const total = liste.length, pages = Math.max(1, Math.ceil(total / TAILLE));
    const page = Math.min(Math.max(0, etat.page || 0), pages - 1);
    if (etat.tout) return { elements: liste, debut: total ? 1 : 0, fin: total, pages, page, total };
    const debut = page * TAILLE;
    return { elements: liste.slice(debut, debut + TAILLE), debut: total ? debut + 1 : 0, fin: Math.min(total, debut + TAILLE), pages, page, total };
  }
  /** Barre « ← 50 précéd. | 1–50 sur 3309 | 50 suiv. → | Tout afficher ». cle identifie la liste. */
  function barre(cle, d, etat = {}) {
    if (d.total <= TAILLE) return '';
    const prec = !etat.tout && d.page > 0, suiv = !etat.tout && d.page < d.pages - 1;
    return `<nav class="pagination" aria-label="Pagination">
      <span class="pagination-info">${d.debut}–${d.fin} sur ${d.total}</span>
      <span class="pagination-boutons">
        <button type="button" class="pagination-btn" data-pagination="${cle}" data-pagination-action="prec" ${prec ? '' : 'disabled'}>← ${TAILLE} précéd.</button>
        <button type="button" class="pagination-btn" data-pagination="${cle}" data-pagination-action="suiv" ${suiv ? '' : 'disabled'}>${TAILLE} suiv. →</button>
        <button type="button" class="pagination-btn pagination-tout" data-pagination="${cle}" data-pagination-action="tout" aria-pressed="${!!etat.tout}">${etat.tout ? `Par ${TAILLE}` : 'Tout afficher'}</button>
      </span></nav>`;
  }
  /** Applique l'action d'un bouton de pagination à un état ; renvoie le nouvel état. */
  function appliquer(action, etat = {}) {
    if (action === 'prec') return { ...etat, page: Math.max(0, (etat.page || 0) - 1), tout: false };
    if (action === 'suiv') return { ...etat, page: (etat.page || 0) + 1, tout: false };
    if (action === 'tout') return { page: 0, tout: !etat.tout };
    return etat;
  }
  return { TAILLE, decouper, barre, appliquer };
})();
