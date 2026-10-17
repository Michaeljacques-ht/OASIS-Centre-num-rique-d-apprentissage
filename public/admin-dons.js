/* OASIS — Administration des dons */
window.OasisAdminDons = (() => {
  let api, donnees;
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const htg = n => Number(n || 0).toLocaleString('fr-FR') + ' HTG';
  const date = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const csv = v => { let s = String(v ?? ''); if (/^\s*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const STATUTS = { paye: '✅ Confirmé', en_attente: '⏳ En attente', erreur: '⚠️ Non abouti' };
  const $ = id => document.getElementById(id);

  async function ouvrir(request) {
    api = request; donnees = await api('/admin-dons');
    const p = donnees.parametres, st = donnees.statistiques;
    return `<div class="section-titre"><h3>💝 Dons</h3></div>
      <p>Dons reçus des particuliers par la passerelle PLOP PLOP. Seuls les dons confirmés par la passerelle sont comptés.</p>
      ${donnees.configure ? '' : '<div class="erreur">Passerelle non configurée : définissez PLOP_CLIENT_ID et PLOP_CLIENT_SECRET pour accepter les dons.</div>'}
      <div class="stats">
        <div class="stat"><div class="libelle">Total confirmé</div><div class="valeur">${htg(st.total)}</div></div>
        <div class="stat"><div class="libelle">Dons confirmés</div><div class="valeur">${st.nombre}</div></div>
        <div class="stat"><div class="libelle">Donateurs</div><div class="valeur">${st.donateurs}</div></div>
        <div class="stat"><div class="libelle">Objectif</div><div class="valeur">${p.objectif ? Math.min(100, Math.round(st.total / p.objectif * 100)) + ' %' : '—'}</div></div>
      </div>
      <section class="panneau" style="margin:16px 0"><h4>Campagne de dons</h4>
        <form id="donsParam" class="dons-param">
          <label class="don-case"><input type="checkbox" name="actif" ${p.actif ? 'checked' : ''}> Accepter les dons</label>
          <label class="don-case"><input type="checkbox" name="afficherDonateurs" ${p.afficherDonateurs ? 'checked' : ''}> Afficher les derniers donateurs (les anonymes restent masqués)</label>
          <div class="champ"><label for="donsTitre">Titre</label><input id="donsTitre" name="titre" maxlength="120" value="${E(p.titre)}"></div>
          <div class="champ"><label for="donsMessage">Message aux donateurs</label><textarea id="donsMessage" name="message" rows="3" maxlength="800">${E(p.message)}</textarea></div>
          <div class="dons-param-grille">
            <div class="champ"><label for="donsObjectif">Objectif (HTG, 0 = aucun)</label><input id="donsObjectif" name="objectif" type="number" min="0" step="1" value="${p.objectif}"></div>
            <div class="champ"><label for="donsMax">Don maximal (HTG)</label><input id="donsMax" name="montantMax" type="number" min="20" step="1" value="${p.montantMax}"></div>
            <div class="champ"><label for="donsMontants">Montants suggérés (séparés par des virgules)</label><input id="donsMontants" name="montantsSuggeres" value="${E(p.montantsSuggeres.join(', '))}"></div>
          </div>
          <button class="btn btn-bleu">Enregistrer la campagne</button> <span id="donsParamMsg" role="status"></span>
        </form></section>
      <div class="abo-admin-filtres">
        <div class="champ"><label for="donsRecherche">Donateur ou référence</label><input id="donsRecherche" type="search" placeholder="Nom, email, référence…"></div>
        <div class="champ"><label for="donsStatut">Statut</label><select id="donsStatut"><option value="">Tous</option><option value="paye">Confirmés</option><option value="en_attente">En attente</option><option value="erreur">Non aboutis</option></select></div>
        <div class="champ"><label for="donsDebut">Du</label><input id="donsDebut" type="date"></div>
        <div class="champ"><label for="donsFin">Au</label><input id="donsFin" type="date"></div>
      </div>
      <p><button class="btn" id="donsCSV">Exporter les dons confirmés (CSV)</button> <span id="donsTotalFiltre"></span></p>
      <div id="donsTable"></div>`;
  }

  function brancher() {
    if (!$('donsTable')) return;
    let filtres = [];
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const peindre = () => {
      const q = norm($('donsRecherche').value), st = $('donsStatut').value, a = $('donsDebut').value, b = $('donsFin').value;
      filtres = donnees.dons.filter(d => (!q || norm([d.nom, d.email, d.id, d.numeroRecu, d.transaction].join(' ')).includes(q)) && (!st || d.statut === st)
        && (!a || d.date.slice(0, 10) >= a) && (!b || d.date.slice(0, 10) <= b));
      const total = filtres.filter(d => d.statut === 'paye').reduce((s, d) => s + d.montant, 0);
      $('donsTotalFiltre').textContent = `${filtres.length} don(s) affiché(s) · ${htg(total)} confirmés`;
      $('donsTable').innerHTML = `<div class="catalogue-table-scroll"><table class="table-comptabilite"><thead><tr><th>Date</th><th>Donateur</th><th>Montant</th><th>Affectation</th><th>Statut</th><th>Reçu</th><th>Message</th><th></th></tr></thead><tbody>
        ${filtres.map(d => `<tr><td>${date(d.date)}</td><td><b>${E(d.nom)}</b>${d.anonyme ? ' <small>(anonyme en public)</small>' : ''}<br><small>${E(d.email)}${d.telephone ? ' · ' + E(d.telephone) : ''}</small></td>
          <td>${htg(d.montant)}</td><td>${E(d.affectation)}</td><td>${STATUTS[d.statut] || E(d.statut)}</td><td><small>${E(d.numeroRecu || '—')}<br>${E(d.transaction)}</small></td>
          <td><small>${E(d.message)}</small></td><td>${d.statut === 'en_attente' ? `<button class="mini-btn bleu" data-don-admin-verifier="${E(d.id)}">Vérifier</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8">Aucun don.</td></tr>'}
        </tbody></table></div>`;
    };
    ['donsRecherche', 'donsStatut', 'donsDebut', 'donsFin'].forEach(id => $(id).addEventListener('input', peindre));
    $('donsTable').addEventListener('click', async e => {
      const b = e.target.closest('[data-don-admin-verifier]'); if (!b) return;
      b.disabled = true;
      try { const r = await api('/admin-dons/' + encodeURIComponent(b.dataset.donAdminVerifier) + '/verifier', { method: 'POST' });
        if (r.paye) { donnees = await api('/admin-dons'); peindre(); } else { b.textContent = 'Non confirmé'; } }
      catch (err) { b.textContent = err.message; } finally { b.disabled = false; }
    });
    $('donsCSV').onclick = () => {
      const lignes = [['Date', 'Reçu', 'Donateur', 'Email', 'Téléphone', 'Montant HTG', 'Affectation', 'Anonyme', 'Référence', 'Transaction', 'Message'],
        ...filtres.filter(d => d.statut === 'paye').map(d => [d.date, d.numeroRecu, d.nom, d.email, d.telephone, d.montant, d.affectation, d.anonyme ? 'oui' : 'non', d.id, d.transaction, d.message])];
      const blob = new Blob(['﻿' + lignes.map(l => l.map(csv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'dons-oasis.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    $('donsParam').onsubmit = async e => {
      e.preventDefault(); const f = e.target, msg = $('donsParamMsg');
      try {
        await api('/admin-dons/parametres', { method: 'PUT', body: JSON.stringify({ actif: f.elements.actif.checked, afficherDonateurs: f.elements.afficherDonateurs.checked,
          titre: f.elements.titre.value, message: f.elements.message.value, objectif: Number(f.elements.objectif.value || 0), montantMax: Number(f.elements.montantMax.value),
          montantsSuggeres: f.elements.montantsSuggeres.value.split(/[,;\s]+/).filter(Boolean).map(Number) }) });
        msg.textContent = '✅ Campagne enregistrée.';
      } catch (err) { msg.textContent = err.message; }
    };
    peindre();
  }
  return { ouvrir, brancher };
})();
