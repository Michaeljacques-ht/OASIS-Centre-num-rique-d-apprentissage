/* OASIS IA — panneau d'assistance dans les lecteurs et questions à la bibliothèque */
window.OasisIA = (() => {
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jeton = () => localStorage.getItem('oasis_jeton') || localStorage.getItem('educa_jeton') || '';
  async function api(chemin, corps) {
    const r = await fetch('/api' + chemin, { method: corps ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(jeton() ? { Authorization: 'Bearer ' + jeton() } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(Error(d.erreur || 'Assistant indisponible.'), { abonnement: d.abonnement });
    return d;
  }
  const COURT = { page: 'p.', chapitre: 'chap.', partie: 'partie' };
  const NIVEAU_PROFIL = { scolaire: 'secondaire', universitaire: 'universitaire', technique_professionnel: 'professionnel' };
  let etat = null;
  const chargerEtat = async () => (etat ||= await api('/ia/etat').catch(() => ({ disponible: false })));

  /** Mise en forme sûre : échappement d'abord, puis gras, listes et jetons de citation. */
  function rendre(texte, { livreCourant, titres = {}, unites = {} } = {}) {
    const lignes = E(texte).split('\n');
    let html = '', liste = false;
    for (const brute of lignes) {
      const l = brute.trim();
      const puce = /^[-•*]\s+/.test(l);
      if (puce && !liste) { html += '<ul>'; liste = true; }
      if (!puce && liste) { html += '</ul>'; liste = false; }
      if (!l) continue;
      const contenu = l.replace(/^[-•*]\s+/, '').replace(/^#{1,4}\s*/, '');
      html += puce ? `<li>${contenu}</li>` : `<p>${contenu}</p>`;
    }
    if (liste) html += '</ul>';
    return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(>])\*([^*\s][^*<]*?)\*(?=[\s.,;:!?)<]|$)/g, '$1<i>$2</i>').replace(/\[\[([\w-]+):([\d,]+)\]\]/g, (m, id, pages) =>
      pages.split(',').map(n => id === livreCourant
        ? `<button type="button" class="ia-cite" data-ia-aller="${n}" title="Aller à cet endroit">${E(COURT[unites[id]] || 'p.')} ${n}</button>`
        : `<button type="button" class="ia-cite autre" data-lire="${E(id)}" data-page="${n}" data-unite="${E(unites[id] || 'page')}" title="Ouvrir ce livre à cet endroit">${E(titres[id] || 'Livre')} · ${E(COURT[unites[id]] || 'p.')} ${n}</button>`).join(' '));
  }

  /* ---------- Panneau dans un lecteur ---------- */
  /** Ajoute le bouton « ✨ OASIS IA » à la barre de lecture. position = { unite, page(), aller(n) } */
  async function attacher(barre, racine, livre, position) {
    if (!livre?.iaDisponible || !position || !jeton()) return;
    const e = await chargerEtat(); if (!e.disponible || !barre.isConnected) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mini-btn ia-bouton'; b.textContent = '✨ OASIS IA';
    b.setAttribute('aria-expanded', 'false'); barre.append(' ', b);
    let panneau = null;
    b.onclick = () => {
      if (panneau) { panneau.remove(); panneau = null; b.setAttribute('aria-expanded', 'false'); return; }
      panneau = construire(racine, livre, position, e); b.setAttribute('aria-expanded', 'true');
      panneau.querySelector('[data-ia-fermer]').onclick = () => b.click();
    };
  }

  function construire(racine, livre, position, e) {
    const f = e.fonctions || {};
    const unite = position.unite, nomU = { page: 'cette page', chapitre: 'ce chapitre', partie: 'cette partie' }[unite];
    const niveauDefaut = NIVEAU_PROFIL[window.OasisMoi?.niveau] || 'secondaire';
    const p = document.createElement('aside'); p.className = 'ia-panneau'; p.setAttribute('aria-label', 'Assistant OASIS IA');
    p.innerHTML = `<header><b>✨ OASIS IA</b><small data-ia-quota>${e.restant === null ? '' : e.restant + ' demande(s) restante(s) aujourd’hui'}</small><button type="button" class="mini-btn" data-ia-fermer aria-label="Fermer l’assistant">✕</button></header>
      <label class="ia-ligne">Expliquer pour <select data-ia-niveau><option value="primaire">un élève du primaire</option><option value="secondaire">un élève du secondaire</option><option value="universitaire">un étudiant</option><option value="professionnel">la formation professionnelle</option></select></label>
      <div class="ia-actions">
        ${f.comprendre ? `<button type="button" class="btn btn-bleu" data-ia-action="comprendre">💡 Comprendre ${nomU}</button>` : ''}
        ${f.resumer ? `<button type="button" class="btn" data-ia-action="resumer">📝 Résumer ${nomU}</button>` : ''}
      </div>
      ${f.traduire ? `<details class="ia-traduire"><summary>🌐 Traduire ${nomU}</summary>
        <label class="ia-ligne">Vers <select data-ia-langue><option value="ht">le créole haïtien</option><option value="en">l’anglais</option><option value="fr">le français</option></select></label>
        <textarea data-ia-passage rows="2" maxlength="4000" placeholder="Facultatif : collez un passage de ${nomU} pour ne traduire que lui"></textarea>
        <button type="button" class="btn" data-ia-action="traduire">Traduire</button></details>` : ''}
      ${f.question ? `<form class="ia-question" data-ia-form><label for="iaQ${livre.id}">Poser une question sur ce livre</label><div><input id="iaQ${livre.id}" data-ia-question maxlength="400" placeholder="Ex. : Pourquoi Manuel revient-il au village ?"><button class="btn btn-bleu">Demander</button></div></form>` : ''}
      <div class="ia-resultat" data-ia-resultat aria-live="polite"><p class="ia-aide">Choisissez une action. L’assistant s’appuie uniquement sur le texte du livre et indique les ${unite}s utilisées.</p></div>`;
    racine.append(p);
    p.querySelector('[data-ia-niveau]').value = niveauDefaut;
    const zone = p.querySelector('[data-ia-resultat]'), quota = p.querySelector('[data-ia-quota]');
    const attente = (t) => { zone.innerHTML = `<p class="ia-attente"><span class="ia-points" aria-hidden="true"></span> ${E(t)}</p>`; p.querySelectorAll('button:not([data-ia-fermer]),input,select,textarea').forEach(x => x.disabled = true); };
    const fini = () => p.querySelectorAll('button,input,select,textarea').forEach(x => x.disabled = false);
    const majQuota = d => { if (d.restant !== undefined && d.restant !== null) quota.textContent = d.restant + ' demande(s) restante(s) aujourd’hui'; };
    const echec = err => { zone.innerHTML = `<div class="erreur">${E(err.message)}</div>${err.abonnement ? '<button class="mini-btn bleu" data-abonner>S’abonner</button>' : ''}`; };

    p.addEventListener('click', async ev => {
      const aller = ev.target.closest('[data-ia-aller]');
      if (aller) { position.aller(Number(aller.dataset.iaAller)); return; }
      const a = ev.target.closest('[data-ia-action]'); if (!a) return;
      const action = a.dataset.iaAction, page = position.page();
      attente(action === 'traduire' ? 'Traduction en cours…' : action === 'resumer' ? 'Résumé en cours…' : 'L’assistant lit la ' + (unite === 'chapitre' ? 'le chapitre' : unite) + '…');
      try {
        const d = await api('/ia/lecture', { livreId: livre.id, action, page, niveau: p.querySelector('[data-ia-niveau]').value,
          langue: p.querySelector('[data-ia-langue]')?.value, passage: action === 'traduire' ? p.querySelector('[data-ia-passage]')?.value.trim() || undefined : undefined });
        const titre = { comprendre: `💡 ${nomU[0].toUpperCase() + nomU.slice(1)} expliqué${unite === 'page' || unite === 'partie' ? 'e' : ''}`, resumer: '📝 Résumé', traduire: '🌐 Traduction' }[action];
        zone.innerHTML = `<h4>${E(titre)} <small>${E(COURT[unite])} ${page}${d.cache ? ' · déjà préparé' : ''}</small></h4><div class="ia-texte">${rendre(d.texte)}</div>
          ${d.tronque ? `<p class="ia-note">La ${E(unite)} est longue : seul son début a été pris en compte.</p>` : ''}<p class="ia-note">⚠️ ${E(d.avertissement)}</p>`;
        majQuota(d);
      } catch (err) { echec(err); } finally { fini(); }
    });
    p.querySelector('[data-ia-form]')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const q = p.querySelector('[data-ia-question]').value.trim(); if (q.length < 5) return;
      attente('L’assistant cherche dans le livre…');
      try {
        const d = await api('/ia/question', { livreId: livre.id, question: q, page: position.page(), niveau: p.querySelector('[data-ia-niveau]').value });
        const u = d.unite || unite;
        zone.innerHTML = `<h4>❓ ${E(q)}</h4><div class="ia-texte">${rendre(d.texte, { livreCourant: livre.id, unites: { [livre.id]: u } })}</div>
          ${d.pagesConsultees?.length ? `<p class="ia-note">Passages consultés : ${d.pagesConsultees.map(n => `<button type="button" class="ia-cite" data-ia-aller="${n}">${E(COURT[u])} ${n}</button>`).join(' ')}</p>` : ''}
          ${d.citationsRetirees ? `<p class="ia-note">${d.citationsRetirees} référence(s) non vérifiable(s) ont été retirées de la réponse.</p>` : ''}
          <p class="ia-note">⚠️ Réponse générée à partir des passages cités : vérifiez-les dans le livre.</p>`;
        majQuota(d);
      } catch (err) { echec(err); } finally { fini(); }
    });
    return p;
  }

  /* ---------- Question à toute la bibliothèque (depuis la recherche) ---------- */
  async function encartBibliotheque(q) {
    if (!jeton() || q.trim().length < 5) return '';
    const e = await chargerEtat();
    if (!e.disponible || !e.fonctions?.bibliotheque) return '';
    return `<div class="ia-biblio" data-ia-biblio-zone><div><b>✨ Demander à OASIS IA</b><small>L’assistant lit les passages trouvés et vous indique quels livres consulter, avec les pages.</small></div>
      <button type="button" class="btn btn-bleu" data-ia-biblio="${E(q)}">Poser la question</button></div>`;
  }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ia-biblio]'); if (!b) return;
    const zone = b.closest('[data-ia-biblio-zone]'), q = b.dataset.iaBiblio;
    zone.innerHTML = `<p class="ia-attente"><span class="ia-points" aria-hidden="true"></span> L’assistant consulte les livres…</p>`;
    try {
      const d = await api('/ia/bibliotheque', { question: q });
      const titres = Object.fromEntries((d.livres || []).map(l => [l.id, l.titre])), unites = Object.fromEntries((d.livres || []).map(l => [l.id, l.unite]));
      zone.classList.add('ia-biblio-reponse');
      zone.innerHTML = `<h4>✨ OASIS IA — « ${E(q)} »</h4><div class="ia-texte">${rendre(d.texte, { titres, unites })}</div>
        ${d.citationsRetirees ? `<p class="ia-note">${d.citationsRetirees} référence(s) non vérifiable(s) ont été retirées.</p>` : ''}
        <p class="ia-note">⚠️ Synthèse générée à partir des passages cités. Ouvrez les livres pour vérifier.</p>`;
    } catch (err) { zone.innerHTML = `<div class="erreur">${E(err.message)}</div>`; }
  });

  return { attacher, encartBibliotheque, rendre, reinitialiser: () => { etat = null; } };
})();
