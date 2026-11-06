/* OASIS — Administration de la vitrine (1.25.0) : annonces défilantes et partenaires supporteurs */
window.OasisAdminVitrine = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);
  const jour = d => d ? String(d).slice(0, 10) : '';
  const TYPES = [['info', 'ℹ️ Information'], ['important', '⚠️ Important'], ['evenement', '📅 Événement'], ['nouveaute', '✨ Nouveauté'], ['partenaire', '🤝 Partenaire'], ['don', '💝 Appel aux dons']];
  const NIVEAUX = [['or', '🥇 Partenaire Or'], ['argent', '🥈 Partenaire Argent'], ['bronze', '🥉 Partenaire Bronze'], ['soutien', '🤝 Supporteur']];
  let api;
  const message = (t, ok) => { const m = $('#msgVitrine'); if (m) m.innerHTML = `<div class="${ok ? 'succes' : 'erreur'}">${E(t)}</div>`; };

  /* ---------- Annonces ---------- */
  async function annonces(a) {
    api = a;
    const liste = await api('/annonces?tous=1');
    setTimeout(brancherAnnonces, 0);
    return `<div class="section-titre"><h3>📢 Annonces défilantes</h3></div>
      <p style="color:var(--gris)">Les annonces en ligne défilent dans une barre en haut de toutes les pages de la bibliothèque (lecteurs et visiteurs). Un clic sur une annonce ouvre son lien, s’il y en a un.</p>
      <div id="msgVitrine"></div>
      <form class="panneau" id="formAnnonce" style="margin-bottom:18px"><input type="hidden" id="anId">
        <div class="champ"><label for="anTexte">Message (280 caractères maximum)</label><textarea id="anTexte" rows="2" maxlength="280" required placeholder="Ex. : 📚 50 nouveaux livres en créole ajoutés cette semaine !"></textarea></div>
        <div class="admin-form-grid">
          <div class="champ"><label for="anType">Type</label><select id="anType">${TYPES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
          <div class="champ"><label for="anLien">Lien (facultatif)</label><input id="anLien" type="url" placeholder="https://…"></div>
          <div class="champ"><label for="anDebut">Afficher à partir du</label><input id="anDebut" type="date"></div>
          <div class="champ"><label for="anFin">Jusqu’au (inclus)</label><input id="anFin" type="date"></div>
          <div class="champ"><label for="anOrdre">Ordre</label><input id="anOrdre" type="number" min="0" max="999" value="0"></div>
          <div class="champ"><label><input type="checkbox" id="anActif" checked> Annonce active</label></div>
        </div>
        <button class="btn btn-bleu" id="anEnregistrer">Publier l’annonce</button> <button type="button" class="mini-btn" id="anAnnuler" hidden>Annuler la modification</button>
      </form>
      ${liste.length ? `<table><thead><tr><th>Message</th><th>Type</th><th>Période</th><th>État</th><th></th></tr></thead><tbody>${liste.map(x => `<tr>
        <td style="white-space:normal;min-width:260px"><b>${E(x.texte)}</b>${x.lien ? `<br><small><a href="${E(x.lien)}" target="_blank" rel="noopener">${E(x.lien)}</a></small>` : ''}</td>
        <td>${E((TYPES.find(t => t[0] === x.type) || TYPES[0])[1])}</td>
        <td>${x.debut ? 'du ' + new Date(x.debut).toLocaleDateString('fr-FR') : ''} ${x.fin ? 'au ' + new Date(x.fin).toLocaleDateString('fr-FR') : x.debut ? '' : 'Sans limite'}</td>
        <td>${x.enLigne ? '<span class="pastille dispo">En ligne</span>' : x.actif === false ? '<span class="pastille indispo">Désactivée</span>' : '<span class="pastille indispo">Hors période</span>'}</td>
        <td><button class="mini-btn" data-an-modifier="${E(x.id)}">Modifier</button><button class="mini-btn" data-an-basculer="${E(x.id)}" data-actif="${x.actif !== false}">${x.actif === false ? 'Activer' : 'Désactiver'}</button><button class="mini-btn rouge" data-an-supprimer="${E(x.id)}">Supprimer</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="vide">Aucune annonce pour le moment.</p>'}`;
    function brancherAnnonces() {
      const form = $('#formAnnonce'); if (!form) return;
      const remplir = x => { $('#anId').value = x?.id || ''; $('#anTexte').value = x?.texte || ''; $('#anType').value = x?.type || 'info'; $('#anLien').value = x?.lien || ''; $('#anDebut').value = jour(x?.debut); $('#anFin').value = jour(x?.fin); $('#anOrdre').value = x?.ordre || 0; $('#anActif').checked = x ? x.actif !== false : true; $('#anEnregistrer').textContent = x ? 'Enregistrer les modifications' : 'Publier l’annonce'; $('#anAnnuler').hidden = !x; };
      form.onsubmit = async e => {
        e.preventDefault();
        const id = $('#anId').value, corps = { texte: $('#anTexte').value, type: $('#anType').value, lien: $('#anLien').value.trim(), debut: $('#anDebut').value, fin: $('#anFin').value, ordre: Number($('#anOrdre').value) || 0, actif: $('#anActif').checked };
        try { await api('/annonces' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(corps) }); document.querySelector('[data-onglet="annonces"]')?.click(); }
        catch (err) { message(err.message); }
      };
      $('#anAnnuler').onclick = () => remplir(null);
      document.querySelectorAll('[data-an-modifier]').forEach(b => b.onclick = () => { remplir(liste.find(x => x.id === b.dataset.anModifier)); form.scrollIntoView({ behavior: 'smooth' }); });
      document.querySelectorAll('[data-an-basculer]').forEach(b => b.onclick = async () => { try { await api('/annonces/' + b.dataset.anBasculer, { method: 'PUT', body: JSON.stringify({ actif: b.dataset.actif !== 'true' }) }); document.querySelector('[data-onglet="annonces"]')?.click(); } catch (err) { message(err.message); } });
      document.querySelectorAll('[data-an-supprimer]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer cette annonce ?')) return; try { await api('/annonces/' + b.dataset.anSupprimer, { method: 'DELETE' }); document.querySelector('[data-onglet="annonces"]')?.click(); } catch (err) { message(err.message); } });
    }
  }

  /* ---------- Partenaires ---------- */
  async function partenaires(a) {
    api = a;
    const liste = await api('/partenaires?tous=1');
    setTimeout(brancherPartenaires, 0);
    const champ = (id, label, type = 'text', extra = '') => `<div class="champ"><label for="pa-${id}">${label}</label><input id="pa-${id}" type="${type}" ${extra}></div>`;
    return `<div class="section-titre"><h3>🤝 Partenaires supporteurs</h3></div>
      <p style="color:var(--gris)">Chaque partenaire actif dispose d’une petite publicité : carte sur l’accueil et fiche complète dans la page « Partenaires » (logo, slogan, présentation, offre spéciale pour les membres OASIS, adresse, téléphone, WhatsApp, email, site et réseaux sociaux). Les visites des liens sont comptées.</p>
      <div id="msgVitrine"></div>
      <form class="panneau" id="formPartenaire" style="margin-bottom:18px"><input type="hidden" id="pa-id">
        <div class="admin-form-grid">
          ${champ('nom', 'Nom du partenaire *', 'text', 'required maxlength="120"')}
          <div class="champ"><label for="pa-niveau">Niveau de partenariat</label><select id="pa-niveau">${NIVEAUX.map(([v, n]) => `<option value="${v}" ${v === 'soutien' ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          ${champ('secteur', 'Secteur d’activité', 'text', 'maxlength="80" placeholder="Ex. : Librairie, Banque, Télécoms"')}
          ${champ('slogan', 'Slogan', 'text', 'maxlength="140"')}
          ${champ('offre', 'Offre spéciale pour les membres OASIS', 'text', 'maxlength="200" placeholder="Ex. : -10 % sur présentation de votre compte OASIS"')}
          ${champ('adresse', 'Adresse', 'text', 'maxlength="200"')}
          ${champ('telephone', 'Téléphone', 'tel', 'maxlength="40"')}
          ${champ('whatsapp', 'WhatsApp (avec indicatif, ex. +509…)', 'tel', 'maxlength="40"')}
          ${champ('email', 'Email', 'email', 'maxlength="160"')}
          ${champ('site', 'Site web', 'url', 'placeholder="https://…"')}
          ${champ('facebook', 'Page Facebook', 'url', 'placeholder="https://…"')}
          ${champ('instagram', 'Compte Instagram', 'url', 'placeholder="https://…"')}
          ${champ('boutonTexte', 'Texte du bouton principal', 'text', 'maxlength="40" placeholder="Visiter le site"')}
          ${champ('couleur', 'Couleur de la carte', 'color', 'value="#1e4fa3"')}
          ${champ('debut', 'Visible à partir du', 'date')}
          ${champ('fin', 'Visible jusqu’au (inclus)', 'date')}
          ${champ('ordre', 'Ordre dans son niveau', 'number', 'min="0" max="999" value="0"')}
          <div class="champ"><label for="pa-logo">Logo (PNG, JPEG ou WebP, 1 Mo maximum)</label><input id="pa-logo" type="file" accept="image/png,image/jpeg,image/webp"></div>
        </div>
        <div class="champ"><label for="pa-description">Présentation (700 caractères maximum)</label><textarea id="pa-description" rows="3" maxlength="700"></textarea></div>
        <div class="champ"><label><input type="checkbox" id="pa-actif" checked> Partenaire visible</label></div>
        <button class="btn btn-bleu" id="paEnregistrer">Ajouter le partenaire</button> <button type="button" class="mini-btn" id="paAnnuler" hidden>Annuler la modification</button>
      </form>
      ${liste.length ? `<table><thead><tr><th>Partenaire</th><th>Niveau</th><th>Période</th><th>Visites</th><th>État</th><th></th></tr></thead><tbody>${liste.map(p => `<tr>
        <td style="white-space:normal;min-width:220px">${p.logo ? `<img src="/api/partenaires/${E(p.id)}/logo?v=${p.logoV}" alt="" style="height:30px;vertical-align:middle;margin-right:8px;border-radius:6px">` : ''}<b>${E(p.nom)}</b>${p.slogan ? `<br><small>${E(p.slogan)}</small>` : ''}</td>
        <td>${E((NIVEAUX.find(n => n[0] === p.niveau) || NIVEAUX[3])[1])}</td>
        <td>${p.debut ? 'du ' + new Date(p.debut).toLocaleDateString('fr-FR') : ''} ${p.fin ? 'au ' + new Date(p.fin).toLocaleDateString('fr-FR') : p.debut ? '' : 'Sans limite'}</td>
        <td>${p.clics}</td>
        <td>${p.enLigne ? '<span class="pastille dispo">Visible</span>' : '<span class="pastille indispo">Masqué</span>'}</td>
        <td><button class="mini-btn" data-pa-modifier="${E(p.id)}">Modifier</button><button class="mini-btn rouge" data-pa-supprimer="${E(p.id)}">Supprimer</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="vide">Aucun partenaire pour le moment.</p>'}`;
    function brancherPartenaires() {
      const form = $('#formPartenaire'); if (!form) return;
      const cles = ['nom', 'niveau', 'secteur', 'slogan', 'offre', 'adresse', 'telephone', 'whatsapp', 'email', 'site', 'facebook', 'instagram', 'boutonTexte', 'couleur', 'ordre', 'description'];
      const remplir = p => {
        $('#pa-id').value = p?.id || '';
        cles.forEach(k => { $('#pa-' + k).value = p?.[k] ?? ({ niveau: 'soutien', couleur: '#1e4fa3', ordre: 0 }[k] ?? ''); });
        $('#pa-debut').value = jour(p?.debut); $('#pa-fin').value = jour(p?.fin); $('#pa-actif').checked = p ? p.actif : true; $('#pa-logo').value = '';
        $('#paEnregistrer').textContent = p ? 'Enregistrer les modifications' : 'Ajouter le partenaire'; $('#paAnnuler').hidden = !p;
      };
      form.onsubmit = async e => {
        e.preventDefault();
        const id = $('#pa-id').value, corps = Object.fromEntries(cles.map(k => [k, $('#pa-' + k).value.trim()]));
        corps.ordre = Number(corps.ordre) || 0; corps.debut = $('#pa-debut').value; corps.fin = $('#pa-fin').value; corps.actif = $('#pa-actif').checked;
        try {
          const p = await api('/partenaires' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(corps) });
          const f = $('#pa-logo').files[0];
          if (f) {
            const r = await fetch('/api/partenaires/' + p.id + '/logo', { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream', Authorization: 'Bearer ' + (localStorage.getItem('oasis_jeton') || '') }, body: f });
            if (!r.ok) throw Error(((await r.json().catch(() => ({}))).erreur || 'Logo refusé.') + ' Le partenaire est enregistré sans ce logo.');
          }
          document.querySelector('[data-onglet="partenaires"]')?.click();
        } catch (err) { message(err.message); }
      };
      $('#paAnnuler').onclick = () => remplir(null);
      document.querySelectorAll('[data-pa-modifier]').forEach(b => b.onclick = () => { remplir(liste.find(p => p.id === b.dataset.paModifier)); form.scrollIntoView({ behavior: 'smooth' }); });
      document.querySelectorAll('[data-pa-supprimer]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer ce partenaire et son logo ?')) return; try { await api('/partenaires/' + b.dataset.paSupprimer, { method: 'DELETE' }); document.querySelector('[data-onglet="partenaires"]')?.click(); } catch (err) { message(err.message); } });
    }
  }
  return { annonces, partenaires };
})();
