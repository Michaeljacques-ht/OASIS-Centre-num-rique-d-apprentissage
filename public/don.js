/* OASIS — Faire un don (portail) */
window.OasisDon = (() => {
  let api, moi, infos, minuteur;
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const htg = n => Number(n || 0).toLocaleString('fr-FR') + ' HTG';
  const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const CLE = 'oasis_dons';
  const locaux = () => { try { return JSON.parse(localStorage.getItem(CLE) || '[]'); } catch { return []; } };
  const memoriser = d => { try { const l = locaux().filter(x => x.id !== d.id); l.unshift(d); localStorage.setItem(CLE, JSON.stringify(l.slice(0, 20))); } catch {} };
  const $ = id => document.getElementById(id);
  const message = (t, ok) => { const m = $('donMessage'); if (m) { m.className = ok ? 'succes' : t ? 'erreur' : ''; m.textContent = t || ''; } };

  async function mesDons() {
    const connus = locaux();
    let serveur = [];
    if (moi) serveur = await api('/dons?mes=1').catch(() => []);
    const vus = new Set(serveur.map(d => d.id));
    const autres = await Promise.all(connus.filter(d => !vus.has(d.id)).slice(0, 8).map(d =>
      api('/dons/' + encodeURIComponent(d.id) + '?cle=' + encodeURIComponent(d.cle)).catch(() => null)));
    return [...serveur, ...autres.filter(Boolean)].sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  }

  function formulaire() {
    const montants = infos.montantsSuggeres;
    return `<form id="donForm" class="don-form panneau" novalidate>
      <h3>Choisissez votre montant</h3>
      <div class="don-montants" role="group" aria-label="Montants suggérés">
        ${montants.map((n, i) => `<button type="button" class="don-chip${i === 2 || (montants.length < 3 && i === 0) ? ' actif' : ''}" data-don-montant="${n}">${n.toLocaleString('fr-FR')} <small>HTG</small></button>`).join('')}
      </div>
      <div class="champ"><label for="donMontant">Montant (HTG)</label>
        <input id="donMontant" type="number" inputmode="numeric" min="${infos.montantMin}" max="${infos.montantMax}" step="1" required value="${montants[Math.min(2, montants.length - 1)] || ''}">
        <small>Minimum ${infos.montantMin} HTG, sans prélèvement automatique.</small></div>
      <div class="champ"><label for="donAffectation">Affecter mon don à</label>
        <select id="donAffectation">${Object.entries(infos.affectations).map(([k, v]) => `<option value="${k}">${E(v)}</option>`).join('')}</select></div>
      <div class="don-grille">
        <div class="champ"><label for="donNom">Nom complet</label><input id="donNom" autocomplete="name" maxlength="120" required value="${E(moi?.nom || '')}"></div>
        <div class="champ"><label for="donEmail">Email (pour le reçu)</label><input id="donEmail" type="email" autocomplete="email" maxlength="160" required value="${E(moi?.email || '')}"></div>
      </div>
      <div class="champ"><label for="donTel">Téléphone (facultatif)</label><input id="donTel" type="tel" autocomplete="tel" maxlength="30" placeholder="509 XXXX XXXX"></div>
      <div class="champ"><label for="donMot">Un mot pour l’équipe (facultatif)</label><textarea id="donMot" rows="2" maxlength="500" placeholder="Votre message d’encouragement"></textarea></div>
      <label class="don-case"><input type="checkbox" id="donAnonyme"> Donner anonymement — mon nom et mon message ne seront pas affichés publiquement</label>
      <div id="donMessage" role="status" aria-live="polite"></div>
      <button class="btn btn-orange btn-large" id="donPayer" ${infos.configure ? '' : 'disabled'}>💝 Donner <span id="donResume"></span> avec PLOP PLOP</button>
      <p class="don-note">Paiement sécurisé MonCash, NatCash ou Kashpaw sur la passerelle PLOP PLOP. Un reçu numéroté est émis dès la confirmation.</p>
      ${infos.configure ? '' : '<p class="erreur">La passerelle doit être configurée par l’administration avant de recevoir des dons.</p>'}
    </form>`;
  }

  function listeDons(liste) {
    if (!liste.length) return '';
    return `<section class="panneau don-historique"><h3>Mes dons</h3>${liste.map(d => `<div class="don-ligne">
      <div><b>${htg(d.montant)}</b> · ${E(dateFr(d.payeLe || d.creeLe))}<br><small>${E(d.affectation)}</small></div>
      <div>${d.statut === 'paye' ? `<span class="don-statut ok">✅ Confirmé</span> <button class="mini-btn" data-don-recu="${E(d.id)}">🧾 Reçu</button>`
        : d.statut === 'en_attente' ? `<span class="don-statut">⏳ En attente</span> <button class="mini-btn bleu" data-don-verifier="${E(d.id)}">Vérifier mon paiement</button>` : '<span class="don-statut ko">Non abouti</span>'}</div>
    </div>`).join('')}</section>`;
  }

  async function render(request, user) {
    api = request; moi = user;
    infos = await api('/dons/infos');
    const liste = await mesDons();
    const pct = infos.objectif ? Math.min(100, Math.round(infos.total / infos.objectif * 100)) : 0;
    setTimeout(brancher, 0);
    if (!infos.actif) return `<section class="panneau"><h3>${E(infos.titre)}</h3><p>Les dons sont momentanément suspendus. Merci de votre générosité, revenez bientôt.</p></section>${listeDons(liste)}`;
    return `<div class="don-hero">
        <div><span class="surtitre">FAIRE UN DON</span><h2>${E(infos.titre)}</h2><p>${E(infos.message)}</p></div>
        <div class="don-compteurs">
          <div><b>${htg(infos.total)}</b><small>collectés</small></div>
          <div><b>${infos.donateurs}</b><small>donateur${infos.donateurs > 1 ? 's' : ''}</small></div>
        </div>
        ${infos.objectif ? `<div class="don-objectif"><div class="don-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progression vers l’objectif"><span style="width:${pct}%"></span></div><small>${pct} % de l’objectif de ${htg(infos.objectif)}</small></div>` : ''}
      </div>
      <div class="don-colonnes">
        ${formulaire()}
        <div class="don-cote">
          ${listeDons(liste)}
          <section class="panneau"><h3>Ce que permet votre don</h3><ul class="don-impact">
            <li><span>📚</span> Acheter et numériser des livres haïtiens et scolaires</li>
            <li><span>🎓</span> Offrir des abonnements aux apprenants qui n’en ont pas les moyens</li>
            <li><span>📶</span> Équiper les salles de lecture et maintenir la connexion</li></ul></section>
          ${infos.recents.length ? `<section class="panneau"><h3>Merci à nos donateurs</h3>${infos.recents.map(r => `<div class="don-merci"><b>${E(r.nom)}</b> <small>${E(dateFr(r.date))}</small>${r.message ? `<p>« ${E(r.message)} »</p>` : ''}</div>`).join('')}</section>` : ''}
        </div>
      </div>`;
  }

  function resume() {
    const n = Number($('donMontant')?.value);
    if ($('donResume')) $('donResume').textContent = n >= (infos?.montantMin || 20) ? htg(n) : '';
    document.querySelectorAll('[data-don-montant]').forEach(b => b.classList.toggle('actif', Number(b.dataset.donMontant) === n));
  }

  function brancher() {
    const f = $('donForm');
    if (!f) return;
    resume();
    $('donMontant').addEventListener('input', resume);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const montant = Number($('donMontant').value);
      if (!Number.isInteger(montant) || montant < infos.montantMin) return message(`Indiquez un montant entier d’au moins ${infos.montantMin} HTG.`);
      if (!$('donNom').value.trim()) return message('Indiquez votre nom.');
      if (!/^\S+@\S+\.\S+$/.test($('donEmail').value.trim())) return message('Indiquez une adresse email valide pour recevoir votre reçu.');
      const bouton = $('donPayer'); bouton.disabled = true; message('Ouverture de la passerelle de paiement…', true);
      const fenetre = window.open('about:blank', 'oasis-don');
      try {
        const d = await api('/dons', { method: 'POST', body: JSON.stringify({ montant, nom: $('donNom').value.trim(), email: $('donEmail').value.trim(),
          telephone: $('donTel').value.trim(), message: $('donMot').value.trim(), affectation: $('donAffectation').value, anonyme: $('donAnonyme').checked }) });
        memoriser({ id: d.id, cle: d.cle, montant: d.montant, date: new Date().toISOString() });
        if (fenetre) fenetre.location.href = d.url;
        else { const a = document.createElement('a'); a.href = d.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ouvrir le paiement PLOP PLOP'; $('donMessage').replaceChildren(a); }
        message('Terminez le paiement sur PLOP PLOP. Cette page se met à jour dès la confirmation.', true);
        suivre(d.id);
      } catch (err) { if (fenetre && !fenetre.closed) fenetre.close(); message(err.message); }
      finally { bouton.disabled = false; }
    });
  }

  function suivre(id) {
    clearInterval(minuteur);
    let n = 0;
    minuteur = setInterval(async () => { if (++n > 120) return clearInterval(minuteur); try { if (await verifier(id, true)) clearInterval(minuteur); } catch {} }, 5000);
  }

  async function verifier(id, silencieux) {
    const local = locaux().find(x => x.id === id);
    const r = await api('/dons/verifier/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify({ cle: local?.cle }) });
    if (r.paye) {
      clearInterval(minuteur);
      const zone = document.getElementById('zonePrincipale');
      if (zone) { zone.innerHTML = await render(api, moi); }
      setTimeout(() => { message(`Merci ! Votre don de ${htg(r.don.montant)} est confirmé. Reçu n° ${r.don.numeroRecu}.`, true); document.getElementById('donMessage')?.scrollIntoView({ block: 'center' }); }, 30);
      return true;
    }
    if (!silencieux) message('Paiement non encore confirmé. Réessayez après avoir validé sur PLOP PLOP.');
    return false;
  }

  async function recu(id) {
    const local = locaux().find(x => x.id === id);
    const d = await api('/dons/' + encodeURIComponent(id) + (local ? '?cle=' + encodeURIComponent(local.cle) : ''));
    const w = window.open('', '_blank');
    if (!w) return message('Autorisez les fenêtres pour afficher le reçu.');
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${E(d.numeroRecu)}</title><style>
      body{font-family:'Segoe UI',system-ui,sans-serif;color:#10243e;max-width:640px;margin:40px auto;padding:0 24px}
      h1{font-size:22px;margin:0}.entete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e4fa3;padding-bottom:14px;margin-bottom:22px}
      table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:9px 4px;border-bottom:1px solid #e3e8f0}td:first-child{color:#64748b;width:42%}
      .montant{font-size:30px;font-weight:800;color:#1e4fa3}.merci{background:#eaf1fc;border-radius:10px;padding:14px 16px}small{color:#64748b}
      @media print{button{display:none}}</style></head><body>
      <div class="entete"><div><h1>${E(d.institution)}</h1><small>Reçu de don</small></div><div style="text-align:right"><b>${E(d.numeroRecu)}</b><br><small>${E(dateFr(d.payeLe))}</small></div></div>
      <p>Reçu de</p><p class="montant">${htg(d.montant)}</p>
      <table><tr><td>Donateur</td><td>${E(d.nom)}</td></tr><tr><td>Email</td><td>${E(d.email)}</td></tr>
      <tr><td>Affectation</td><td>${E(d.affectation)}</td></tr><tr><td>Moyen de paiement</td><td>PLOP PLOP${d.methode ? ' — ' + E(d.methode) : ''}</td></tr>
      <tr><td>Référence du don</td><td>${E(d.id)}</td></tr><tr><td>Transaction</td><td>${E(d.transaction || '—')}</td></tr></table>
      <p class="merci">Merci pour votre générosité. Votre soutien aide ${E(d.institution)} à rendre le savoir accessible à tous les apprenants.</p>
      <button onclick="print()" style="margin-top:20px;padding:10px 18px;border-radius:8px;border:0;background:#1e4fa3;color:#fff;font-weight:700">Imprimer / enregistrer en PDF</button>
      </body></html>`);
    w.document.close();
  }

  document.addEventListener('click', async e => {
    const chip = e.target.closest('[data-don-montant]');
    if (chip) { $('donMontant').value = chip.dataset.donMontant; resume(); return; }
    const v = e.target.closest('[data-don-verifier]');
    if (v) { v.disabled = true; try { await verifier(v.dataset.donVerifier); } catch (err) { message(err.message); } finally { v.disabled = false; } return; }
    const r = e.target.closest('[data-don-recu]');
    if (r) { try { await recu(r.dataset.donRecu); } catch (err) { message(err.message); } }
  });

  return { render };
})();
