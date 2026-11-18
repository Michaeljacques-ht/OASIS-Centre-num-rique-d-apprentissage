/* OASIS 1.33.0 — Vignettes des cartes de la cartothèque.
   Pour une carte sans vignette, le navigateur crée un aperçu léger (environ 30 Ko) à partir de l'image ou de la 1re page du PDF.
   Quand c'est le bibliothécaire qui consulte, l'aperçu est enregistré sur le serveur : il servira ensuite à tous les lecteurs. */
window.OasisVignetteCarte = (() => {
  const LARGEUR = 480;
  const versJpeg = canvas => new Promise((ok, ko) => canvas.toBlob(b => b ? ok(b) : ko(Error('Image indisponible')), 'image/jpeg', 0.78));
  async function depuisImage(url) {
    const img = new Image(); img.decoding = 'async';
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(Error('Image illisible')); img.src = url; });
    const c = document.createElement('canvas'); c.width = Math.min(LARGEUR, img.naturalWidth); c.height = Math.round(c.width * img.naturalHeight / img.naturalWidth);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return versJpeg(c);
  }
  async function chargerPdfJs() {
    if (window.pdfjsLib) return;
    await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = '/vendor/pdfjs/pdf.min.js'; s.onload = ok; s.onerror = () => ko(Error('PDF.js indisponible')); document.head.append(s); });
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
  }
  async function depuisPdf(url) {
    await chargerPdfJs();
    const doc = await pdfjsLib.getDocument({ url, isEvalSupported: false }).promise;
    try {
      const page = await doc.getPage(1), v = page.getViewport({ scale: 1 }), echelle = LARGEUR / v.width, vp = page.getViewport({ scale: echelle });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; return versJpeg(c);
    } finally { doc.destroy(); }
  }
  async function enregistrer(id, blob, jeton) {
    const r = await fetch('/api/medias/' + encodeURIComponent(id) + '/vignette', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'image/jpeg' }, body: blob });
    if (!r.ok) throw Error('Vignette non enregistrée');
  }
  function afficher(racine, jeton, admin) {
    if (!jeton) return;
    let file = Promise.resolve();
    const obs = new IntersectionObserver(entrees => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        const boite = e.target, id = boite.dataset.vignetteCarte;
        file = file.then(async () => {
          if (!boite.isConnected) return;
          try {
            const url = '/api/medias/' + encodeURIComponent(id) + '/fichier?lecture=1&jeton=' + encodeURIComponent(jeton);
            const blob = /pdf/.test(boite.dataset.carteMime || '') ? await depuisPdf(url) : await depuisImage(url);
            if (!boite.isConnected) return;
            const img = document.createElement('img'), lien = URL.createObjectURL(blob);
            img.src = lien; img.alt = 'Aperçu de la carte ' + (boite.dataset.carteTitre || ''); img.className = 'vignette-carte'; img.onload = () => URL.revokeObjectURL(lien);
            boite.prepend(img); boite.removeAttribute('data-vignette-carte');
            if (admin) await enregistrer(id, blob, jeton);
          } catch { boite.dataset.vignetteErreur = 'true'; }
        });
      }
    }, { rootMargin: '200px' });
    racine.querySelectorAll('[data-vignette-carte]').forEach(b => obs.observe(b));
    setTimeout(() => obs.disconnect(), 300000);
  }
  /** Espace bibliothécaire : crée les vignettes manquantes de toutes les cartes. */
  async function toutes(cartes, jeton, progression) {
    let fait = 0, echec = 0;
    for (const c of cartes) {
      try {
        const url = '/api/medias/' + encodeURIComponent(c.id) + '/fichier?lecture=1&jeton=' + encodeURIComponent(jeton);
        await enregistrer(c.id, /pdf/.test(c.mime || '') ? await depuisPdf(url) : await depuisImage(url), jeton); fait++;
      } catch { echec++; }
      progression?.(fait, echec, cartes.length);
    }
    return { fait, echec };
  }
  return { afficher, toutes };
})();
