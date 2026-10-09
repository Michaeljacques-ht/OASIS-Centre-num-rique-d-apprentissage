/* OASIS Bibliothèque Numérique — Portail apprenant */
(() => {
  const $ = s => document.querySelector(s);
  let jeton = localStorage.getItem('oasis_jeton') || localStorage.getItem('educa_jeton') || '';
  let moi = null;
  let vueActive = 'accueil';

  const echap = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(chemin, options = {}) {
    const rep = await fetch('/api' + chemin, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}), ...(options.headers || {}) }
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(data.erreur || 'Erreur serveur');
    return data;
  }

  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  const etoiles = (n, nb) => {
    const pleines = Math.round(n);
    return `<span class="etoiles" title="${n}/5">${'★'.repeat(pleines)}${'☆'.repeat(5 - pleines)} ${nb ? `<small>(${nb})</small>` : ''}</span>`;
  };
  const COULEURS_CAT = { Sciences: '#1f7a4d', Histoire: '#d1571f', 'Littérature': '#6e4a2a', Informatique: '#1e4fa3', Roman: '#8a1c1c', 'Mathématiques': '#14532d', Philosophie: '#334155' };
  const ICONES_CAT = { Sciences: '🔬', Histoire: '🏛️', 'Littérature': '📚', Informatique: '💻', Roman: '📖', 'Mathématiques': '📐', Philosophie: '🏺' };
  let infosCategories = {};
  async function chargerCategories() {
    try {
      const cats = await api('/categories');
      infosCategories = {};
      cats.forEach(c => { infosCategories[c.nom] = c; });
      return cats;
    } catch { return []; }
  }
  const iconeCat = nom => (infosCategories[nom] && infosCategories[nom].icone) || ICONES_CAT[nom] || '📘';
  const couleurCat = nom => (infosCategories[nom] && infosCategories[nom].couleur) || COULEURS_CAT[nom] || '#1e4fa3';

  // ---------- Authentification ----------
  let modeInscription = false;
  function initAuth() {
    $('#voirMdp').addEventListener('click', () => {
      const visible = $('#inMdp').type === 'password';
      $('#inMdp').type = visible ? 'text' : 'password';
      $('#voirMdp').textContent = visible ? 'Masquer' : 'Afficher';
      $('#voirMdp').setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      $('#voirMdp').setAttribute('aria-pressed', String(visible));
    });
    $('#lienBascule').addEventListener('click', e => {
      e.preventDefault();
      modeInscription = !modeInscription;
      $('#champNom').hidden = !modeInscription;
      $('#inNom').required = modeInscription;
      $('#inMdp').autocomplete = modeInscription ? 'new-password' : 'current-password';
      $('#titreConnexion').textContent = modeInscription ? 'Commencez votre parcours avec OASIS.' : 'Votre prochaine découverte commence ici.';
      $('#btnAuth').textContent = modeInscription ? 'Créer mon compte' : 'Se connecter';
      $('#txtBascule').textContent = modeInscription ? 'Déjà un compte ?' : 'Pas encore de compte ?';
      $('#lienBascule').textContent = modeInscription ? 'Se connecter' : 'Créer un compte';
      $('#msgAuth').innerHTML = '';
    });
    $('#formConnexion').addEventListener('submit', async e => {
      e.preventDefault();
      $('#msgAuth').innerHTML = '';
      try {
        const corps = { email: $('#inEmail').value.trim(), motDePasse: $('#inMdp').value };
        if (modeInscription) corps.nom = $('#inNom').value.trim();
        const r = await api(modeInscription ? '/inscription' : '/connexion', { method: 'POST', body: JSON.stringify(corps) });
        jeton = r.jeton; moi = r.utilisateur;
        localStorage.setItem('oasis_jeton', jeton); localStorage.removeItem('educa_jeton');
        demarrer();
      } catch (err) {
        $('#msgAuth').innerHTML = `<div class="erreur">${echap(err.message)}</div>`;
      }
    });
  }

  async function verifierSession() {
    if (!jeton) return false;
    try { moi = await api('/moi'); return true; }
    catch { jeton = ''; localStorage.removeItem('oasis_jeton'); localStorage.removeItem('educa_jeton'); return false; }
  }

  // ---------- Rendu des livres ----------
  const badgeType = l => l.hybride ? '📕+💻 Hybride' : l.versionNumerique ? '💻 E-book' : '📕 Physique';
  const carteLivre = l => `
    <button class="carte-livre" data-livre="${l.id}">
      ${l.couverture
        ? `<div class="couverture couverture-img"><img src="/api/livres/${l.id}/couverture" alt="Couverture de ${echap(l.titre)}" loading="lazy"><span class="badge-type">${badgeType(l)}</span></div>`
        : `<div class="couverture" style="background:linear-gradient(150deg, ${l.couleur}, ${l.couleur}cc 60%, #10243e)">
            <span class="badge-type">${badgeType(l)}</span>
            <div class="titre-couv">${echap(l.titre)}</div>
            <div class="icone-couv">${l.icone}</div>
          </div>`}
      <div class="infos">
        ${l.couverture ? `<b style="font-size:13.5px;color:var(--encre);display:block;line-height:1.25;margin-bottom:2px">${echap(l.titre)}</b>` : ''}
        <div class="auteur">${echap(l.auteur)}</div>
        ${etoiles(l.note, l.nbNotes)}
        <div style="margin-top:7px"><span class="etiquette" style="background:${couleurCat(l.categorie)}">${echap(l.categorie)}</span></div>
      </div>
    </button>`;

  const grille = livres => livres.length
    ? `<div class="grille-livres">${livres.map(carteLivre).join('')}</div>`
    : `<p class="vide">Aucun livre trouvé pour le moment.</p>`;

  // ---------- Vues ----------
  const vues = {
    abonnement: () => OasisAbonnement.render(api, moi),
    espace: async () => `<h2>Mon espace</h2><p>Bienvenue ${echap(moi?.nom || "")}. Retrouvez vos lectures dans la bibliothèque et gérez votre abonnement ci-dessous.</p><button class="btn btn-bleu" data-vue="bibliotheque">Explorer la bibliothèque</button>` + await OasisAbonnement.render(api, moi),
    async accueil() {
      const [nouveautes, cats] = await Promise.all([
        api('/livres?tri=nouveautes'),
        chargerCategories()
      ]);
      return `
        <button class="banniere-accueil" data-vue="bibliotheque" aria-label="Accéder à la bibliothèque">
          <img src="/banniere-oasis.png" alt="OASIS Bibliothèque Numérique — Apprendre aujourd'hui pour un meilleur demain">
        </button>
        <div class="hero">
          <div>
            <h2>${echap(parametres.slogan || 'Apprendre aujourd\'hui pour un meilleur demain')}</h2>
            <p>Explorez notre collection de livres, e-books et ressources éducatives conçus pour les apprenants haïtiens.</p>
            <button class="btn-orange" data-vue="bibliotheque">Accéder</button>
          </div>
        </div>
        <div class="section-titre"><h3>Nouveautés</h3><button data-vue="nouveautes">Voir Plus ›</button></div>
        ${grille(nouveautes.slice(0, 4))}
        <div class="section-titre"><h3>Catégories Populaires</h3><button data-vue="categories">Voir Plus ›</button></div>
        <div class="grille-categories">
          ${cats.sort((a,b) => b.nbLivres - a.nbLivres).slice(0, 4).map(c => `
            <button class="carte-categorie" data-categorie="${echap(c.nom)}">
              <span class="ic">${c.icone}</span>${echap(c.nom)}<small>${c.nbLivres} ouvrage${c.nbLivres>1?'s':''}</small>
            </button>`).join('')}
        </div>`;
    },
    async bibliotheque(q) {
      let livres = await api('/livres' + (q ? '?q=' + encodeURIComponent(q) : ''));
      catalogueCache = livres;
      const f = filtresBiblio;
      const distincts = cle => [...new Set(catalogueCache.map(l => l[cle]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
      let filtres = livres.filter(l =>
        (!f.categorie || l.categorie === f.categorie) &&
        (!f.langue || l.langue === f.langue) &&
        (!f.niveau || l.niveau === f.niveau) &&
        (!f.type || (f.type === 'hybride' ? l.hybride : f.type === 'numerique' ? l.versionNumerique : l.versionPhysique)));
      if (f.tri === 'note') filtres.sort((a, b) => b.note - a.note);
      else if (f.tri === 'annee') filtres.sort((a, b) => b.annee - a.annee);
      const sel = (id, libelle, options, val) => `<select data-filtre="${id}"><option value="">${libelle}</option>${options.map(o => `<option ${o === val ? 'selected' : ''} value="${echap(String(o))}">${echap(String(o))}</option>`).join('')}</select>`;
      return `<div class="section-titre"><h3>${q ? `Résultats pour « ${echap(q)} »` : 'Toute la Bibliothèque'}</h3><span style="color:var(--gris);font-size:13px">${filtres.length} ouvrage${filtres.length>1?'s':''}</span></div>
        <div class="filtres-biblio">
          ${sel('categorie', 'Catégorie', distincts('categorie'), f.categorie)}
          ${sel('langue', 'Langue', distincts('langue'), f.langue)}
          ${sel('niveau', 'Niveau scolaire', distincts('niveau'), f.niveau)}
          <select data-filtre="type"><option value="">Format</option><option value="physique" ${f.type==='physique'?'selected':''}>📕 Physique</option><option value="numerique" ${f.type==='numerique'?'selected':''}>💻 E-book</option><option value="hybride" ${f.type==='hybride'?'selected':''}>📕+💻 Hybride</option></select>
          <select data-filtre="tri"><option value="">Trier…</option><option value="note" ${f.tri==='note'?'selected':''}>Meilleures notes</option><option value="annee" ${f.tri==='annee'?'selected':''}>Plus récents</option></select>
          ${Object.values(f).some(Boolean) ? '<button class="mini-btn" data-vider-filtres="1">✕ Réinitialiser</button>' : ''}
        </div>
        ${grille(filtres)}`;
    },
    async favoris() {
      const livres = await api('/favoris');
      return `<div class="section-titre"><h3>❤️ Mes Favoris</h3></div>${livres.length ? grille(livres) : '<p class="vide">Aucun favori pour l\'instant. Ouvrez un livre et touchez ❤️ pour l\'ajouter ici.</p>'}`;
    },
    async emprunts() {
      const [liste, resas] = await Promise.all([api('/emprunts'), api('/reservations?actives=1')]);
      const blocResas = resas.length ? `
        <div class="section-titre"><h3>📌 Mes Réservations</h3></div>
        <table style="margin-bottom:22px"><thead><tr><th>Livre</th><th>Statut</th><th></th></tr></thead><tbody>
        ${resas.map(r => `<tr>
          <td>${r.livre?.icone || ''} <b>${echap(r.livre?.titre || '—')}</b></td>
          <td>${r.statut === 'prete'
            ? `<span class="pastille dispo">✅ Prête ! À retirer avant le ${new Date(r.echeanceRetrait).toLocaleDateString('fr-FR')}${r.cote ? ` (cote ${echap(r.cote)})` : ''}</span>`
            : `⏳ Position n° ${r.position} dans la file d'attente`}</td>
          <td><button class="mini-btn rouge" data-annuler-resa="${r.id}">Annuler</button></td>
        </tr>`).join('')}
        </tbody></table>` : '';
      if (!liste.length && !resas.length) return `<div class="section-titre"><h3>🔖 Mes Emprunts</h3></div><p class="vide">Aucun emprunt ni réservation. Parcourez la bibliothèque pour emprunter un livre.</p>`;
      return `${blocResas}<div class="section-titre"><h3>🔖 Mes Emprunts</h3></div>
        ${liste.length ? `<table><thead><tr><th>Livre</th><th>Type</th><th>Emprunté le</th><th>Échéance</th><th>Statut</th><th></th></tr></thead><tbody>
        ${liste.map(e => `<tr>
          <td><b>${echap(e.livre?.titre || '—')}</b><br><small style="color:var(--gris)">${echap(e.livre?.auteur || '')}</small></td>
          <td>${e.cote ? `📕 Physique (${echap(e.cote)})` : '💻 E-book'}</td>
          <td>${new Date(e.dateEmprunt).toLocaleDateString('fr-FR')}</td>
          <td>${new Date(e.echeance).toLocaleDateString('fr-FR')}</td>
          <td>${e.statut === 'retourne' ? '✅ Retourné' : e.joursRetard > 0 ? `<span class="retard">⚠️ ${e.joursRetard} j de retard</span>` : '📗 En cours'}</td>
          <td>${e.statut === 'en_cours' ? `<button class="mini-btn" data-prolonger="${e.id}">Prolonger +7 j</button>` : ''}
              ${e.statut === 'en_cours' && e.livre?.versionNumerique ? `<button class="mini-btn bleu" data-lire="${e.livreId}">Lire</button>` : ''}</td>
        </tr>`).join('')}
        </tbody></table>` : '<p class="vide">Aucun emprunt pour l\'instant.</p>'}`;
    },
    async ressources(genre) {
      const liste = await api('/ressources' + (genre ? '?genre=' + genre : ''));
      cacheRessources = liste;
      const GENRES = [['', 'Tout'], ['dictionnaire', '📖 Dictionnaire'], ['encyclopedie', '🌍 Encyclopédie'], ['base', '🗄️ Bases de données'], ['administratif', '📋 Administratifs'], ['historique', '📜 Historiques']];
      const NOMS = { dictionnaire: '📖 Dictionnaire', encyclopedie: '🌍 Encyclopédie', base: '🗄️ Base de données', administratif: '📋 Document administratif', historique: '📜 Document historique' };
      return `<div class="section-titre"><h3>🔎 Ressources documentaires</h3></div>
        <div class="onglets">${GENRES.map(([g, n]) => `<button class="onglet ${g === (genre || '') ? 'actif' : ''}" data-genre-res="${g}">${n}</button>`).join('')}</div>
        ${liste.length ? liste.map(r => `
          <button class="ligne-populaire" data-ressource="${r.id}" style="align-items:flex-start">
            ${r.image
              ? `<div class="mini-couv couverture-img" style="height:46px"><img src="/api/ressources/${r.id}/image" alt="" loading="lazy"></div>`
              : `<div class="mini-couv" style="background:linear-gradient(150deg, var(--bleu), #10243e);height:46px">${r.icone || (r.genre === 'dictionnaire' ? '📖' : r.genre === 'encyclopedie' ? '🌍' : '🗄️')}</div>`}
            <div><b>${echap(r.titre)}${r.lien ? ' 🔗' : ''}</b>
              <span class="auteur">${NOMS[r.genre]}${r.source ? ' · ' + echap(r.source) : ''}</span><br>
              <span style="font-size:12.5px;color:var(--gris)">${echap(r.contenu.slice(0, 110))}${r.contenu.length > 110 ? '…' : ''}</span>
            </div>
          </button>`).join('') : '<p class="vide">Aucune ressource dans cette section. Utilisez la barre de recherche ou choisissez une autre section.</p>'}`;
    },
    async collaboration(type) {
      const t = type || 'club';
      const groupes = await api(t === 'miens' ? '/groupes?miens=1' : '/groupes?type=' + t);
      const ONGLETS = [['club', '📖 Clubs de lecture'], ['etude', '🎓 Groupes d\'étude'], ['miens', '👤 Mes groupes']];
      return `<div class="section-titre"><h3>👥 Collaboration</h3>
          <button class="btn btn-bleu" data-creer-groupe="${t === 'etude' ? 'etude' : 'club'}">+ Créer un ${t === 'etude' ? "groupe d'étude" : 'club de lecture'}</button></div>
        <div class="onglets">${ONGLETS.map(([g, n]) => `<button class="onglet ${g === t ? 'actif' : ''}" data-onglet-collab="${g}">${n}</button>`).join('')}</div>
        ${groupes.length ? groupes.map(g => `
          <button class="ligne-populaire" data-groupe="${g.id}" style="align-items:flex-start">
            <div class="mini-couv" style="background:linear-gradient(150deg, ${g.type === 'club' ? 'var(--bleu)' : '#1f7a4d'}, #10243e)">${g.type === 'club' ? '📖' : '🎓'}</div>
            <div style="flex:1"><b>${echap(g.nom)}</b>
              <span class="auteur">${g.type === 'club' ? 'Club de lecture' : "Groupe d'étude"}${g.livre ? ' · ' + g.livre.icone + ' ' + echap(g.livre.titre) : ''} · créé par ${echap(g.createur)}</span><br>
              <small style="color:var(--gris)">${g.nbMembres} membre${g.nbMembres > 1 ? 's' : ''} · ${g.nbMessages} message${g.nbMessages > 1 ? 's' : ''}${g.dernierMessage ? ' · dernier : « ' + echap(g.dernierMessage.texte) + '… »' : ''}</small>
              ${g.membre ? '<br><span class="etiquette" style="background:var(--vert);margin-top:4px">✓ Membre</span>' : ''}
            </div>
          </button>`).join('')
        : `<p class="vide">${t === 'miens' ? 'Vous n\'avez rejoint aucun groupe pour le moment.' : 'Aucun groupe dans cette section — créez le premier !'}</p>`}`;
    },
    async multimedia(type) {
      const t = type || 'audio';
      const medias = await api('/medias?type=' + t);
      cacheMedias = medias;
      const ONGLETS = [['audio', '🎧 Audiothèque'], ['carte', '🗺️ Cartothèque'], ['video', '🎬 Cinémathèque']];
      const ICO = { audio: '🎧', carte: '🗺️', video: '🎬' };
      const SOUS = { audio: 'Livres audio, podcasts, conférences, cours de langues…',
        carte: 'Cartes d\'Haïti et du monde : politiques, topographiques, historiques, thématiques…',
        video: 'Documentaires, cours filmés, archives, tutoriels, formations…' };
      return `<div class="section-titre"><h3>🎬 Bibliothèque multimédia</h3></div>
        <div class="onglets">${ONGLETS.map(([g, n]) => `<button class="onglet ${g === t ? 'actif' : ''}" data-onglet-media="${g}">${n}</button>`).join('')}</div>
        <p style="color:var(--gris);font-size:13px;margin-bottom:14px">${SOUS[t]}</p>
        ${medias.length ? `<div class="grille-livres">${medias.map(x => `
          <button class="carte-livre" data-media="${x.id}">
            <div class="couverture" style="background:linear-gradient(150deg, var(--bleu), #10243e)">
              <span class="badge-type">${x.fichier ? ICO[x.type] + ' ' + (x.duree || 'Disponible') : '⏳ Bientôt'}</span>
              <div class="titre-couv">${echap(x.titre)}</div>
              <div class="icone-couv">${ICO[x.type]}</div>
            </div>
            <div class="infos">
              <div class="auteur">${echap(x.auteur || '')}</div>
              <small style="color:var(--gris)">${echap(x.categorie || '')}${x.lieu ? ' · ' + echap(x.lieu) : ''} · ${echap(x.langue)}</small>
              ${x.maPosition > 0 && x.type !== 'carte' ? `<div class="barre-progression" style="margin-top:6px"><div style="width:40%"></div></div><small style="color:var(--gris)">Reprendre à ${Math.floor(x.maPosition / 60)} min ${x.maPosition % 60} s</small>` : ''}
            </div>
          </button>`).join('')}</div>`
        : `<p class="vide">Aucun contenu dans cette section pour le moment — le bibliothécaire peut en ajouter depuis l'espace de gestion.</p>`}`;
    },
    async places(date) {
      const jour = date || new Date().toISOString().slice(0, 10);
      const d = await api('/places?date=' + jour);
      dateplaceActive = d.date;
      return `<div class="section-titre"><h3>🪑 Places de lecture</h3></div>
        <div class="panneau" style="margin-bottom:16px">
          <p style="margin-bottom:10px">Réservez une place assise en salle de lecture de la bibliothèque (${d.nbPlaces} places par créneau).</p>
          <div class="champ" style="max-width:240px"><label for="inDatePlace">Date</label>
            <input id="inDatePlace" type="date" value="${d.date}" min="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <table><thead><tr><th>Créneau</th><th>Disponibilité</th><th></th></tr></thead><tbody>
        ${d.creneaux.map(c => `<tr>
          <td><b>${c.creneau}</b></td>
          <td>${c.maReservationId
            ? `<span class="pastille dispo">✅ Votre place : n° ${c.maPlace}</span>`
            : c.libres > 0
              ? `<span class="pastille dispo">${c.libres}/${d.nbPlaces} place${c.libres > 1 ? 's' : ''} libre${c.libres > 1 ? 's' : ''}</span>`
              : '<span class="pastille indispo">Complet</span>'}</td>
          <td>${c.maReservationId
            ? `<button class="mini-btn rouge" data-annuler-place="${c.maReservationId}">Annuler</button>`
            : c.libres > 0 ? `<button class="mini-btn bleu" data-reserver-place="${c.creneau}">Réserver</button>` : ''}</td>
        </tr>`).join('')}
        </tbody></table>`;
    },
    async categories() {
      const cats = await chargerCategories();
      return `<div class="section-titre"><h3>🗂️ Toutes les Catégories</h3></div>
        <div class="grille-categories">
          ${cats.map(c => `
            <button class="carte-categorie" data-categorie="${echap(c.nom)}">
              <span class="ic">${c.icone}</span>${echap(c.nom)}<small>${c.nbLivres} ouvrage${c.nbLivres>1?'s':''}</small>
            </button>`).join('')}
        </div>`;
    },
    async categorie(nom) {
      const livres = await api('/livres?categorie=' + encodeURIComponent(nom));
      return `<div class="section-titre"><h3>${iconeCat(nom)} ${echap(nom)}</h3><button data-vue="categories">‹ Toutes les catégories</button></div>${grille(livres)}`;
    },
    async nouveautes() {
      const livres = await api('/livres?tri=nouveautes');
      return `<div class="section-titre"><h3>✨ Nouveautés</h3></div>${grille(livres)}`;
    },
    async recommandes() {
      const r = await api('/recommandations');
      return `<div class="section-titre"><h3>⭐ Recommandés pour vous</h3></div>
        ${r.personnalise ? `<p style="color:var(--gris);font-size:13px;margin-bottom:12px">Basé sur vos intérêts : <b>${r.interets.map(echap).join(', ')}</b> (favoris, emprunts et lectures)</p>` : '<p style="color:var(--gris);font-size:13px;margin-bottom:12px">Ajoutez des favoris et lisez des livres pour affiner vos recommandations.</p>'}
        ${grille(r.livres)}`;
    },
    async defis() {
      const d = await api('/classement');
      const paliers = [[1, '📗', 'Premier livre'], [3, '📚', 'Lecteur régulier'], [5, '🏅', 'Grand lecteur'], [10, '🏆', 'Maître lecteur']];
      return `<div class="section-titre"><h3>🏆 Défis de lecture</h3></div>
        <p style="margin-bottom:12px">Vous avez terminé <b>${d.mesTermines}</b> livre${d.mesTermines > 1 ? 's' : ''}. Terminez des lectures pour débloquer les badges !</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:24px">
          ${paliers.map(([n, e, titre]) => `
            <div class="carte-badge ${d.mesTermines >= n ? 'obtenu' : ''}">
              <span class="embleme">${e}</span>
              <div><b>${titre}</b><br><small style="color:var(--gris)">${d.mesTermines >= n ? '✅ Obtenu !' : `Terminez ${n} livre${n > 1 ? 's' : ''} (${d.mesTermines}/${n})`}</small></div>
            </div>`).join('')}
        </div>
        <div class="section-titre"><h3>🥇 Classement des lecteurs</h3></div>
        <table><thead><tr><th>#</th><th>Lecteur</th><th>Livres terminés</th><th>En cours</th></tr></thead><tbody>
        ${d.classement.map((u, i) => `<tr ${u.moi ? 'style="background:var(--bleu-clair)"' : ''}>
          <td>${['🥇','🥈','🥉'][i] || (i + 1)}</td><td><b>${echap(u.nom)}</b>${u.moi ? ' (vous)' : ''}</td>
          <td>${u.termines}</td><td>${u.enCours}</td></tr>`).join('')}
        </tbody></table>`;
    },
    async liste() {
      const livres = await api('/liste');
      return `<div class="section-titre"><h3>📋 Ma Liste de Lecture</h3></div>${livres.length ? grille(livres) : '<p class="vide">Votre liste est vide. Ouvrez un livre et touchez 📋 pour planifier vos lectures.</p>'}`;
    }
  };

  async function afficherVue(nom, param) {
    if(!moi&&!['accueil','bibliotheque','categorie','categories','nouveautes','recommandes','abonnement'].includes(nom)){window.dispatchEvent(new Event('oasis-connexion'));return;}
    vueActive = nom;
    document.querySelectorAll('.nav-item[data-vue]').forEach(b => b.classList.toggle('actif', b.dataset.vue === nom));
    $('#sidebar').classList.remove('ouverte');
    $('#btnMenu').setAttribute('aria-expanded', 'false');
    const zone = $('#zonePrincipale');
    zone.innerHTML = '<p class="vide">Chargement…</p>';
    try { zone.innerHTML = await (vues[nom] || vues.accueil)(param); }
    catch (err) { zone.innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
  }

  // ---------- Panneaux latéraux ----------
  const miniatureLivre = l => l.couverture
    ? `<div class="mini-couv couverture-img"><img src="/api/livres/${encodeURIComponent(l.id)}/couverture" alt="Couverture de ${echap(l.titre)}" loading="lazy"></div>`
    : `<div class="mini-couv" style="background:linear-gradient(150deg, ${l.couleur}, #10243e)">${l.icone || '📘'}</div>`;
  async function rafraichirPanneaux() {
    try {
      const [pop, liste, histo] = await Promise.all([api('/livres?tri=populaires'), api('/liste'), api('/historique')]);
      const enCours = histo.filter(h => !h.termine && h.pourcentage > 0 && h.pourcentage < 100).slice(0, 3);
      let zoneReprise = document.getElementById('zoneReprise');
      if (!zoneReprise && enCours.length) {
        const panneau = document.createElement('div');
        panneau.className = 'panneau';
        panneau.innerHTML = '<div class="p-titre"><h4>📖 Reprendre la lecture</h4></div><div id="zoneReprise"></div>';
        document.getElementById('colonneDroite').prepend(panneau);
        zoneReprise = document.getElementById('zoneReprise');
      }
      if (zoneReprise) zoneReprise.innerHTML = enCours.map(h => `
        <button class="ligne-populaire" data-lire="${h.livre.id}">
          ${miniatureLivre(h.livre)}
          <div style="flex:1"><b>${echap(h.livre.titre)}</b>
            <div class="barre-progression" style="margin:5px 0 2px"><div style="width:${h.pourcentage}%"></div></div>
            <small style="color:var(--gris)">${h.pourcentage} % lu — continuer</small></div>
        </button>`).join('') || '<p class="vide">Aucune lecture en cours.</p>';
      $('#zonePopulaires').innerHTML = pop.slice(0, 4).map(l => `
        <button class="ligne-populaire" data-livre="${l.id}">
          ${miniatureLivre(l)}
          <div><b>${echap(l.titre)}</b><span class="auteur">${echap(l.auteur)}</span><br>${etoiles(l.note)}</div>
        </button>`).join('') || '<p class="vide">Bientôt disponible.</p>';
      $('#zoneListe').innerHTML = liste.slice(0, 5).map((l, i) => `
        <button class="ligne-liste" data-livre="${l.id}">${miniatureLivre(l)}<b>${echap(l.titre)}</b></button>`).join('')
        || '<p class="vide">Ajoutez des livres avec 📋 pour planifier vos lectures.</p>';
    } catch { /* silencieux */ }
  }

  // ---------- Fiche livre ----------
  async function ouvrirLivre(id) {
    let l;
    try { l = await api('/livres/' + id); } catch (err) { return toast(err.message); }
    const lignesDispo = [];
    if (l.versionNumerique) lignesDispo.push(`<div class="ligne-dispo num">💻 Disponible en ligne — lecture immédiate${l.pdf ? ' (PDF)' : ''}</div>`);
    if (l.versionPhysique) lignesDispo.push(l.nbDisponibles > 0
      ? `<div class="ligne-dispo dispo">📕 En rayon : ${l.nbDisponibles}/${l.nbExemplaires} exemplaire${l.nbExemplaires>1?'s':''} disponible${l.nbDisponibles>1?'s':''}</div>`
      : `<div class="ligne-dispo indispo">📕 En rayon : tous les exemplaires sont empruntés${l.versionNumerique ? ' — la version numérique reste accessible' : ''}</div>`);
    if (l.maReservation) lignesDispo.push(l.maReservation.statut === 'prete'
      ? `<div class="ligne-dispo dispo">📌 Votre réservation est prête ! À retirer avant le ${new Date(l.maReservation.echeanceRetrait).toLocaleDateString('fr-FR')}</div>`
      : `<div class="ligne-dispo num">📌 Réservé — position n° ${l.maReservation.position} dans la file (${l.nbReservations} au total)</div>`);
    else if (l.versionPhysique && l.nbDisponibles === 0 && l.nbReservations > 0) lignesDispo.push(`<div class="ligne-dispo num">📌 ${l.nbReservations} personne${l.nbReservations>1?'s':''} en file d'attente</div>`);
    if (!lignesDispo.length) lignesDispo.push('<div class="ligne-dispo indispo">Aucune version disponible pour le moment</div>');
    const dispo = `<div class="bloc-dispo">
      ${l.hybride ? '<b style="display:block;font-size:12.5px;color:var(--bleu);margin-bottom:8px">📕+💻 Titre hybride — disponible en rayon et en version numérique</b>' : ''}
      ${lignesDispo.join('')}</div>`;
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true" aria-label="${echap(l.titre)}">
          <div class="modale-entete">
            ${l.couverture
              ? `<div class="modale-couv couverture-img"><img src="/api/livres/${l.id}/couverture" alt=""></div>`
              : `<div class="modale-couv" style="background:linear-gradient(150deg, ${l.couleur}, #10243e)">${l.icone}</div>`}
            <div style="flex:1">
              <h3>${echap(l.titre)}</h3>
              <p style="color:var(--gris);font-weight:600">${echap(l.auteur)} · ${l.annee}</p>
              <div style="margin:6px 0">${etoiles(l.note, l.nbNotes)}</div>
              <span class="etiquette" style="background:${couleurCat(l.categorie)}">${echap(l.categorie)}</span>
            </div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button>
          </div>
          <div class="corps">
            ${l.resume ? `<p style="margin-bottom:14px">${echap(l.resume)}</p>` : ''}
            ${dispo}
            <div class="rangee-boutons">
              ${l.versionNumerique ? `<button class="btn btn-bleu" data-lire="${l.id}">${!l.accesComplet ? '📖 Aperçu gratuit' : l.epub && !l.pdf ? '📖 Lire EPUB' : '📖 Lire en ligne'}</button>` : ''}
              ${l.versionPhysique && l.nbDisponibles > 0 ? `<button class="btn ${l.versionNumerique ? '' : 'btn-bleu'}" data-emprunter="${l.id}">📕 Emprunter l'exemplaire (${parametres.dureeEmpruntPhysique || 14} jours)</button>` : ''}
              ${l.versionPhysique && l.nbDisponibles === 0 && !l.maReservation ? `<button class="btn ${l.versionNumerique ? '' : 'btn-bleu'}" data-reserver="${l.id}">📌 Réserver — rejoindre la file</button>` : ''}
              ${l.maReservation ? `<button class="btn btn-danger" data-annuler-resa="${l.maReservation.id}" data-livre-ctx="${l.id}">Annuler ma réservation</button>` : ''}
              <button class="btn" data-favori="${l.id}">${l.favori ? '💔 Retirer des favoris' : '❤️ Ajouter aux favoris'}</button>
              <button class="btn" data-liste="${l.id}">${l.dansListe ? '📋 Retirer de ma liste' : '📋 Ajouter à ma liste'}</button>
              <button class="btn" data-notes-livre="${l.id}" data-titre-livre="${echap(l.titre)}">🗒️ Mes notes</button>
              <button class="btn" data-citer="${l.id}">📑 Citer</button>
              <button class="btn" data-partager="${l.id}" data-titre-livre="${echap(l.titre)}">🔗 Partager</button>
              <button class="btn" data-commentaires="${l.id}" data-ct="livre" data-tt="${echap(l.titre)}">💬 Commentaires</button>
            </div>
            ${l.maProgression && l.maProgression.pourcentage > 0 ? `
              <div style="margin-top:14px">
                <small style="font-weight:700;color:var(--encre)">${l.maProgression.termine ? '✅ Lecture terminée' : `📖 Lecture en cours : ${l.maProgression.pourcentage} %`}</small>
                <div class="barre-progression"><div style="width:${l.maProgression.pourcentage}%"></div></div>
              </div>` : ''}
            ${(l.editeur || l.niveau || l.isbn || l.motsCles) ? `
              <p style="margin-top:12px;font-size:12.5px;color:var(--gris)">
                ${l.editeur ? 'Éditeur : ' + echap(l.editeur) + ' · ' : ''}${l.langue ? 'Langue : ' + echap(l.langue) + ' · ' : ''}${l.niveau ? 'Niveau : ' + echap(l.niveau) + ' · ' : ''}${l.isbn ? 'ISBN : ' + echap(l.isbn) : ''}
                ${l.motsCles ? '<br>Mots-clés : ' + echap(l.motsCles) : ''}</p>` : ''}
            <div style="margin-top:16px">
              <b style="font-size:13px;color:var(--encre)">Noter ce livre :</b>
              <span style="font-size:22px;cursor:pointer;color:var(--orange)">
                ${[1,2,3,4,5].map(n => `<span data-noter="${n}" data-livre-note="${l.id}" role="button" tabindex="0" aria-label="${n} étoile${n>1?'s':''}">☆</span>`).join('')}
              </span>
            </div>
          </div>
        </div>
      </div>`;
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }
  const fermerModale = () => {
    window.OasisEpub?.close();
    if (nettoyerPdf) { nettoyerPdf(); nettoyerPdf = null; }
    $('#zoneModale').innerHTML = '';
    if (urlPdfActive) { URL.revokeObjectURL(urlPdfActive); urlPdfActive = null; }
    if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
  };

  let urlPdfActive = null;
  let cacheRessources = [];
  let cacheMedias = [];
  let minuteurSommeil = null;
  let minuteurPosition = null;
  let dateplaceActive = null;
  let parametres = {};
  let catalogueCache = [];
  let filtresBiblio = { categorie: '', langue: '', niveau: '', type: '', tri: '' };
  let syntheseVocale = null;
  function majSalutation() {
    const el = $('#titreEntete');
    if (!el) return;
    const h = new Date().getHours();
    const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    const prenom = moi ? echap(moi.nom.split(' ')[0]) : '';
    const message = echap(parametres.messageAccueil || 'bienvenue dans votre bibliothèque !');
    el.innerHTML = `<span class="salutation-ligne">👋 ${salut}${prenom ? ' <span>' + prenom + '</span>' : ''}</span><span class="salutation-separateur"> — </span><span class="salutation-message">${message}</span>`;
  }
  async function chargerParametres() {
    try { parametres = await api('/parametres'); } catch { parametres = {}; }
    appliquerParametres();
  }
  function appliquerParametres() {
    const nom = parametres.nom || 'OASIS Bibliothèque Numérique';
    document.title = nom;
    const mots = nom.split(' ');
    majSalutation();
    if ($('#logoNom')) $('#logoNom').innerHTML = 'OASIS';
    if ($('#logoSous')) $('#logoSous').textContent = 'BIBLIOTHÈQUE NUMÉRIQUE';
    if ($('#sousConnexion') && parametres.slogan) $('#sousConnexion').textContent = parametres.slogan;
    const pied = $('#piedPage');
    if (pied) {
      const blocs = [];
      blocs.push(`<div class="bloc"><b>${echap(nom)}</b>${parametres.slogan ? echap(parametres.slogan) : ''}</div>`);
      if (parametres.adresse || parametres.telephone || parametres.email)
        blocs.push(`<div class="bloc"><b>Contact</b>${parametres.adresse ? echap(parametres.adresse) + '<br>' : ''}${parametres.telephone ? '📞 ' + echap(parametres.telephone) + '<br>' : ''}${parametres.email ? '✉️ ' + echap(parametres.email) : ''}</div>`);
      if (parametres.horaires)
        blocs.push(`<div class="bloc"><b>Horaires</b>${echap(parametres.horaires)}</div>`);
      blocs.push(`<div class="copyright">${echap(parametres.piedDePage || 'OASIS Bibliothèque Numérique © 2026 — Haïti 🇭🇹')}</div>`);
      pied.innerHTML = blocs.join('');
    }
  }
  let nettoyerPdf = null;
  async function ouvrirLecteurPdf(livre) {
    toast('Ouverture du PDF…');
    let blob;
    try {
      const rep = await fetch('/api/livres/' + livre.id + (livre.accesComplet ? '/pdf' : '/apercu'), { headers: { Authorization: 'Bearer ' + jeton } });
      if (!rep.ok) { const d = await rep.json().catch(() => ({})); throw new Error(rep.status === 404 && !livre.accesComplet ? 'Le serveur doit être mis à jour pour ouvrir les aperçus gratuits. Veuillez réessayer après le déploiement.' : d.erreur || 'PDF indisponible.'); }
      blob = await rep.blob();
    } catch (err) { return toast(err.message); }
    fermerModale();
    urlPdfActive = URL.createObjectURL(blob);
    $('#zoneModale').innerHTML = `<div class="voile" id="voile"><div class="modale lecteur lecteur-pdf-mobile" role="dialog" aria-modal="true" aria-label="Lecture PDF">
      <div class="pdf-entete"><h3>${echap(livre.titre)}</h3><button class="mini-btn" id="btnFermer" aria-label="Fermer">✕</button></div>
      <div class="pdf-outils"><button class="mini-btn" id="pdfAvant" aria-label="Page précédente">←</button><label>Page <input type="number" id="pdfPage" min="1" value="1" aria-label="Numéro de page"></label><span id="pdfTotal"></span><button class="mini-btn" id="pdfApres" aria-label="Page suivante">→</button><button class="mini-btn" id="pdfMoins" aria-label="Réduire le zoom">−</button><button class="mini-btn" id="pdfPlus" aria-label="Augmenter le zoom">+</button><a class="mini-btn" href="${urlPdfActive}" download="${echap(livre.titre)}.pdf">Télécharger</a><a class="mini-btn" href="${urlPdfActive}" target="_blank" rel="noopener">Ouvrir ↗</a><button class="mini-btn bleu" id="btnTerminerPdf" ${!livre.accesComplet ? 'hidden' : ''}>Terminer</button></div>
      ${!livre.accesComplet ? '<div class="pdf-abonnement">Aperçu gratuit : cinq pages maximum. <button class="mini-btn bleu" data-abonner>Lire la suite — s’abonner</button></div>' : ''}<p id="pdfEtat" role="status" aria-live="polite">Chargement du document…</p><div class="pdf-pages" id="pdfPages"><canvas id="pdfCanvas" aria-label="Page du document PDF"></canvas></div></div></div>`;
    let doc=null, renderTask=null, closed=false, page=1, zoom=1, sequence=0;
    nettoyerPdf=()=>{closed=true;sequence++;renderTask?.cancel();doc?.destroy();};
    $('#btnFermer').onclick=fermerModale;
    $('#voile').onclick=e=>{if(e.target.id==='voile')fermerModale()};
    $('#btnTerminerPdf').onclick=()=>terminerLivre(livre.id);
    async function render(){
      if(!doc||closed)return;const ticket=++sequence;
      renderTask?.cancel();$('#pdfEtat').textContent='Chargement de la page…';
      try{
        const p=await doc.getPage(page);if(ticket!==sequence||closed)return;
        const canvas=$('#pdfCanvas'), area=$('#pdfPages');if(!canvas)return;
        const original=p.getViewport({scale:1});const width=Math.max(200,area.clientWidth-24);
        const scale=width/original.width*zoom;const viewport=p.getViewport({scale});
        const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(4000000/(viewport.width*viewport.height)));
        canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
        renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]});await renderTask.promise;
        if(ticket!==sequence||closed)return;$('#pdfEtat').textContent='Page '+page+' sur '+doc.numPages;
        $('#pdfPage').value=page;$('#pdfAvant').disabled=page===1;$('#pdfApres').disabled=page===doc.numPages;area.scrollTop=0;
      }catch(e){if(e.name!=='RenderingCancelledException'&&!closed&&ticket===sequence)$('#pdfEtat').textContent='Lecture impossible : utilisez Télécharger ou Ouvrir.'}
    }
    try{
      if(!window.pdfjsLib)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/pdfjs/pdf.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('Lecteur indisponible'));document.head.appendChild(script)});
      if(closed)return;pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.js';
      doc=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false}).promise;
      if(closed){doc.destroy();return}$('#pdfTotal').textContent='/ '+doc.numPages;$('#pdfPage').max=doc.numPages;
      $('#pdfAvant').onclick=()=>{page=Math.max(1,page-1);render()};$('#pdfApres').onclick=()=>{page=Math.min(doc.numPages,page+1);render()};
      $('#pdfPage').onchange=e=>{page=Math.max(1,Math.min(doc.numPages,Number(e.target.value)||1));render()};
      $('#pdfMoins').onclick=()=>{zoom=Math.max(.5,zoom-.25);render()};$('#pdfPlus').onclick=()=>{zoom=Math.min(3,zoom+.25);render()};
      await render();
      api('/livres/'+livre.id+'/progression',{method:'POST',body:JSON.stringify({pourcentage:livre.maProgression?.pourcentage||1})}).catch(()=>{});
    }catch(e){if(!closed)$('#pdfEtat').textContent='Ce PDF ne peut pas être affiché. Utilisez Télécharger pour le lire dans votre application PDF.'}
  }

  async function ouvrirLecteur(id) {
    let livre;
    try { livre = await api('/livres/' + id); } catch (err) { return toast(err.message); }
    if (!livre.accesComplet && !livre.pdf) {
      if(livre.epub){fermerModale();afficherVue('abonnement');return}
      try{const d=await api('/livres/'+id+'/apercu');$('#zoneModale').innerHTML=`<div class="voile"><div class="modale"><div class="corps"><button class="mini-btn" id="fermerApercu">Fermer</button><h3>${echap(d.titre)}</h3><p>Extrait : ${d.pages} pages de texte (2 500 caractères par page).</p><div style="white-space:pre-wrap">${echap(d.contenu)}</div><button class="btn btn-orange" data-abonner>Lire la suite — s’abonner</button></div></div></div>`;$('#fermerApercu').onclick=fermerModale;}catch(e){toast(e.message)}return;
    }
    if (livre.epub && !livre.pdf) {fermerModale();return OasisEpub.open(livre,jeton,$('#zoneModale'),fermerModale);}
    if (livre.pdf) return ouvrirLecteurPdf(livre);
    let d;
    try { d = await api('/livres/' + id + '/lire'); } catch (err) { return toast(err.message); }
    const html = echap(d.contenu)
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .split(/\n\n+/).map(b => b.startsWith('<h') ? b : `<p>${b}</p>`).join('');
    const pct = livre.maProgression ? livre.maProgression.pourcentage : 0;
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale lecteur" id="modaleLecteur" role="dialog" aria-modal="true">
          <div class="modale-entete" style="flex-wrap:wrap">
            <div style="flex:1;min-width:200px"><h3>${echap(d.titre)}</h3><p style="color:var(--gris)">${echap(d.auteur)}</p></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button>
            <div class="barre-lecteur" style="width:100%">
              <button class="mini-btn" id="btnZoomMoins" title="Réduire le texte">A−</button>
              <button class="mini-btn" id="btnZoomPlus" title="Agrandir le texte">A+</button>
              <button class="mini-btn" id="btnSombre" title="Mode sombre">🌙</button>
              <button class="mini-btn" id="btnPleinEcran" title="Plein écran">⛶</button>
              <button class="mini-btn" id="btnVoix" title="Lecture vocale">🔊 Écouter</button>
              <button class="mini-btn" id="btnSignet" title="Marque-page">🔖</button>
              <button class="mini-btn bleu" id="btnTerminer">✅ Terminer</button>
            </div>
            <div class="barre-progression" style="width:100%"><div id="jaugeLecture" style="width:${pct}%"></div></div>
          </div>
          <div class="corps texte" id="texteLecture">${html}</div>
        </div>
      </div>`;
    const modaleEl = $('#modaleLecteur');
    // Reprise à la dernière position
    requestAnimationFrame(() => { if (pct > 0 && pct < 100) modaleEl.scrollTop = (modaleEl.scrollHeight - modaleEl.clientHeight) * pct / 100; });
    // Sauvegarde de la progression au défilement
    let minuteurProg;
    const pctActuel = () => Math.round(modaleEl.scrollTop / Math.max(1, modaleEl.scrollHeight - modaleEl.clientHeight) * 100);
    modaleEl.addEventListener('scroll', () => {
      $('#jaugeLecture').style.width = pctActuel() + '%';
      clearTimeout(minuteurProg);
      minuteurProg = setTimeout(() => api('/livres/' + livre.id + '/progression', { method: 'POST', body: JSON.stringify({ pourcentage: pctActuel() }) }).catch(() => {}), 1200);
    });
    // Zoom
    let taille = 16.5;
    const majTaille = () => { $('#texteLecture').style.fontSize = taille + 'px'; };
    $('#btnZoomPlus').addEventListener('click', () => { taille = Math.min(26, taille + 1.5); majTaille(); });
    $('#btnZoomMoins').addEventListener('click', () => { taille = Math.max(12, taille - 1.5); majTaille(); });
    // Mode sombre
    $('#btnSombre').addEventListener('click', () => modaleEl.classList.toggle('sombre'));
    // Plein écran
    $('#btnPleinEcran').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else modaleEl.requestFullscreen?.().catch(() => toast('Plein écran non disponible sur ce navigateur.'));
    });
    // Lecture vocale (personnes malvoyantes)
    $('#btnVoix').addEventListener('click', () => {
      if (!('speechSynthesis' in window)) return toast('Lecture vocale non prise en charge par ce navigateur.');
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); $('#btnVoix').textContent = '🔊 Écouter'; return; }
      syntheseVocale = new SpeechSynthesisUtterance($('#texteLecture').innerText);
      syntheseVocale.lang = 'fr-FR'; syntheseVocale.rate = 0.95;
      syntheseVocale.onend = () => { const b = $('#btnVoix'); if (b) b.textContent = '🔊 Écouter'; };
      speechSynthesis.speak(syntheseVocale);
      $('#btnVoix').textContent = '⏹ Arrêter';
    });
    // Marque-page
    $('#btnSignet').addEventListener('click', async () => {
      try {
        await api('/livres/' + livre.id + '/notes', { method: 'POST', body: JSON.stringify({ type: 'signet', texte: `Marque-page à ${pctActuel()} %`, pourcentage: pctActuel() }) });
        toast('🔖 Marque-page ajouté à ' + pctActuel() + ' %');
      } catch (err) { toast(err.message); }
    });
    // Terminer → certificat
    $('#btnTerminer').addEventListener('click', () => terminerLivre(livre.id));
    $('#btnFermer').addEventListener('click', () => {
      api('/livres/' + livre.id + '/progression', { method: 'POST', body: JSON.stringify({ pourcentage: pctActuel() }) }).catch(() => {});
      fermerModale();
    });
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }

  async function terminerLivre(livreId) {
    let r;
    try { r = await api('/livres/' + livreId + '/terminer', { method: 'POST' }); } catch (err) { return toast(err.message); }
    if (speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel();
    const c = r.certificat;
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="corps" style="padding:24px">
            <div class="certificat">
              <img src="/logo.png" alt="" style="width:70px;height:70px;object-fit:contain">
              <h2>Certificat de Lecture</h2>
              <p>${echap(c.bibliotheque)} certifie que</p>
              <div class="lecteur-nom">${echap(c.lecteur)}</div>
              <p>a lu intégralement l'ouvrage</p>
              <p style="font-size:18px;font-weight:800;color:var(--bleu);margin:8px 0">« ${echap(c.titre)} »</p>
              <p>de ${echap(c.auteur)}</p>
              <p style="margin-top:14px;color:var(--gris)">Fait le ${new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin-top:10px">📚 ${r.nbTermines} livre${r.nbTermines > 1 ? 's' : ''} terminé${r.nbTermines > 1 ? 's' : ''} — bravo !</p>
            </div>
            <div class="rangee-boutons" style="justify-content:center">
              <button class="btn btn-bleu" onclick="window.print()">🖨️ Imprimer le certificat</button>
              <button class="btn" data-vue="defis" onclick="document.getElementById('zoneModale').innerHTML=''">🏆 Voir mes badges</button>
              <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button>
            </div>
          </div>
        </div>
      </div>`;
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }

  // ---------- Collaboration ----------
  async function ouvrirGroupe(id) {
    let g; try { g = await api('/groupes/' + id); } catch (err) { return toast(err.message); }
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale lecteur" style="max-width:720px;height:88vh;display:flex;flex-direction:column" role="dialog" aria-modal="true">
          <div class="modale-entete" style="padding-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px"><h3>${g.type === 'club' ? '📖' : '🎓'} ${echap(g.nom)}</h3>
              <p style="color:var(--gris);font-size:13px">${echap(g.description || '')}${g.livre ? (g.description ? ' · ' : '') + 'Autour de « ' + echap(g.livre.titre) + ' »' : ''}</p>
              <p style="color:var(--gris);font-size:12px;margin-top:3px">👥 ${g.membresNoms.map(echap).join(', ')}</p></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button>
            <div class="barre-lecteur" style="width:100%">
              ${g.membre ? `<button class="mini-btn" data-inviter="${g.id}">➕ Inviter</button>
                <button class="mini-btn" data-quitter="${g.id}">Quitter</button>` : `<button class="mini-btn bleu" data-rejoindre="${g.id}">Rejoindre le groupe</button>`}
              ${g.estCreateur || moi.role === 'bibliothecaire' ? `<button class="mini-btn rouge" data-suppr-groupe="${g.id}">Supprimer</button>` : ''}
              <button class="mini-btn" data-groupe="${g.id}" style="margin-left:auto">↻ Actualiser</button>
            </div>
          </div>
          <div id="zoneMessages" style="flex:1;overflow-y:auto;padding:14px 24px;background:var(--fond)">
            ${g.messages.length ? g.messages.map(msg => `
              <div style="margin-bottom:11px;display:flex;flex-direction:column;align-items:${msg.mien ? 'flex-end' : 'flex-start'}">
                <small style="color:var(--gris);font-size:11.5px;margin-bottom:2px">${echap(msg.auteur)} · ${new Date(msg.creeLe).toLocaleDateString('fr-FR')} ${new Date(msg.creeLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small>
                <div style="background:${msg.mien ? 'var(--bleu)' : 'var(--carte)'};color:${msg.mien ? '#fff' : 'var(--encre)'};padding:9px 14px;border-radius:14px;max-width:85%;box-shadow:var(--ombre)">${echap(msg.texte)}</div>
              </div>`).join('') : '<p class="vide" style="text-align:center">Aucun message — lancez la discussion !</p>'}
          </div>
          ${g.membre ? `
          <div style="display:flex;gap:9px;padding:12px 24px;border-top:1px solid var(--bord)">
            <input id="inMessage" placeholder="Votre message…" style="flex:1;border:1.5px solid var(--bord);border-radius:22px;padding:10px 16px" maxlength="2000">
            <button class="btn btn-bleu" id="btnEnvoyer">Envoyer</button>
          </div>` : '<p class="vide" style="text-align:center;padding:12px">Rejoignez le groupe pour participer à la discussion.</p>'}
        </div>
      </div>`;
    const zone = $('#zoneMessages');
    zone.scrollTop = zone.scrollHeight;
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
    const envoyer = async () => {
      const texte = $('#inMessage').value.trim();
      if (!texte) return;
      try { await api('/groupes/' + id + '/messages', { method: 'POST', body: JSON.stringify({ texte }) }); ouvrirGroupe(id); }
      catch (err) { toast(err.message); }
    };
    $('#btnEnvoyer')?.addEventListener('click', envoyer);
    $('#inMessage')?.addEventListener('keydown', e => { if (e.key === 'Enter') envoyer(); });
  }
  async function creerGroupe(type) {
    const livres = type === 'club' ? await api('/livres') : [];
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="corps" style="padding:24px">
            <h3 style="margin-bottom:14px">${type === 'club' ? '📖 Créer un club de lecture' : '🎓 Créer un groupe d\'étude'}</h3>
            <div id="msgGroupe"></div>
            <div class="champ"><label for="gNom">Nom du groupe *</label>
              <input id="gNom" placeholder="${type === 'club' ? 'Ex. : Les amis de Jacques Roumain' : 'Ex. : Révisions bac — Mathématiques'}"></div>
            <div class="champ"><label for="gDescription">Description</label>
              <textarea id="gDescription" rows="2" placeholder="Objectif du groupe, rythme des rencontres…"></textarea></div>
            ${type === 'club' ? `<div class="champ"><label for="gLivre">Livre associé (optionnel)</label>
              <select id="gLivre"><option value="">— Aucun —</option>${livres.map(l => `<option value="${l.id}">${echap(l.titre)}</option>`).join('')}</select></div>` : ''}
            <div class="rangee-boutons">
              <button class="btn btn-bleu" id="btnValiderGroupe">Créer</button>
              <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Annuler</button>
            </div>
          </div>
        </div>
      </div>`;
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
    $('#btnValiderGroupe').addEventListener('click', async () => {
      try {
        const g = await api('/groupes', { method: 'POST', body: JSON.stringify({
          type, nom: $('#gNom').value, description: $('#gDescription').value,
          livreId: $('#gLivre') ? $('#gLivre').value : null }) });
        toast('Groupe créé — invitez vos camarades !');
        ouvrirGroupe(g.id);
      } catch (err) { $('#msgGroupe').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
  }
  async function inviterMembre(groupeId) {
    const apprenants = await api('/apprenants');
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="corps" style="padding:24px">
            <h3 style="margin-bottom:14px">➕ Inviter un membre</h3>
            <div id="msgInvite"></div>
            <div class="champ"><label for="selInvite">Apprenant à ajouter au groupe</label>
              <select id="selInvite">${apprenants.filter(a => a.id !== moi.id).map(a => `<option value="${a.id}">${echap(a.nom)}</option>`).join('')}</select></div>
            <div class="rangee-boutons">
              <button class="btn btn-bleu" id="btnValiderInvite">Inviter</button>
              <button class="btn" data-groupe="${groupeId}">Retour au groupe</button>
            </div>
          </div>
        </div>
      </div>`;
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
    $('#btnValiderInvite').addEventListener('click', async () => {
      try {
        const r = await api('/groupes/' + groupeId + '/inviter', { method: 'POST', body: JSON.stringify({ membreId: $('#selInvite').value }) });
        toast(`${r.nom} a été ajouté au groupe 🎉`);
        ouvrirGroupe(groupeId);
      } catch (err) { $('#msgInvite').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
  }
  async function ouvrirCommentaires(cibleType, cibleId, titre) {
    let liste; try { liste = await api(`/commentaires?cibleType=${cibleType}&cibleId=${cibleId}`); } catch (err) { return toast(err.message); }
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="modale-entete"><div style="flex:1"><h3>💬 Commentaires — ${echap(titre)}</h3></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button></div>
          <div class="corps">
            <div style="display:flex;gap:9px;margin-bottom:16px">
              <input id="inCommentaire" placeholder="Partagez votre avis avec les autres lecteurs…" style="flex:1;border:1.5px solid var(--bord);border-radius:22px;padding:10px 16px" maxlength="1500">
              <button class="btn btn-bleu" id="btnCommenter">Publier</button>
            </div>
            ${liste.length ? liste.map(c => `
              <div style="border:1px solid var(--bord);border-radius:10px;padding:10px 13px;margin-bottom:9px">
                <div style="display:flex;justify-content:space-between;gap:10px">
                  <b style="font-size:13px">${echap(c.auteur)}</b>
                  <span style="display:flex;gap:8px;align-items:center">
                    <small style="color:var(--gris)">${new Date(c.creeLe).toLocaleDateString('fr-FR')}</small>
                    ${c.mien || moi.role === 'bibliothecaire' ? `<button class="mini-btn rouge" data-suppr-comm="${c.id}" data-ct="${cibleType}" data-ci="${cibleId}" data-tt="${echap(titre)}">✕</button>` : ''}
                  </span>
                </div>
                <p style="margin-top:4px">${echap(c.texte)}</p>
              </div>`).join('') : '<p class="vide">Aucun commentaire — soyez le premier à donner votre avis !</p>'}
          </div>
        </div>
      </div>`;
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
    $('#btnCommenter').addEventListener('click', async () => {
      const texte = $('#inCommentaire').value.trim();
      if (!texte) return;
      try { await api('/commentaires', { method: 'POST', body: JSON.stringify({ cibleType, cibleId, texte }) }); ouvrirCommentaires(cibleType, cibleId, titre); }
      catch (err) { toast(err.message); }
    });
    $('#inCommentaire').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnCommenter').click(); });
  }
  function ouvrirAPropos() {
    const p = parametres;
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="corps" style="padding:28px;text-align:center">
            <img src="/logo.png" alt="Logo" style="width:110px;height:110px;object-fit:contain">
            <h3 style="margin:8px 0 4px">${echap(p.nom || 'OASIS Bibliothèque Numérique')}</h3>
            <p style="color:var(--bleu);font-weight:700;margin-bottom:14px">${echap(p.slogan || '')}</p>
            <p style="text-align:left;line-height:1.7">${echap(p.aPropos || '')}</p>
            <div style="text-align:left;margin-top:14px;font-size:13.5px;color:var(--gris)">
              ${p.adresse ? '📍 ' + echap(p.adresse) + '<br>' : ''}${p.telephone ? '📞 ' + echap(p.telephone) + '<br>' : ''}${p.email ? '✉️ ' + echap(p.email) + '<br>' : ''}${p.horaires ? '🕐 ' + echap(p.horaires) : ''}
            </div>
            <p style="margin-top:16px;font-size:12.5px;color:var(--gris)">${echap(p.piedDePage || '')}</p>
            <div class="rangee-boutons" style="justify-content:center">
              <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button>
            </div>
          </div>
        </div>
      </div>`;
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }
  $('#btnAPropos').addEventListener('click', ouvrirAPropos);

  // ---------- Lecteurs multimédias ----------
  function ouvrirMedia(id) {
    const x = cacheMedias.find(v => v.id === id);
    if (!x) return;
    if (!x.fichier) return toast('Le fichier de ce média n\'est pas encore disponible.');
    const src = `/api/medias/${x.id}/fichier?jeton=${jeton}`;
    if (x.type === 'carte') return ouvrirCarte(x, src);
    const balise = x.type === 'video'
      ? `<video id="lecteurMedia" controls preload="metadata" src="${src}" style="width:100%;border-radius:12px;background:#000;max-height:60vh"></video>`
      : `<audio id="lecteurMedia" controls preload="metadata" src="${src}" style="width:100%"></audio>`;
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale lecteur" style="max-width:760px" role="dialog" aria-modal="true">
          <div class="modale-entete" style="flex-wrap:wrap">
            <div style="flex:1;min-width:200px"><h3>${x.type === 'video' ? '🎬' : '🎧'} ${echap(x.titre)}</h3>
              <p style="color:var(--gris)">${echap(x.auteur || '')}${x.categorie ? ' · ' + echap(x.categorie) : ''} · ${echap(x.langue)}</p></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button>
          </div>
          <div class="corps">
            ${x.description ? `<p style="margin-bottom:12px">${echap(x.description)}</p>` : ''}
            ${balise}
            <div class="barre-lecteur" style="margin-top:10px;border-top:none">
              <label style="font-size:13px;font-weight:700">Vitesse :
                <select id="selVitesse" style="border:1px solid var(--bord);border-radius:7px;padding:4px 8px">
                  ${[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => `<option value="${v}" ${v === 1 ? 'selected' : ''}>${v}×</option>`).join('')}
                </select></label>
              <label style="font-size:13px;font-weight:700">⏾ Arrêt auto :
                <select id="selMinuteur" style="border:1px solid var(--bord);border-radius:7px;padding:4px 8px">
                  <option value="0">Désactivé</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option>
                </select></label>
              <a class="mini-btn" href="${src}" download="${echap(x.titre)}${x.ext}">⬇ Télécharger</a>
            </div>
          </div>
        </div>
      </div>`;
    const lecteur = $('#lecteurMedia');
    // Reprise de l'écoute / du visionnage
    if (x.maPosition > 3) lecteur.addEventListener('loadedmetadata', () => { lecteur.currentTime = x.maPosition; }, { once: true });
    // Sauvegarde de la position toutes les 10 s
    clearInterval(minuteurPosition);
    minuteurPosition = setInterval(() => {
      if (!lecteur.paused) api('/medias/' + x.id + '/position', { method: 'POST', body: JSON.stringify({ secondes: lecteur.currentTime }) }).catch(() => {});
    }, 10000);
    $('#selVitesse').addEventListener('change', e => { lecteur.playbackRate = Number(e.target.value); });
    $('#selMinuteur').addEventListener('change', e => {
      clearTimeout(minuteurSommeil);
      const min = Number(e.target.value);
      if (min > 0) { minuteurSommeil = setTimeout(() => { lecteur.pause(); toast('⏾ Minuteur : lecture mise en pause.'); }, min * 60000); toast(`Arrêt automatique dans ${min} minutes.`); }
    });
    const fermer = () => {
      api('/medias/' + x.id + '/position', { method: 'POST', body: JSON.stringify({ secondes: lecteur.currentTime || 0 }) }).catch(() => {});
      clearInterval(minuteurPosition); clearTimeout(minuteurSommeil);
      fermerModale();
    };
    $('#btnFermer').addEventListener('click', fermer);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermer(); });
  }
  function ouvrirCarte(x, src) {
    const estPdf = x.ext === '.pdf';
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale lecteur" id="modaleCarte" style="max-width:1000px;height:92vh;display:flex;flex-direction:column" role="dialog" aria-modal="true">
          <div class="modale-entete" style="padding-bottom:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px"><h3>🗺️ ${echap(x.titre)}</h3>
              <p style="color:var(--gris)">${echap(x.auteur || '')}${x.lieu ? ' · ' + echap(x.lieu) : ''} · ${x.annee}</p></div>
            ${estPdf ? '' : `<button class="btn" id="btnZoomCarteMoins">🔍−</button><button class="btn" id="btnZoomCartePlus">🔍+</button>`}
            <button class="btn" id="btnPleinEcranCarte">⛶</button>
            <a class="btn" href="${src}" download="${echap(x.titre)}${x.ext}">⬇</a>
            <button class="btn" id="btnImprimerCarte">🖨️</button>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button>
          </div>
          <div id="zoneCarte" style="flex:1;overflow:auto;background:#3a4353;border-radius:0 0 18px 18px;text-align:center">
            ${estPdf ? `<iframe src="${src}" title="${echap(x.titre)}" style="width:100%;height:100%;border:none"></iframe>`
                     : `<img id="imgCarte" src="${src}" alt="${echap(x.titre)}" style="width:100%;transition:width .15s">`}
          </div>
        </div>
      </div>`;
    let zoom = 100;
    $('#btnZoomCartePlus')?.addEventListener('click', () => { zoom = Math.min(400, zoom + 40); $('#imgCarte').style.width = zoom + '%'; });
    $('#btnZoomCarteMoins')?.addEventListener('click', () => { zoom = Math.max(60, zoom - 40); $('#imgCarte').style.width = zoom + '%'; });
    $('#btnPleinEcranCarte').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else $('#modaleCarte').requestFullscreen?.().catch(() => {});
    });
    $('#btnImprimerCarte').addEventListener('click', () => {
      const f = window.open(src, '_blank');
      if (f) setTimeout(() => { try { f.print(); } catch {} }, 800);
    });
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }

  // ---------- Événements globaux ----------
  document.addEventListener('click', async e => {
    const cible = t => e.target.closest(`[${t}]`);
    let el;
    if(!moi&&e.target.closest('[data-favori],[data-liste],[data-emprunter],[data-reserver],[data-notes-livre],[data-noter],[data-commentaires]')){window.dispatchEvent(new Event('oasis-connexion'));return;}
    if ((el = cible('data-vue'))) return afficherVue(el.dataset.vue);
    if ((el = cible('data-categorie'))) return afficherVue('categorie', el.dataset.categorie);
    if ((el = cible('data-lire'))) return ouvrirLecteur(el.dataset.lire);
    if ((el = cible('data-emprunter'))) {
      try {
        await api('/emprunts', { method: 'POST', body: JSON.stringify({ livreId: el.dataset.emprunter }) });
        toast('Emprunt enregistré ! Retrouvez-le dans « Mes Emprunts ».');
        fermerModale(); if (vueActive === 'emprunts') afficherVue('emprunts');
      } catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-prolonger'))) {
      try { await api('/emprunts/' + el.dataset.prolonger + '/prolonger', { method: 'PUT' }); toast('Emprunt prolongé de 7 jours.'); afficherVue('emprunts'); }
      catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-favori'))) {
      try { const r = await api('/favoris/' + el.dataset.favori, { method: 'POST' }); toast(r.actif ? 'Ajouté aux favoris ❤️' : 'Retiré des favoris'); ouvrirLivre(el.dataset.favori); if (vueActive === 'favoris') afficherVue('favoris'); }
      catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-liste'))) {
      try { const r = await api('/liste/' + el.dataset.liste, { method: 'POST' }); toast(r.actif ? 'Ajouté à votre liste de lecture 📋' : 'Retiré de votre liste'); ouvrirLivre(el.dataset.liste); rafraichirPanneaux(); }
      catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-noter'))) {
      try { const r = await api('/livres/' + el.dataset.livreNote + '/note', { method: 'POST', body: JSON.stringify({ etoiles: el.dataset.noter }) }); toast(`Merci ! Note moyenne : ${r.note}/5`); ouvrirLivre(el.dataset.livreNote); }
      catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-reserver'))) {
      try {
        const r = await api('/reservations', { method: 'POST', body: JSON.stringify({ livreId: el.dataset.reserver }) });
        toast(`Réservation enregistrée — vous êtes n° ${r.position} dans la file.`);
        ouvrirLivre(el.dataset.reserver);
      } catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-annuler-resa'))) {
      try {
        await api('/reservations/' + el.dataset.annulerResa, { method: 'DELETE' });
        toast('Réservation annulée.');
        if (el.dataset.livreCtx) ouvrirLivre(el.dataset.livreCtx);
        else afficherVue('emprunts');
      } catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-reserver-place'))) {
      try {
        const r = await api('/places', { method: 'POST', body: JSON.stringify({ date: dateplaceActive, creneau: el.dataset.reserverPlace }) });
        toast(`Place n° ${r.place} réservée le ${new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR')} (${r.creneau}).`);
        afficherVue('places', dateplaceActive);
      } catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-annuler-place'))) {
      try { await api('/places/' + el.dataset.annulerPlace, { method: 'DELETE' }); toast('Place libérée.'); afficherVue('places', dateplaceActive); }
      catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-genre-res'))) return afficherVue('ressources', el.dataset.genreRes || undefined);
    if ((el = cible('data-ressource'))) {
      const r = cacheRessources.find(x => x.id === el.dataset.ressource);
      if (!r) return;
      const NOMS = { dictionnaire: '📖 Dictionnaire', encyclopedie: '🌍 Encyclopédie', base: '🗄️ Base de données', administratif: '📋 Document administratif', historique: '📜 Document historique' };
      $('#zoneModale').innerHTML = `
        <div class="voile" id="voile">
          <div class="modale" role="dialog" aria-modal="true">
            <div class="modale-entete">
              <div style="flex:1"><h3>${echap(r.titre)}</h3>
                <p style="color:var(--gris);font-weight:600">${NOMS[r.genre]}${r.source ? ' · ' + echap(r.source) : ''}</p></div>
              <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button>
            </div>
            <div class="corps">
              ${r.image ? `<img src="/api/ressources/${r.id}/image" alt="" style="max-width:100%;border-radius:12px;margin-bottom:14px;box-shadow:var(--ombre)">` : ''}
              <p style="font-size:15.5px;line-height:1.75">${echap(r.contenu)}</p>
              <div class="rangee-boutons">
                ${r.lien ? `<a class="btn btn-bleu" href="${echap(r.lien)}" target="_blank" rel="noopener">🔗 Consulter la ressource en ligne</a>` : ''}
                <button class="btn" data-commentaires="${r.id}" data-ct="ressource" data-tt="${echap(r.titre)}">💬 Commentaires</button>
              </div>
            </div>
          </div>
        </div>`;
      $('#btnFermer').addEventListener('click', fermerModale);
      $('#voile').addEventListener('click', ev => { if (ev.target.id === 'voile') fermerModale(); });
      return;
    }
    if ((el = cible('data-citer'))) return ouvrirCitations(el.dataset.citer);
    if ((el = cible('data-notes-livre'))) return ouvrirNotes(el.dataset.notesLivre, el.dataset.titreLivre);
    if ((el = cible('data-suppr-note'))) {
      try { await api('/notes/' + el.dataset.supprNote, { method: 'DELETE' }); ouvrirNotes(el.dataset.livreNoteCtx, el.dataset.titreCtx); }
      catch (err) { toast(err.message); }
      return;
    }
    if ((el = cible('data-copier'))) {
      try { await navigator.clipboard.writeText(el.dataset.copier); toast('Copié dans le presse-papiers 📋'); }
      catch { toast('Copie impossible — sélectionnez le texte manuellement.'); }
      return;
    }
    if ((el = cible('data-partager'))) {
      const lien = location.origin + '/?livre=' + el.dataset.partager;
      const titre = el.dataset.titreLivre;
      if (navigator.share) navigator.share({ title: titre, text: `Découvre « ${titre} » sur ${parametres.nom || 'OASIS Bibliothèque Numérique'} !`, url: lien }).catch(() => {});
      else { try { await navigator.clipboard.writeText(lien); toast('Lien copié — partagez-le ! 🔗'); } catch { toast(lien); } }
      return;
    }
    if ((el = cible('data-vider-filtres'))) {
      filtresBiblio = { categorie: '', langue: '', niveau: '', type: '', tri: '' };
      return (afficherVue('bibliotheque', $('#inRecherche').value.trim()));
    }
    if ((el = cible('data-onglet-media'))) return afficherVue('multimedia', el.dataset.ongletMedia);
    if ((el = cible('data-media'))) return ouvrirMedia(el.dataset.media);
    if ((el = cible('data-onglet-collab'))) return afficherVue('collaboration', el.dataset.ongletCollab);
    if ((el = cible('data-creer-groupe'))) return creerGroupe(el.dataset.creerGroupe);
    if ((el = cible('data-groupe'))) return ouvrirGroupe(el.dataset.groupe);
    if ((el = cible('data-rejoindre'))) {
      try { await api('/groupes/' + el.dataset.rejoindre + '/rejoindre', { method: 'POST' }); toast('Bienvenue dans le groupe ! 👋'); ouvrirGroupe(el.dataset.rejoindre); }
      catch (err) { toast(err.message); } return;
    }
    if ((el = cible('data-quitter'))) {
      try { await api('/groupes/' + el.dataset.quitter + '/quitter', { method: 'POST' }); toast('Vous avez quitté le groupe.'); fermerModale(); afficherVue('collaboration'); }
      catch (err) { toast(err.message); } return;
    }
    if ((el = cible('data-inviter'))) return inviterMembre(el.dataset.inviter);
    if ((el = cible('data-suppr-groupe'))) {
      if (!confirm('Supprimer ce groupe et toute sa discussion ?')) return;
      try { await api('/groupes/' + el.dataset.supprGroupe, { method: 'DELETE' }); toast('Groupe supprimé.'); fermerModale(); afficherVue('collaboration'); }
      catch (err) { toast(err.message); } return;
    }
    if ((el = cible('data-commentaires'))) return ouvrirCommentaires(el.dataset.ct, el.dataset.commentaires, el.dataset.tt);
    if ((el = cible('data-suppr-comm'))) {
      try { await api('/commentaires/' + el.dataset.supprComm, { method: 'DELETE' }); ouvrirCommentaires(el.dataset.ct, el.dataset.ci, el.dataset.tt); }
      catch (err) { toast(err.message); } return;
    }
    if ((el = cible('data-livre'))) return ouvrirLivre(el.dataset.livre);
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'inDatePlace') afficherVue('places', e.target.value);
    const f = e.target.closest('[data-filtre]');
    if (f) { filtresBiblio[f.dataset.filtre] = f.value; (afficherVue('bibliotheque', $('#inRecherche').value.trim())); }
  });

  // ---------- Notifications ----------
  async function rafraichirNotifications() {
    try {
      const notifs = await api('/notifications');
      const badge = $('#badgeNotifs');
      const importantes = notifs.filter(n => n.type !== 'nouveaute').length;
      badge.hidden = importantes === 0;
      badge.textContent = importantes;
      return notifs;
    } catch { return []; }
  }
  $('#btnNotifs').addEventListener('click', async () => {
    const notifs = await rafraichirNotifications();
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="modale-entete"><div style="flex:1"><h3>🔔 Notifications</h3></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button></div>
          <div class="corps">
            ${notifs.length ? notifs.map(n => `<div class="ligne-dispo ${n.type === 'retard' ? 'indispo' : n.type === 'reservation' ? 'dispo' : 'num'}">${echap(n.texte)}</div>`).join('') : '<p class="vide">Aucune notification — tout est en ordre ! ✅</p>'}
          </div>
        </div>
      </div>`;
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  });

  // ---------- Citations bibliographiques ----------
  function genererCitations(l) {
    const a = l.auteur, t = l.titre, an = l.annee, ed = l.editeur || 'Éduca Diffusion';
    return {
      'APA': `${a}. (${an}). ${t}. ${ed}.`,
      'MLA': `${a}. ${t}. ${ed}, ${an}.`,
      'Chicago': `${a}. ${t}. ${ed}, ${an}.`,
      'IEEE': `${a}, ${t}. ${ed}, ${an}.`
    };
  }
  async function ouvrirCitations(id) {
    let l; try { l = await api('/livres/' + id); } catch (err) { return toast(err.message); }
    const c = genererCitations(l);
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="modale-entete"><div style="flex:1"><h3>📑 Citer « ${echap(l.titre)} »</h3></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button></div>
          <div class="corps">
            ${Object.entries(c).map(([format, texte]) => `
              <div style="margin-bottom:14px">
                <b style="font-size:13px;color:var(--bleu)">${format}</b>
                <div style="display:flex;gap:8px;align-items:flex-start;margin-top:4px">
                  <p style="flex:1;background:var(--fond);border-radius:9px;padding:9px 12px;font-size:13.5px">${echap(texte)}</p>
                  <button class="mini-btn" data-copier="${echap(texte)}">Copier</button>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }

  // ---------- Notes et marque-pages ----------
  async function ouvrirNotes(livreId, titre) {
    let notes; try { notes = await api('/livres/' + livreId + '/notes'); } catch (err) { return toast(err.message); }
    $('#zoneModale').innerHTML = `
      <div class="voile" id="voile">
        <div class="modale" role="dialog" aria-modal="true">
          <div class="modale-entete"><div style="flex:1"><h3>🗒️ Mes notes — ${echap(titre)}</h3></div>
            <button class="fermer" id="btnFermer" aria-label="Fermer">✕</button></div>
          <div class="corps">
            <div class="champ"><label for="inNote">Nouvelle note ou citation à retenir</label>
              <textarea id="inNote" rows="3" placeholder="Votre commentaire, une citation du livre, une idée…"></textarea></div>
            <div class="rangee-boutons" style="margin-top:0;margin-bottom:16px">
              <button class="btn btn-bleu" id="btnAjouterNote">Ajouter la note</button>
              ${notes.length ? `<button class="btn" id="btnExporterNotes">⬇ Exporter (.txt)</button>` : ''}
            </div>
            <div id="listeNotes">
              ${notes.length ? notes.map(n => `
                <div style="border:1px solid var(--bord);border-radius:10px;padding:10px 13px;margin-bottom:9px">
                  <div style="display:flex;justify-content:space-between;gap:10px">
                    <small style="color:var(--gris)">${n.type === 'signet' ? '🔖 Marque-page' : '🗒️ Note'} · ${new Date(n.creeLe).toLocaleDateString('fr-FR')}</small>
                    <button class="mini-btn rouge" data-suppr-note="${n.id}" data-livre-note-ctx="${livreId}" data-titre-ctx="${echap(titre)}">✕</button>
                  </div>
                  <p style="margin-top:5px">${echap(n.texte)}</p>
                </div>`).join('') : '<p class="vide">Aucune note pour ce livre. Vos marque-pages du lecteur apparaîtront ici aussi.</p>'}
            </div>
          </div>
        </div>
      </div>`;
    $('#btnFermer').addEventListener('click', fermerModale);
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
    $('#btnAjouterNote').addEventListener('click', async () => {
      const texte = $('#inNote').value.trim();
      if (!texte) return toast('Écrivez votre note d\'abord.');
      try { await api('/livres/' + livreId + '/notes', { method: 'POST', body: JSON.stringify({ type: 'note', texte }) }); ouvrirNotes(livreId, titre); }
      catch (err) { toast(err.message); }
    });
    $('#btnExporterNotes')?.addEventListener('click', () => {
      const contenu = `Notes — ${titre}\n${'='.repeat(40)}\n\n` + notes.map(n => `[${n.type === 'signet' ? 'Marque-page' : 'Note'} · ${new Date(n.creeLe).toLocaleDateString('fr-FR')}]\n${n.texte}\n`).join('\n');
      const url = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
      const el = document.createElement('a'); el.href = url; el.download = `notes-${titre.slice(0, 30)}.txt`; el.click();
      URL.revokeObjectURL(url);
    });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fermerModale(); });

  // Recherche avec délai
  let minuteur;
  $('#inRecherche').addEventListener('input', e => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => { afficherVue('bibliotheque', e.target.value.trim()); }, 300);
  });

  $('#btnMenu').addEventListener('click', () => {
    const ouvert = $('#sidebar').classList.toggle('ouverte');
    $('#btnMenu').setAttribute('aria-expanded', String(ouvert));
    $('#btnMenu').setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  $('#btnDeconnexion').addEventListener('click', async () => {
    try { await api('/deconnexion', { method: 'POST' }); } catch {}
    jeton = ''; moi = null; localStorage.removeItem('oasis_jeton'); localStorage.removeItem('educa_jeton');
    location.reload();
  });

  // ---------- Démarrage ----------
  function demarrer() {
    $('.contenu').classList.toggle('sans-colonne', !moi);
    $('#ecranConnexion').hidden = true;
    $('#appli').hidden = false;
    if(!moi){
      $('#btnConnexionPublic').hidden=false;$('#nomProfil').textContent='Visiteur';$('#avatarProfil').textContent='';$('#avatarProfil').hidden=true;$('#lienAdmin').hidden=true;$('#btnDeconnexion').hidden=true;
      document.querySelectorAll('.nav-item[data-vue],.entete [data-vue]').forEach(b=>b.hidden=!['accueil','bibliotheque','categories','nouveautes','recommandes','abonnement'].includes(b.dataset.vue));
      $('#colonneDroite').hidden=true;$('#btnNotifs').hidden=true;chargerParametres();chargerCategories().then(()=>afficherVue('accueil'));return;
    }
    $('#avatarProfil').hidden=false;$('#btnDeconnexion').hidden=false;$('#btnNotifs').hidden=false;$('#colonneDroite').hidden=false;document.querySelectorAll('.nav-item[data-vue],.entete [data-vue]').forEach(b=>b.hidden=false);$('#btnConnexionPublic').hidden=true;
    $('#nomProfil').textContent = moi.nom.split(' ')[0] + ' ' + (moi.nom.split(' ')[1]?.[0] || '') + (moi.nom.split(' ')[1] ? '.' : '');
    $('#avatarProfil').textContent = moi.nom.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    $('#lienAdmin').hidden = moi.role !== 'bibliothecaire';
    chargerParametres();
    majSalutation();
    rafraichirNotifications();
    setInterval(rafraichirNotifications, 120000);
    const livrePartage = new URLSearchParams(location.search).get('livre');
    chargerCategories().then(() => { afficherVue(localStorage.getItem('oasis_apres_auth')|| (new URLSearchParams(location.search).has('espace')?'espace':'accueil'));localStorage.removeItem('oasis_apres_auth'); if (livrePartage) ouvrirLivre(livrePartage); });
    rafraichirPanneaux();
  }
  (async () => {
    initAuth();
    if (await verifierSession()) demarrer();
    else demarrer();
  })();

  window.addEventListener('oasis-connexion',()=>{fermerModale();$('#appli').hidden=true;$('#ecranConnexion').hidden=false;});
  $('#btnConnexionPublic').onclick=()=>window.dispatchEvent(new Event('oasis-connexion'));
  document.addEventListener('click',e=>{if(e.target.closest('[data-abonner]')){fermerModale();afficherVue('abonnement')}});
  // PWA
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
