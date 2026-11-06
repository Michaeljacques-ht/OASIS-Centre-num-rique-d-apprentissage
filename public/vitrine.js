/* OASIS — Vitrine publique (1.25.0) : barre d'annonces défilante et partenaires supporteurs */
window.OasisVitrine = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lienSur = u => /^https?:\/\//i.test(u || '') ? u : '';
  let minuterie = null;

  /* ---------- Barre d'annonces ---------- */
  async function annonces() {
    let liste = [];
    try { const r = await fetch('/api/annonces'); if (r.ok) liste = await r.json(); } catch {}
    let barre = document.getElementById('barreAnnonces');
    const fermees = (() => { try { return JSON.parse(sessionStorage.getItem('oasis-annonces-fermees') || '""'); } catch { return ''; } })();
    const signature = liste.map(a => a.id).join(',');
    if (!liste.length || fermees === signature) { barre?.remove(); return; }
    if (!barre) {
      barre = document.createElement('div'); barre.id = 'barreAnnonces'; barre.className = 'barre-annonces'; barre.setAttribute('role', 'region'); barre.setAttribute('aria-label', 'Annonces');
      const entete = document.querySelector('.principal .entete'); if (!entete) return;
      entete.insertAdjacentElement('afterend', barre);
    }
    const element = a => {
      const contenu = `<span class="annonce-icone" aria-hidden="true">${E(a.icone)}</span>${E(a.texte)}`;
      const l = lienSur(a.lien);
      return `<span class="annonce annonce-${E(a.type)}">${l ? `<a href="${E(l)}" target="_blank" rel="noopener">${contenu} <span aria-hidden="true">↗</span></a>` : contenu}</span>`;
    };
    const suite = liste.map(element).join('<span class="annonce-sep" aria-hidden="true">•</span>');
    const duree = Math.max(18, Math.min(120, liste.reduce((n, a) => n + a.texte.length, 0) / 7));
    barre.innerHTML = `<span class="annonces-etiquette">📢 <span>Annonces</span></span>
      <div class="annonces-fenetre"><div class="annonces-piste" style="--duree:${duree}s"><div class="annonces-groupe">${suite}</div><div class="annonces-groupe" aria-hidden="true">${suite}</div></div></div>
      <button class="annonces-fermer" type="button" aria-label="Masquer les annonces">✕</button>`;
    barre.querySelector('.annonces-fermer').onclick = () => { try { sessionStorage.setItem('oasis-annonces-fermees', JSON.stringify(signature)); } catch {} barre.remove(); };
    clearTimeout(minuterie); minuterie = setTimeout(annonces, 5 * 60 * 1000);
  }

  /* ---------- Partenaires ---------- */
  async function liste() { try { const r = await fetch('/api/partenaires'); return r.ok ? await r.json() : []; } catch { return []; } }
  const logo = (p, classe = '') => p.logo
    ? `<img class="partenaire-logo ${classe}" src="/api/partenaires/${encodeURIComponent(p.id)}/logo?v=${p.logoV}" alt="Logo ${E(p.nom)}" loading="lazy">`
    : `<span class="partenaire-logo partenaire-initiales ${classe}" style="background:${E(p.couleur)}" aria-hidden="true">${E(p.nom.split(/\s+/).map(m => m[0]).join('').slice(0, 2).toUpperCase())}</span>`;
  const niveau = p => `<span class="partenaire-niveau niveau-${E(p.niveau)}">${{ or: '🥇', argent: '🥈', bronze: '🥉', soutien: '🤝' }[p.niveau] || '🤝'} ${E(p.niveauNom)}</span>`;
  const contacts = p => {
    const t = (p.telephone || '').replace(/[^\d+]/g, ''), w = (p.whatsapp || '').replace(/[^\d]/g, '');
    return [
      lienSur(p.site) && `<a class="btn btn-bleu" href="${E(p.site)}" target="_blank" rel="noopener" data-partenaire-clic="${E(p.id)}">${E(p.boutonTexte || 'Visiter le site')} ↗</a>`,
      w && `<a class="mini-btn" href="https://wa.me/${E(w)}" target="_blank" rel="noopener" data-partenaire-clic="${E(p.id)}">💬 WhatsApp</a>`,
      t && `<a class="mini-btn" href="tel:${E(t)}" data-partenaire-clic="${E(p.id)}">📞 ${E(p.telephone)}</a>`,
      p.email && `<a class="mini-btn" href="mailto:${E(p.email)}" data-partenaire-clic="${E(p.id)}">✉️ Écrire</a>`,
      lienSur(p.facebook) && `<a class="mini-btn" href="${E(p.facebook)}" target="_blank" rel="noopener" data-partenaire-clic="${E(p.id)}">Facebook</a>`,
      lienSur(p.instagram) && `<a class="mini-btn" href="${E(p.instagram)}" target="_blank" rel="noopener" data-partenaire-clic="${E(p.id)}">Instagram</a>`
    ].filter(Boolean).join('');
  };

  /** Bloc compact pour la page d'accueil (défilement horizontal des cartes). */
  async function blocAccueil() {
    const ps = await liste(); if (!ps.length) return '';
    return `<section class="partenaires-accueil" aria-label="Partenaires supporteurs">
      <div class="section-titre"><h3>🤝 Nos partenaires supporteurs</h3><button data-vue="partenaires">Voir tous ›</button></div>
      <p class="partenaires-merci">Ils soutiennent l’accès gratuit au savoir en Haïti. Merci à eux !</p>
      <div class="partenaires-carrousel">${ps.slice(0, 12).map(p => `<button class="partenaire-mini" data-vue="partenaires" style="--accent:${E(p.couleur)}">
        ${logo(p)}<span class="partenaire-mini-texte"><b>${E(p.nom)}</b>${p.slogan ? `<small>${E(p.slogan)}</small>` : ''}${niveau(p)}</span></button>`).join('')}</div>
    </section>`;
  }

  /** Page complète des partenaires, avec les petites publicités. */
  async function page() {
    const ps = await liste();
    return `<div class="hero partenaires-hero"><div><h2>🤝 Partenaires supporteurs</h2><p>Ces entreprises et institutions soutiennent OASIS, une bibliothèque gratuite qui vit de dons. Découvrez-les et pensez à elles !</p></div></div>
      ${ps.length ? `<div class="grille-partenaires">${ps.map(p => `<article class="carte-partenaire niveau-${E(p.niveau)}" style="--accent:${E(p.couleur)}">
        <div class="carte-partenaire-entete">${logo(p, 'grand')}<div><h3>${E(p.nom)}</h3>${p.secteur ? `<small>${E(p.secteur)}</small>` : ''}${niveau(p)}</div></div>
        ${p.slogan ? `<p class="partenaire-slogan">« ${E(p.slogan)} »</p>` : ''}
        ${p.description ? `<p>${E(p.description)}</p>` : ''}
        ${p.offre ? `<p class="partenaire-offre">🎁 ${E(p.offre)}</p>` : ''}
        ${p.adresse ? `<p class="partenaire-adresse">📍 ${E(p.adresse)}</p>` : ''}
        <div class="partenaire-actions">${contacts(p)}</div></article>`).join('')}</div>`
        : '<p class="vide">Aucun partenaire pour le moment.</p>'}
      <section class="panneau devenir-partenaire"><h3>Devenir partenaire supporteur</h3><p>Votre entreprise peut soutenir l’accès gratuit à la lecture et apparaître sur OASIS (logo, message, offre spéciale, contacts). Écrivez-nous ou faites un don.</p><button class="btn btn-orange" data-vue="don">💝 Soutenir OASIS</button></section>`;
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-partenaire-clic]'); if (!a) return;
    try { navigator.sendBeacon?.('/api/partenaires/' + encodeURIComponent(a.dataset.partenaireClic) + '/clic') || fetch('/api/partenaires/' + encodeURIComponent(a.dataset.partenaireClic) + '/clic', { method: 'POST', keepalive: true }); } catch {}
  });

  return { annonces, blocAccueil, page };
})();
