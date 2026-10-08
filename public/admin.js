/* Oasis Centre numérique d'apprentissage — Espace bibliothécaire */
(() => {
  const $ = s => document.querySelector(s);
  let jeton = localStorage.getItem('oasis_jeton') || localStorage.getItem('educa_jeton') || '';
  let moi = null;
  let ongletActif = 'tableau';

  const echap = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateFr = d => new Date(d).toLocaleDateString('fr-FR');

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
  const fermerModale = () => { $('#zoneModale').innerHTML = ''; };
  function modale(html) {
    $('#zoneModale').innerHTML = `<div class="voile" id="voile"><div class="modale" role="dialog" aria-modal="true"><div class="corps" style="padding:24px">${html}</div></div></div>`;
    $('#voile').addEventListener('click', e => { if (e.target.id === 'voile') fermerModale(); });
  }

  // ---------- Onglets ----------
  const onglets = {
    async tableau() {
      const [s, emprunts, tousLivres] = await Promise.all([api('/stats'), api('/emprunts?statut=en_cours'), api('/livres?tri=populaires')]);
      const s2 = { topLivres: tousLivres.slice(0, 5) };
      const retards = emprunts.filter(e => e.joursRetard > 0);
      return `
        <div class="section-titre"><h3>📊 Tableau de bord</h3></div>
        <div class="stats">
          <div class="stat"><div class="valeur">${s.livres}</div><div class="libelle">Titres au catalogue</div></div>
          <div class="stat"><div class="valeur">${s.numeriques}</div><div class="libelle">E-books</div></div>
          <div class="stat"><div class="valeur">${s.hybrides}</div><div class="libelle">Titres hybrides 📕+💻</div></div>
          <div class="stat"><div class="valeur">${s.exemplairesDisponibles}/${s.exemplaires}</div><div class="libelle">Exemplaires disponibles</div></div>
          <div class="stat"><div class="valeur">${s.empruntsEnCours}</div><div class="libelle">Emprunts en cours</div></div>
          <div class="stat"><div class="valeur ${s.empruntsEnRetard ? 'alerte' : ''}">${s.empruntsEnRetard}</div><div class="libelle">En retard</div></div>
          <div class="stat"><div class="valeur ${s.reservationsPretes ? 'alerte' : ''}">${s.reservationsPretes}</div><div class="libelle">Réservations à remettre</div></div>
          <div class="stat"><div class="valeur">${s.reservationsEnAttente}</div><div class="libelle">File d'attente</div></div>
          <div class="stat"><div class="valeur">${s.placesAujourdhui}</div><div class="libelle">Places réservées aujourd'hui</div></div>
          <div class="stat"><div class="valeur">${s.membres}</div><div class="libelle">Membres</div></div>
          <div class="stat"><div class="valeur">${s.lecturesTotal}</div><div class="libelle">Lectures en ligne</div></div>
          <div class="stat"><div class="valeur">${s.livresTermines || 0}</div><div class="libelle">Lectures terminées</div></div>
          <div class="stat"><div class="valeur">${s.membresActifs7j || 0}</div><div class="libelle">Membres actifs (7 j)</div></div>
        </div>
        <div class="section-titre"><h3>📈 Livres les plus lus</h3></div>
        <table style="margin-bottom:22px"><thead><tr><th>#</th><th>Titre</th><th>Lectures</th><th>Téléchargements</th><th>Note</th></tr></thead><tbody>
          ${s2.topLivres.map((l, i) => `<tr><td>${i + 1}</td><td>${l.icone} <b>${echap(l.titre)}</b></td><td>${l.nbLectures}</td><td>${l.nbTelechargements || 0}</td><td>⭐ ${l.note}</td></tr>`).join('')}
        </tbody></table>
        <div class="section-titre"><h3>⚠️ Retards à relancer</h3></div>
        ${retards.length ? tableEmprunts(retards) : '<p class="vide">Aucun retard — la bibliothèque tourne bien ! ✅</p>'}`;
    },
    async emprunts() {
      const tous = await api('/emprunts');
      const enCours = tous.filter(e => e.statut === 'en_cours');
      const historique = tous.filter(e => e.statut !== 'en_cours').slice(0, 20);
      return `
        <div class="section-titre"><h3>🔄 Emprunts &amp; Retours</h3>
          <button class="btn btn-bleu" id="btnNouvelEmprunt">+ Enregistrer un emprunt au guichet</button></div>
        <h4 style="margin:8px 0 10px;color:var(--encre)">En cours (${enCours.length})</h4>
        ${enCours.length ? tableEmprunts(enCours) : '<p class="vide">Aucun emprunt en cours.</p>'}
        <h4 style="margin:24px 0 10px;color:var(--encre)">Derniers retours</h4>
        ${historique.length ? tableEmprunts(historique) : '<p class="vide">Aucun retour enregistré.</p>'}`;
    },
    async catalogue() {
      const [livres] = await Promise.all([api('/livres'), chargerCategories()]);
      return `
        <div class="section-titre"><h3>📚 Catalogue (${livres.length} titres)</h3>
          <span style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="btnCategories">🗂️ Catégories</button>
            <button class="btn" id="btnImporterPdf">📚 Importer des PDF</button>
            <button class="btn" id="btnImporter">📥 Importer (CSV / JSON)</button>
            <button class="btn btn-bleu" id="btnNouveauLivre">+ Ajouter un livre</button>
          </span></div>
        <table><thead><tr><th>Titre</th><th>Auteur</th><th>Catégorie</th><th>Versions</th><th>Disponibilité</th><th>Actions</th></tr></thead><tbody>
        ${livres.map(l => `<tr>
          <td>${l.icone} <b>${echap(l.titre)}</b></td>
          <td>${echap(l.auteur)}</td>
          <td>${echap(l.categorie)}</td>
          <td>${l.hybride ? '<b style="color:var(--bleu)">📕+💻 Hybride</b>' : l.versionNumerique ? '💻 E-book' : l.versionPhysique ? '📕 Physique' : '<span style="color:var(--gris)">— aucune</span>'}</td>
          <td style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
            ${l.versionNumerique ? '<span class="pastille num">💻 En ligne</span>' : ''}
            ${l.versionPhysique ? `<span class="pastille ${l.nbDisponibles > 0 ? 'dispo' : 'indispo'}">📕 ${l.nbDisponibles}/${l.nbExemplaires} en rayon</span>` : ''}
            ${!l.versionNumerique && !l.versionPhysique ? '<span class="pastille indispo">Incomplet</span>' : ''}
          </td>
          <td>
            <button class="mini-btn" data-exemplaires="${l.id}" data-titre="${echap(l.titre)}">📕 Exemplaires${l.nbExemplaires ? ` (${l.nbExemplaires})` : ''}</button>
            <button class="mini-btn" data-pdf="${l.id}" data-titre="${echap(l.titre)}" data-deja="${l.pdf ? '1' : ''}">${l.pdf ? '📄 PDF ✓' : '📄 Joindre PDF'}</button>
            <button class="mini-btn rouge" data-supprimer="${l.id}">Supprimer</button>
          </td>
        </tr>`).join('')}
        </tbody></table>`;
    },
    async reservations() {
      const toutes = await api('/reservations');
      const pretes = toutes.filter(r => r.statut === 'prete');
      const enAttente = toutes.filter(r => r.statut === 'en_attente');
      const ligne = r => `<tr>
        <td>${r.livre?.icone || ''} <b>${echap(r.livre?.titre || '—')}</b>${r.cote ? `<br><small style="color:var(--gris)">cote ${echap(r.cote)}</small>` : ''}</td>
        <td>${echap(r.membre?.nom || '—')}<br><small style="color:var(--gris)">${echap(r.membre?.email || '')}</small></td>
        <td>${r.statut === 'prete'
          ? `<span class="pastille dispo">✅ Mise de côté — retrait avant le ${dateFr(r.echeanceRetrait)}</span>`
          : `⏳ Position n° ${r.position}`}</td>
        <td>${r.statut === 'prete' ? `<button class="mini-btn bleu" data-remettre="${r.id}">✔ Remettre au membre</button>` : ''}
            <button class="mini-btn rouge" data-annuler-resa="${r.id}">Annuler</button></td>
      </tr>`;
      return `
        <div class="section-titre"><h3>📌 Réservations</h3></div>
        <h4 style="margin:8px 0 10px;color:var(--encre)">Prêtes à retirer (${pretes.length}) — exemplaires mis de côté</h4>
        ${pretes.length ? `<table><thead><tr><th>Livre</th><th>Membre</th><th>Statut</th><th></th></tr></thead><tbody>${pretes.map(ligne).join('')}</tbody></table>` : '<p class="vide">Aucun retrait en attente.</p>'}
        <h4 style="margin:24px 0 10px;color:var(--encre)">File d'attente (${enAttente.length})</h4>
        ${enAttente.length ? `<table><thead><tr><th>Livre</th><th>Membre</th><th>Statut</th><th></th></tr></thead><tbody>${enAttente.map(ligne).join('')}</tbody></table>` : '<p class="vide">Aucune réservation en attente.</p>'}
        <p style="color:var(--gris);font-size:12.5px;margin-top:12px">À chaque retour d'exemplaire, le premier de la file est servi automatiquement : l'exemplaire est mis de côté ${''}pendant 3 jours, puis passe au suivant s'il n'est pas retiré.</p>`;
    },
    async places() {
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const date = ongletsEtat.datePlaces || aujourdhui;
      const d = await api('/places?date=' + date);
      return `
        <div class="section-titre"><h3>🪑 Places de lecture</h3></div>
        <div class="panneau" style="margin-bottom:16px;max-width:280px">
          <div class="champ" style="margin:0"><label for="fDatePlaces">Journée</label>
            <input id="fDatePlaces" type="date" value="${d.date}"></div>
        </div>
        <div class="stats">${d.creneaux.map(c => `
          <div class="stat"><div class="valeur ${c.libres === 0 ? 'alerte' : ''}">${c.occupees}/${d.nbPlaces}</div><div class="libelle">${c.creneau}</div></div>`).join('')}
        </div>
        <h4 style="margin:8px 0 10px;color:var(--encre)">Réservations du ${dateFr(d.date + 'T00:00:00')}</h4>
        ${d.details && d.details.length ? `<table><thead><tr><th>Créneau</th><th>Place</th><th>Membre</th><th></th></tr></thead><tbody>
          ${d.details.map(p => `<tr><td><b>${p.creneau}</b></td><td>n° ${p.place}</td><td>${echap(p.membre)}</td>
            <td><button class="mini-btn rouge" data-annuler-place="${p.id}">Annuler</button></td></tr>`).join('')}
          </tbody></table>` : '<p class="vide">Aucune réservation de place ce jour-là.</p>'}`;
    },
    async ressources() {
      const liste = await api('/ressources');
      const NOMS = { dictionnaire: '📖 Dictionnaire', encyclopedie: '🌍 Encyclopédie', base: '🗄️ Base de données', administratif: '📋 Doc. administratif', historique: '📜 Doc. historique' };
      return `
        <div class="section-titre"><h3>🔎 Ressources documentaires (${liste.length})</h3></div>
        <div class="panneau" style="margin-bottom:18px">
          <h4 style="margin-bottom:10px;color:var(--encre)">Ajouter une entrée</h4>
          <div id="msgRessource"></div>
          <div style="display:grid;grid-template-columns:180px 1fr;gap:12px">
            <div class="champ"><label for="rGenre">Section</label>
              <select id="rGenre"><option value="dictionnaire">📖 Dictionnaire</option><option value="encyclopedie">🌍 Encyclopédie</option><option value="base">🗄️ Base de données</option><option value="administratif">📋 Document administratif</option><option value="historique">📜 Document historique</option></select></div>
            <div class="champ"><label for="rTitre">Titre / mot / nom *</label><input id="rTitre" placeholder="Ex. : Konbit, Jacques Roumain, Catalogue Éduca…"></div>
          </div>
          <div class="champ"><label for="rContenu">Définition / article / description *</label><textarea id="rContenu" rows="4"></textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="champ"><label for="rSource">Source (optionnel)</label><input id="rSource" placeholder="Ex. : Collection Oasis, MENFP…"></div>
            <div class="champ"><label for="rLien">Lien de la ressource (optionnel)</label><input id="rLien" type="url" placeholder="https://exemple.ht/ressource"></div>
          </div>
          <div style="display:grid;grid-template-columns:140px 1fr;gap:12px">
            <div class="champ"><label for="rIcone">Icône (emoji)</label><input id="rIcone" maxlength="8" placeholder="Ex. : 🇭🇹 📖 🧪"></div>
            <div class="champ"><label for="rImage">…ou image (PNG/JPEG, 3 Mo max)</label><input id="rImage" type="file" accept="image/png,image/jpeg"></div>
          </div>
          <button class="btn btn-bleu" id="btnAjouterRessource">Ajouter la ressource</button>
        </div>
        <table><thead><tr><th>Section</th><th>Titre</th><th>Contenu</th><th></th></tr></thead><tbody>
        ${liste.map(r => `<tr>
          <td>${NOMS[r.genre]}</td><td>${r.image ? `<img src="/api/ressources/${r.id}/image" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:6px">` : r.icone ? r.icone + ' ' : ''}<b>${echap(r.titre)}</b>${r.lien ? ` <a href="${echap(r.lien)}" target="_blank" rel="noopener" title="${echap(r.lien)}">🔗</a>` : ''}</td>
          <td style="max-width:420px">${echap(r.contenu.slice(0, 120))}${r.contenu.length > 120 ? '…' : ''}</td>
          <td><button class="mini-btn rouge" data-suppr-ressource="${r.id}">Supprimer</button></td>
        </tr>`).join('')}
        </tbody></table>`;
    },
    async journalActivites() {
      const j = await api('/journal');
      return `<div class="section-titre"><h3>📜 Journal des activités (${j.length} dernières)</h3></div>
        ${j.length ? `<table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détail</th></tr></thead><tbody>
        ${j.map(e => `<tr><td style="white-space:nowrap">${new Date(e.date).toLocaleString('fr-FR')}</td>
          <td>${echap(e.utilisateur)}</td><td><b>${echap(e.action)}</b></td><td>${echap(e.detail)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="vide">Aucune activité enregistrée pour le moment.</p>'}`;
    },
    async parametres() {
      const p = await api('/parametres');
      return `
        <div class="section-titre"><h3>⚙️ Paramètres de la bibliothèque</h3></div>
        <div id="msgParam"></div>
        <div class="panneau" style="margin-bottom:16px">
          <h4 style="margin-bottom:12px;color:var(--encre)">Identité (en-tête et pied de page)</h4>
          <div class="champ"><label for="pNom">Nom de la bibliothèque</label><input id="pNom" value="${echap(p.nom)}"></div>
          <div class="champ"><label for="pSlogan">Slogan (bannière d'accueil)</label><input id="pSlogan" value="${echap(p.slogan)}"></div>
          <div class="champ"><label for="pAccueil">Message de bienvenue (en-tête du portail, après « Bonjour Prénom — »)</label><input id="pAccueil" value="${echap(p.messageAccueil || '')}" placeholder="Ex. : bienvenue dans votre bibliothèque !"></div>
          <div class="champ"><label for="pPied">Ligne de copyright du pied de page</label><input id="pPied" value="${echap(p.piedDePage)}"></div>
          <div class="champ"><label for="pAPropos">Texte « À propos » (bouton ℹ️ du portail)</label><textarea id="pAPropos" rows="4">${echap(p.aPropos || '')}</textarea></div>
        </div>
        <div class="panneau" style="margin-bottom:16px">
          <h4 style="margin-bottom:12px;color:var(--encre)">Coordonnées (pied de page)</h4>
          <div class="champ"><label for="pAdresse">Adresse</label><input id="pAdresse" value="${echap(p.adresse)}" placeholder="Ex. : 12, rue Capois, Port-au-Prince"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="champ"><label for="pTel">Téléphone</label><input id="pTel" value="${echap(p.telephone)}" placeholder="Ex. : +509 …"></div>
            <div class="champ"><label for="pEmail">Email</label><input id="pEmail" value="${echap(p.email)}" placeholder="contact@oasis.ht"></div>
          </div>
          <div class="champ"><label for="pHoraires">Horaires d'ouverture</label><input id="pHoraires" value="${echap(p.horaires)}" placeholder="Ex. : Lun–Ven 8h–17h, Sam 9h–13h"></div>
        </div>
        <div class="panneau" style="margin-bottom:16px">
          <h4 style="margin-bottom:12px;color:var(--encre)">Règles d'emprunt et de réservation</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
            <div class="champ"><label for="pDureeP">Durée emprunt physique (jours)</label><input id="pDureeP" type="number" min="1" max="365" value="${p.dureeEmpruntPhysique}"></div>
            <div class="champ"><label for="pDureeN">Durée emprunt e-book (jours)</label><input id="pDureeN" type="number" min="1" max="365" value="${p.dureeEmpruntNumerique}"></div>
            <div class="champ"><label for="pMax">Emprunts actifs max / membre</label><input id="pMax" type="number" min="1" max="365" value="${p.maxEmprunts}"></div>
            <div class="champ"><label for="pRetrait">Délai de retrait d'une réservation (jours)</label><input id="pRetrait" type="number" min="1" max="365" value="${p.retraitReservationJours}"></div>
          </div>
        </div>
        <div class="panneau" style="margin-bottom:16px">
          <h4 style="margin-bottom:12px;color:var(--encre)">Salle de lecture</h4>
          <div style="display:grid;grid-template-columns:200px 1fr;gap:12px">
            <div class="champ"><label for="pPlaces">Nombre de places</label><input id="pPlaces" type="number" min="1" max="365" value="${p.nbPlacesLecture}"></div>
            <div class="champ"><label for="pCreneaux">Créneaux (un par ligne, 8 max)</label><textarea id="pCreneaux" rows="4">${echap(p.creneaux.join('\n'))}</textarea></div>
          </div>
        </div>
        <div class="rangee-boutons">
          <button class="btn btn-bleu" id="btnSauverParametres">💾 Enregistrer les paramètres</button>
          <button class="btn" id="btnSauvegarde">⬇ Télécharger une sauvegarde complète</button>
        </div>`;
    },
    async multimedia() {
      const medias = await api('/medias');
      const ICO = { audio: '🎧', carte: '🗺️', video: '🎬' };
      return `
        <div class="section-titre"><h3>🎬 Bibliothèque multimédia (${medias.length})</h3></div>
        <div class="panneau" style="margin-bottom:18px">
          <h4 style="margin-bottom:10px;color:var(--encre)">Ajouter un média</h4>
          <div id="msgMedia"></div>
          <div style="display:grid;grid-template-columns:180px 1fr 1fr;gap:12px">
            <div class="champ"><label for="mType">Type</label>
              <select id="mType"><option value="audio">🎧 Audio (livre audio, podcast, cours…)</option><option value="carte">🗺️ Carte (image ou PDF)</option><option value="video">🎬 Vidéo (documentaire, cours filmé…)</option></select></div>
            <div class="champ"><label for="mTitre">Titre *</label><input id="mTitre" placeholder="Ex. : Histoire d'Haïti — épisode 1"></div>
            <div class="champ"><label for="mAuteur">Auteur / Réalisateur / Source</label><input id="mAuteur"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
            <div class="champ"><label for="mCategorie">Catégorie / Thème</label><input id="mCategorie" placeholder="Ex. : Histoire, Podcast…"></div>
            <div class="champ"><label for="mLangue">Langue</label>
              <select id="mLangue"><option>Français</option><option>Créole haïtien</option><option>Anglais</option><option>Espagnol</option></select></div>
            <div class="champ"><label for="mLieu">Lieu / Échelle (cartes)</label><input id="mLieu" placeholder="Ex. : Haïti, Ouest, 1:50 000"></div>
            <div class="champ"><label for="mDuree">Durée (audio/vidéo)</label><input id="mDuree" placeholder="Ex. : 24 min"></div>
          </div>
          <div class="champ"><label for="mDescription">Description</label><textarea id="mDescription" rows="2"></textarea></div>
          <div class="champ"><label for="mFichier">Fichier — audio : MP3/OGG/M4A/WAV · vidéo : MP4/WebM · carte : PNG/JPEG/PDF (300 Mo max)</label>
            <input id="mFichier" type="file" accept=".mp3,.ogg,.m4a,.wav,.mp4,.webm,.png,.jpg,.jpeg,.pdf"></div>
          <button class="btn btn-bleu" id="btnAjouterMedia">Ajouter le média</button>
        </div>
        <table><thead><tr><th>Type</th><th>Titre</th><th>Fichier</th><th>Lectures</th><th></th></tr></thead><tbody>
        ${medias.map(x => `<tr>
          <td>${ICO[x.type]} ${x.type}</td>
          <td><b>${echap(x.titre)}</b><br><small style="color:var(--gris)">${echap(x.auteur || '')}${x.categorie ? ' · ' + echap(x.categorie) : ''}</small></td>
          <td>${x.fichier ? `<span class="pastille dispo">✔ ${(x.taille / 1048576).toFixed(1)} Mo</span>` : '<span class="pastille indispo">✖ manquant</span>'}</td>
          <td>${x.nbLectures}</td>
          <td><button class="mini-btn rouge" data-suppr-media="${x.id}">Supprimer</button></td>
        </tr>`).join('')}
        </tbody></table>`;
    },
    async membres() {
      const membres = await api('/membres');
      return `
        <div class="section-titre"><h3>👥 Membres (${membres.length})</h3>
          <button class="btn btn-bleu" id="btnNouveauMembre">+ Inscrire un membre</button></div>
        <table><thead><tr><th>Nom</th><th>Email</th><th>Classe</th><th>Emprunts actifs</th><th>Inscrit le</th></tr></thead><tbody>
        ${membres.map(m => `<tr>
          <td><b>${echap(m.nom)}</b></td><td>${echap(m.email)}</td><td>${echap(m.classe) || '—'}</td>
          <td>${m.empruntsActifs}</td><td>${dateFr(m.creeLe)}</td>
        </tr>`).join('')}
        </tbody></table>`;
    }
  };

  const tableEmprunts = liste => `
    <table><thead><tr><th>Livre</th><th>Membre</th><th>Cote</th><th>Emprunté le</th><th>Échéance</th><th>Statut</th><th></th></tr></thead><tbody>
    ${liste.map(e => `<tr>
      <td>${e.livre?.icone || ''} <b>${echap(e.livre?.titre || '—')}</b></td>
      <td>${echap(e.membre?.nom || '—')}<br><small style="color:var(--gris)">${echap(e.membre?.email || '')}</small></td>
      <td>${e.cote ? echap(e.cote) : '<span style="color:var(--gris)">e-book</span>'}</td>
      <td>${dateFr(e.dateEmprunt)}</td>
      <td>${dateFr(e.echeance)}</td>
      <td>${e.statut === 'retourne' ? '✅ Retourné le ' + dateFr(e.dateRetour) : e.joursRetard > 0 ? `<span class="retard">⚠️ ${e.joursRetard} j de retard</span>` : '📗 En cours'}</td>
      <td>${e.statut === 'en_cours' ? `<button class="mini-btn bleu" data-retour="${e.id}">✔ Retour</button> <button class="mini-btn" data-prolonger="${e.id}">+7 j</button>` : ''}</td>
    </tr>`).join('')}
    </tbody></table>`;

  async function afficherOnglet(nom) {
    ongletActif = nom;
    document.querySelectorAll('.nav-item[data-onglet]').forEach(b => b.classList.toggle('actif', b.dataset.onglet === nom));
    $('#sidebar').classList.remove('ouverte');
    const zone = $('#zoneAdmin');
    zone.innerHTML = '<p class="vide">Chargement…</p>';
    try { zone.innerHTML = await onglets[nom](); brancherBoutons(); }
    catch (err) { zone.innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
  }

  // ---------- Formulaires ----------
  async function formEmpruntGuichet() {
    const [membres, livres] = await Promise.all([api('/membres'), api('/livres')]);
    const empruntables = livres.filter(l => l.disponible);
    modale(`
      <h3 style="margin-bottom:14px">Enregistrer un emprunt au guichet</h3>
      <div id="msgForm"></div>
      <div class="champ"><label for="selMembre">Membre</label>
        <select id="selMembre">${membres.map(m => `<option value="${m.id}">${echap(m.nom)} (${echap(m.email)})</option>`).join('')}</select></div>
      <div class="champ"><label for="selLivre">Livre</label>
        <select id="selLivre">${empruntables.map(l => `<option value="${l.id}">${echap(l.titre)} — ${l.versionPhysique && l.nbDisponibles > 0 ? l.nbDisponibles + ' ex. en rayon' + (l.versionNumerique ? ' + en ligne' : '') : 'e-book'}</option>`).join('')}</select></div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnValiderEmprunt">Enregistrer l'emprunt</button>
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Annuler</button>
      </div>`);
    $('#btnValiderEmprunt').addEventListener('click', async () => {
      try {
        await api('/emprunts', { method: 'POST', body: JSON.stringify({ membreId: $('#selMembre').value, livreId: $('#selLivre').value }) });
        fermerModale(); toast('Emprunt enregistré.'); afficherOnglet('emprunts');
      } catch (err) { $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
  }

  function formNouveauLivre() {
    chargerCategories();
    modale(`
      <h3 style="margin-bottom:14px">Ajouter un livre au catalogue</h3>
      <div id="msgForm"></div>
      <div class="champ"><label for="fTitre">Titre *</label><input id="fTitre" placeholder="Ex. : Compère Général Soleil"></div>
      <div class="champ"><label for="fAuteur">Auteur *</label><input id="fAuteur" placeholder="Ex. : Jacques Stephen Alexis"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="champ"><label for="fCategorie">Catégorie *</label>
          <select id="fCategorie">${optionsCategories()}</select></div>
        <div class="champ"><label for="fType">Type</label>
          <select id="fType">
            <option value="physique">📕 Physique (en rayon)</option>
            <option value="numerique">💻 E-book (PDF ou texte)</option>
            <option value="hybride">📕+💻 Hybride (les deux)</option>
          </select></div>
      </div>
      <div class="champ" id="champExemplaires"><label for="fExemplaires">Nombre d'exemplaires physiques (cotes générées automatiquement)</label>
        <input id="fExemplaires" type="number" min="0" max="50" value="1"></div>
      <div class="champ" id="champPdf" hidden><label for="fPdf">Version PDF de l'e-book (30 Mo max) — la 1ʳᵉ page deviendra la couverture</label>
        <input id="fPdf" type="file" accept=".pdf,application/pdf"></div>
      <div class="champ" id="champContenu" hidden><label for="fContenu">…ou contenu texte (Markdown : # titre, ## chapitre)</label><textarea id="fContenu" rows="5"></textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="champ"><label for="fAnnee">Année</label><input id="fAnnee" type="number" value="${new Date().getFullYear()}"></div>
        <div class="champ"><label for="fIcone">Icône (emoji)</label><input id="fIcone" value="📘" maxlength="4"></div>
        <div class="champ"><label for="fCouleur">Couleur</label><input id="fCouleur" type="color" value="#1e4fa3" style="height:42px;padding:4px"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="champ"><label for="fEditeur">Éditeur</label><input id="fEditeur" placeholder="Ex. : Éduca Diffusion"></div>
        <div class="champ"><label for="fIsbn">ISBN</label><input id="fIsbn" placeholder="Ex. : 978-…"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="champ"><label for="fLangue">Langue</label>
          <select id="fLangue"><option>Français</option><option>Créole haïtien</option><option>Anglais</option><option>Espagnol</option></select></div>
        <div class="champ"><label for="fNiveau">Niveau scolaire</label><input id="fNiveau" placeholder="Ex. : NS4, 9e AF, Universitaire…"></div>
      </div>
      <div class="champ"><label for="fMotsCles">Mots-clés (séparés par des virgules)</label><input id="fMotsCles" placeholder="Ex. : astronomie, planètes, cosmos"></div>
      <div class="champ"><label for="fResume">Résumé</label><textarea id="fResume" rows="3" placeholder="Brève présentation de l'ouvrage…"></textarea></div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnValiderLivre">Ajouter le livre</button>
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Annuler</button>
      </div>`);
    const majChamps = () => {
      const t = $('#fType').value;
      $('#champExemplaires').hidden = t === 'numerique';
      $('#champPdf').hidden = t === 'physique';
      $('#champContenu').hidden = t === 'physique';
    };
    $('#fType').addEventListener('change', majChamps);
    majChamps();
    $('#btnValiderLivre').addEventListener('click', async () => {
      const btn = $('#btnValiderLivre');
      try {
        btn.disabled = true;
        const type = $('#fType').value;
        const livre = await api('/livres', { method: 'POST', body: JSON.stringify({
          titre: $('#fTitre').value.trim(), auteur: $('#fAuteur').value.trim(),
          categorie: $('#fCategorie').value, type,
          annee: parseInt($('#fAnnee').value, 10), icone: $('#fIcone').value || '📘',
          couleur: $('#fCouleur').value, resume: $('#fResume').value.trim(),
          editeur: $('#fEditeur').value.trim(), isbn: $('#fIsbn').value.trim(), langue: $('#fLangue').value,
          niveau: $('#fNiveau').value.trim(), motsCles: $('#fMotsCles').value.trim(),
          contenu: type !== 'physique' ? ($('#fContenu').value || null) : null
        }) });
        // Exemplaires physiques avec cotes automatiques
        const nb = type === 'numerique' ? 0 : Math.min(50, parseInt($('#fExemplaires').value, 10) || 0);
        if (nb > 0) {
          const prefixe = $('#fCategorie').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
          const base = Date.now().toString(36).slice(-4).toUpperCase();
          for (let j = 1; j <= nb; j++) {
            await api('/livres/' + livre.id + '/exemplaires', { method: 'POST', body: JSON.stringify({ cote: `${prefixe}-${base}-${j}`, etat: 'bon' }) });
          }
        }
        // Version PDF + couverture générée depuis la première page
        const fichierPdf = $('#fPdf')?.files[0];
        if (fichierPdf && type !== 'physique') {
          btn.textContent = 'Envoi du PDF…';
          await envoyerPdf(livre.id, fichierPdf);
          btn.textContent = 'Génération de la couverture…';
          await genererCouverture(livre.id, fichierPdf);
        }
        fermerModale(); toast('Livre ajouté au catalogue.'); afficherOnglet('catalogue');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Ajouter le livre';
        $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`;
      }
    });
  }

  // Génère la couverture (image de la 1ʳᵉ page du PDF) via pdf.js, avec repli silencieux hors ligne
  async function genererCouverture(livreId, fichierPdf) {
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = res; s.onerror = () => rej(new Error('pdf.js inaccessible'));
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      const doc = await window.pdfjsLib.getDocument({ data: await fichierPdf.arrayBuffer() }).promise;
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(2, 460 / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const rep = await fetch('/api/livres/' + livreId + '/couverture', {
        method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + jeton }, body: blob
      });
      if (!rep.ok) throw new Error('envoi refusé');
      return true;
    } catch (err) {
      toast('PDF attaché, mais couverture non générée (connexion Internet requise pour pdf.js).');
      return false;
    }
  }

  async function envoyerPdf(livreId, fichier) {
    if (fichier.size > 30 * 1024 * 1024) throw new Error('PDF trop volumineux (30 Mo max).');
    const rep = await fetch('/api/livres/' + livreId + '/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', Authorization: 'Bearer ' + jeton },
      body: fichier
    });
    const d = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(d.erreur || 'Échec de l\'envoi du PDF.');
    return d;
  }

  function formPdf(livreId, titre, dejaPdf) {
    modale(`
      <h3 style="margin-bottom:6px">📄 E-book PDF — ${echap(titre)}</h3>
      <p style="color:var(--gris);font-size:13px;margin-bottom:12px">${dejaPdf ? 'Un PDF est déjà attaché. Envoyer un nouveau fichier le remplacera.' : 'Attachez un fichier PDF : le livre deviendra lisible en ligne par les apprenants.'}</p>
      <div id="msgForm"></div>
      <div class="champ"><label for="fPdfSeul">Fichier PDF (30 Mo max)</label><input id="fPdfSeul" type="file" accept=".pdf,application/pdf"></div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnEnvoyerPdf">Envoyer le PDF</button>
        ${dejaPdf ? '<button class="btn btn-danger" id="btnRetirerPdf">Retirer le PDF</button>' : ''}
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button>
      </div>`);
    $('#btnEnvoyerPdf').addEventListener('click', async () => {
      const f = $('#fPdfSeul').files[0];
      if (!f) return $('#msgForm').innerHTML = '<div class="erreur">Choisissez un fichier PDF.</div>';
      try {
        $('#btnEnvoyerPdf').textContent = 'Envoi…'; $('#btnEnvoyerPdf').disabled = true;
        const r = await envoyerPdf(livreId, f);
        $('#btnEnvoyerPdf').textContent = 'Couverture…';
        await genererCouverture(livreId, f);
        fermerModale(); toast(`PDF attaché (${(r.taille / 1048576).toFixed(1)} Mo) — couverture mise à jour.`); afficherOnglet('catalogue');
      } catch (err) {
        $('#btnEnvoyerPdf').textContent = 'Envoyer le PDF'; $('#btnEnvoyerPdf').disabled = false;
        $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`;
      }
    });
    $('#btnRetirerPdf')?.addEventListener('click', async () => {
      try { await api('/livres/' + livreId + '/pdf', { method: 'DELETE' }); fermerModale(); toast('PDF retiré.'); afficherOnglet('catalogue'); }
      catch (err) { $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
  }

  async function gererExemplaires(livreId, titre) {
    const liste = await api('/livres/' + livreId + '/exemplaires');
    modale(`
      <h3 style="margin-bottom:4px">Exemplaires — ${echap(titre)}</h3>
      <p style="color:var(--gris);font-size:13px;margin-bottom:14px">Gérez les exemplaires physiques en rayon.</p>
      <div id="msgForm"></div>
      ${liste.length ? `<table style="margin-bottom:16px"><thead><tr><th>Cote</th><th>État</th><th>Statut</th><th></th></tr></thead><tbody>
        ${liste.map(x => `<tr><td><b>${echap(x.cote)}</b></td><td>${echap(x.etat)}</td>
          <td>${x.statut === 'disponible' ? '<span class="pastille dispo">Disponible</span>' : '<span class="pastille indispo">Emprunté</span>'}</td>
          <td>${x.statut === 'disponible' ? `<button class="mini-btn rouge" data-suppr-ex="${x.id}">Retirer</button>` : ''}</td></tr>`).join('')}
        </tbody></table>` : '<p class="vide">Aucun exemplaire enregistré.</p>'}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="champ"><label for="fCote">Nouvelle cote</label><input id="fCote" placeholder="Ex. : ROM-05-3"></div>
        <div class="champ"><label for="fEtat">État</label>
          <select id="fEtat"><option value="neuf">Neuf</option><option value="bon" selected>Bon</option><option value="use">Usé</option></select></div>
      </div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnAjouterEx">+ Ajouter l'exemplaire</button>
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button>
      </div>`);
    $('#btnAjouterEx').addEventListener('click', async () => {
      try {
        await api('/livres/' + livreId + '/exemplaires', { method: 'POST', body: JSON.stringify({ cote: $('#fCote').value.trim(), etat: $('#fEtat').value }) });
        toast('Exemplaire ajouté.'); gererExemplaires(livreId, titre); afficherOnglet('catalogue');
      } catch (err) { $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
    document.querySelectorAll('[data-suppr-ex]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/exemplaires/' + b.dataset.supprEx, { method: 'DELETE' }); toast('Exemplaire retiré.'); gererExemplaires(livreId, titre); afficherOnglet('catalogue'); }
      catch (err) { toast(err.message); }
    }));
  }

  // ---------- Classement automatique par titre ----------
  // Chaque catégorie est associée à des mots-clés (sans accents) ; la première qui correspond gagne.
  const REGLES_CLASSEMENT = [
    ['Mathématiques', ['math', 'algebr', 'geometr', 'calcul', 'trigonometr', 'arithmet', 'statistiq', 'probabilit', 'fraction', 'equation', 'nombre']],
    ['Informatique', ['informatiq', 'programm', 'python', 'javascript', 'html', 'css', ' web', 'ordinateur', 'numeriq', 'algorithm', 'reseau', 'excel', 'word', 'codage', 'robotiq', 'logiciel', 'internet', 'bureautiq']],
    ['Sciences', ['science', 'physiq', 'chimi', 'biolog', 'svt', 'univers', 'evolution', 'astronom', 'ecolog', 'anatomie', 'sante', 'experiment', 'plante', 'animaux', 'energie', 'electricit', 'geologie', 'laboratoire']],
    ['Histoire', ['histoire', 'geograph', 'revolution', 'colonis', 'civilisation', 'independance', 'guerre', 'empire', 'dessalines', 'louverture', 'christophe', 'patrimoine', 'citoyennete']],
    ['Philosophie', ['philosoph', 'ethiq', 'morale', 'logique', 'socrate', 'platon', 'pensee critique', 'metaphysiq']],
    ['Roman', ['roman', 'conte', 'nouvelle', 'aventure', 'prince', 'recit', 'legende', 'fable', 'saga', 'trilogie']],
    ['Littérature', ['litterat', 'poesie', 'poeme', 'grammaire', 'francais', 'creole', 'kreyol', 'orthograph', 'conjugaison', 'dissertation', 'symbolis', 'theatre', 'lecture', 'vocabulaire', 'anglais', 'espagnol']]
  ];
  function classerParTitre(titre) {
    const t = ' ' + String(titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ';
    for (const [cat, mots] of REGLES_CLASSEMENT) if (mots.some(m => t.includes(m))) return cat;
    return 'Littérature'; // repli par défaut, modifiable dans l'aperçu avant import
  }
  // « Histoire de France - Marc Delcourt.pdf » → titre + auteur
  function analyserNomFichier(nom) {
    let base = nom.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    let titre = base, auteur = '';
    const parties = base.split(/\s[-–—]\s/);
    if (parties.length >= 2) { titre = parties[0].trim(); auteur = parties.slice(1).join(' - ').trim(); }
    titre = titre.charAt(0).toUpperCase() + titre.slice(1);
    return { titre, auteur };
  }

  // ---------- Import en masse (CSV / JSON) ----------
  function decoderFichier(tampon) {
    // Essaie UTF-8 strict ; si le fichier vient d'Excel en ANSI, bascule en Windows-1252
    try { return new TextDecoder('utf-8', { fatal: true }).decode(tampon); }
    catch { return new TextDecoder('windows-1252').decode(tampon); }
  }
  const ALIAS_COLONNES = {
    titre: 'titre', livre: 'titre', ouvrage: 'titre',
    auteur: 'auteur', auteurs: 'auteur', ecrivain: 'auteur',
    categorie: 'categorie', categories: 'categorie', matiere: 'categorie', discipline: 'categorie',
    type: 'type', format: 'type',
    annee: 'annee', date: 'annee', 'annee de publication': 'annee',
    isbn: 'isbn', resume: 'resume', description: 'resume',
    icone: 'icone', emoji: 'icone', couleur: 'couleur',
    exemplaires: 'exemplaires', 'nombre d exemplaires': 'exemplaires', copies: 'exemplaires', quantite: 'exemplaires', stock: 'exemplaires',
    contenu: 'contenu', texte: 'contenu',
    editeur: 'editeur', edition: 'editeur', langue: 'langue', niveau: 'niveau', 'niveau scolaire': 'niveau', classe: 'niveau',
    motscles: 'motsCles', 'mots cles': 'motsCles', 'mots clefs': 'motsCles', tags: 'motsCles'
  };
  const normaliserEntete = h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’_-]/g, ' ').trim();
  function analyserCSV(texte) {
    // Analyse CSV avec gestion des guillemets et du séparateur ; , ou tabulation
    const lignes = texte.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lignes.length) return { lignes: [], entetes: [] };
    const compte = c => (lignes[0].match(new RegExp('\\' + c, 'g')) || []).length;
    const sep = compte(';') >= compte(',') ? (compte('\t') > compte(';') ? '\t' : ';') : (compte('\t') > compte(',') ? '\t' : ',');
    const decouper = ligne => {
      const cellules = []; let cour = '', entreGuillemets = false;
      for (let i = 0; i < ligne.length; i++) {
        const c = ligne[i];
        if (c === '"') {
          if (entreGuillemets && ligne[i + 1] === '"') { cour += '"'; i++; }
          else entreGuillemets = !entreGuillemets;
        } else if (c === sep && !entreGuillemets) { cellules.push(cour); cour = ''; }
        else cour += c;
      }
      cellules.push(cour);
      return cellules.map(x => x.trim());
    };
    const entetesBrutes = decouper(lignes[0]);
    const entetes = entetesBrutes.map(h => ALIAS_COLONNES[normaliserEntete(h)] || normaliserEntete(h));
    const donnees = lignes.slice(1).map(l => {
      const cellules = decouper(l);
      const obj = {};
      entetes.forEach((h, i) => { obj[h] = cellules[i] ?? ''; });
      return obj;
    });
    return { lignes: donnees, entetes, entetesBrutes };
  }

  function formImporter() {
    modale(`
      <h3 style="margin-bottom:6px">📥 Importer des livres</h3>
      <p style="color:var(--gris);font-size:13px;margin-bottom:12px">
        Fichier <b>CSV</b> (Excel : « Enregistrer sous → CSV ») ou <b>JSON</b> (tableau d'objets).
        Colonnes reconnues : <b>titre*, auteur*, categorie*</b>, type (physique/numerique),
        annee, isbn, resume, icone, couleur, <b>exemplaires</b> (nombre de copies physiques → cotes générées automatiquement), contenu (texte de l'e-book).
      </p>
      <div id="msgForm"></div>
      <div class="champ"><label for="fFichier">Fichier à importer</label>
        <input id="fFichier" type="file" accept=".csv,.json,text/csv,application/json"></div>
      <div id="apercu"></div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnLancerImport" disabled>Importer</button>
        <button class="btn" id="btnModele">⬇ Télécharger un modèle CSV</button>
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button>
      </div>`);
    let lignesImport = [];
    $('#btnModele').addEventListener('click', () => {
      const modele = 'titre;auteur;categorie;type;annee;isbn;exemplaires;resume\n' +
        '"Compère Général Soleil";"Jacques Stephen Alexis";Littérature;physique;1955;978-2-07-038658-1;3;"Roman majeur de la littérature haïtienne"\n' +
        '"Introduction au HTML";"Équipe Oasis";Informatique;numerique;2026;;0;"Premier pas vers le web"';
      const url = URL.createObjectURL(new Blob(['\uFEFF' + modele], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'modele-import-oasis.csv'; a.click();
      URL.revokeObjectURL(url);
    });
    $('#fFichier').addEventListener('change', async e => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      const texte = decoderFichier(await fichier.arrayBuffer());
      let entetesInfo = '';
      try {
        if (fichier.name.toLowerCase().endsWith('.json')) {
          const d = JSON.parse(texte);
          lignesImport = Array.isArray(d) ? d : (d.livres || []);
        } else {
          const resultat = analyserCSV(texte);
          lignesImport = resultat.lignes;
          const manquantes = ['titre'].filter(r => !resultat.entetes.includes(r));
          entetesInfo = `<p style="font-size:12.5px;color:var(--gris);margin:6px 0">Colonnes reconnues : <b>${resultat.entetes.join(', ') || 'aucune'}</b>${resultat.entetes.includes('categorie') ? '' : ' — catégorie absente : elle sera <b>déterminée automatiquement</b> d\'après le titre'}</p>`;
          if (manquantes.length) {
            $('#apercu').innerHTML = `${entetesInfo}
              <div class="erreur">Colonne obligatoire introuvable : <b>titre</b>.<br>
              Vérifiez la première ligne de votre fichier — elle doit contenir les en-têtes (ex. : titre;auteur;categorie;type;exemplaires).</div>`;
            $('#btnLancerImport').disabled = true;
            return;
          }
        }
        const valides = lignesImport.filter(l => l.titre);
        $('#apercu').innerHTML = `${entetesInfo}
          <div class="${valides.length ? 'succes' : 'erreur'}">${valides.length} livre(s) prêt(s) à importer
            ${lignesImport.length - valides.length ? ` — ${lignesImport.length - valides.length} ligne(s) ignorée(s) (titre vide)` : ''}</div>
          ${valides.slice(0, 5).map(l => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--bord)">📘 <b>${echap(l.titre)}</b> — ${echap(l.auteur || 'Auteur à préciser')} (${echap(l.categorie || classerParTitre(l.titre) + ' 🪄')}${l.exemplaires ? `, ${l.exemplaires} ex.` : ''})</div>`).join('')}
          ${valides.length > 5 ? `<p class="vide">… et ${valides.length - 5} autres</p>` : ''}`;
        lignesImport = valides;
        $('#btnLancerImport').disabled = !valides.length;
      } catch (err) {
        $('#apercu').innerHTML = `<div class="erreur">Fichier illisible : ${echap(err.message)}</div>`;
        $('#btnLancerImport').disabled = true;
      }
    });
    $('#btnLancerImport').addEventListener('click', async () => {
      const btn = $('#btnLancerImport');
      btn.disabled = true;
      let ok = 0, echoue = 0;
      const erreurs = [];
      for (const [idx, l] of lignesImport.entries()) {
        btn.textContent = `Import ${idx + 1}/${lignesImport.length}…`;
        try {
          const categorie = l.categorie || classerParTitre(l.titre);
          const livre = await api('/livres', { method: 'POST', body: JSON.stringify({
            titre: l.titre, auteur: l.auteur || 'Auteur à préciser', categorie,
            type: (l.type || '').toLowerCase() === 'numerique' ? 'numerique' : 'physique',
            annee: parseInt(l.annee, 10) || undefined, isbn: l.isbn || '',
            editeur: l.editeur || '', langue: l.langue || 'Français', niveau: l.niveau || '', motsCles: l.motsCles || '',
            resume: l.resume || '', icone: l.icone || '📘', couleur: l.couleur || '#1e4fa3',
            contenu: l.contenu || null
          }) });
          // Création automatique des exemplaires physiques avec cotes générées
          const nb = Math.min(50, parseInt(l.exemplaires, 10) || 0);
          if (nb > 0) {
            const prefixe = categorie.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
            const base = Date.now().toString(36).slice(-4).toUpperCase();
            for (let j = 1; j <= nb; j++) {
              await api('/livres/' + livre.id + '/exemplaires', { method: 'POST', body: JSON.stringify({ cote: `${prefixe}-${base}-${j}`, etat: 'bon' }) });
            }
          }
          ok++;
        } catch (err) { echoue++; erreurs.push(`${l.titre} : ${err.message}`); }
      }
      btn.textContent = 'Importer';
      $('#msgForm').innerHTML = `<div class="${echoue ? 'erreur' : 'succes'}">✅ ${ok} livre(s) importé(s)${echoue ? ` — ⚠️ ${echoue} échec(s) : ${echap(erreurs.slice(0, 3).join(' · '))}` : ''}</div>`;
      afficherOnglet('catalogue'); // rafraîchit le catalogue derrière la modale
    });
  }

  // ---------- Import multiple de fichiers PDF avec classement automatique ----------
  let listeCategories = ['Sciences', 'Histoire', 'Littérature', 'Informatique', 'Roman', 'Mathématiques', 'Philosophie'];
  async function chargerCategories() {
    try {
      const cats = await api('/categories');
      if (cats.length) listeCategories = cats.map(c => c.nom);
      return cats;
    } catch { return []; }
  }
  const optionsCategories = (selection) => listeCategories.map(c => `<option ${c === selection ? 'selected' : ''}>${echap(c)}</option>`).join('');

  function formCategories() {
    chargerCategories().then(cats => {
      modale(`
        <h3 style="margin-bottom:6px">🗂️ Gérer les catégories</h3>
        <p style="color:var(--gris);font-size:13px;margin-bottom:12px">Les catégories structurent les rayons du portail apprenant et les préfixes de cotes. Une catégorie ne peut être supprimée que si aucun livre n'y est classé.</p>
        <div id="msgForm"></div>
        <div class="panneau" style="margin-bottom:16px">
          <h4 style="margin-bottom:10px;color:var(--encre)">Nouvelle catégorie</h4>
          <div style="display:grid;grid-template-columns:1fr 110px 110px;gap:12px">
            <div class="champ"><label for="cNom">Nom *</label><input id="cNom" placeholder="Ex. : Économie, Kreyòl, Arts…"></div>
            <div class="champ"><label for="cIcone">Icône</label><input id="cIcone" value="📘" maxlength="4"></div>
            <div class="champ"><label for="cCouleur">Couleur</label><input id="cCouleur" type="color" value="#1e4fa3" style="height:42px;padding:4px"></div>
          </div>
          <button class="btn btn-bleu" id="btnAjouterCategorie">Créer la catégorie</button>
        </div>
        <table><thead><tr><th></th><th>Catégorie</th><th>Livres</th><th></th></tr></thead><tbody>
        ${cats.map(c => `<tr>
          <td style="font-size:20px">${c.icone}</td>
          <td><b>${echap(c.nom)}</b> <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${c.couleur};vertical-align:middle"></span></td>
          <td>${c.nbLivres}</td>
          <td>${c.nbLivres === 0 ? `<button class="mini-btn rouge" data-suppr-cat="${c.id}">Supprimer</button>` : '<small style="color:var(--gris)">utilisée</small>'}</td>
        </tr>`).join('')}
        </tbody></table>
        <div class="rangee-boutons"><button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button></div>`);
      $('#btnAjouterCategorie').addEventListener('click', async () => {
        try {
          await api('/categories', { method: 'POST', body: JSON.stringify({ nom: $('#cNom').value.trim(), icone: $('#cIcone').value || '📘', couleur: $('#cCouleur').value }) });
          toast('Catégorie créée.'); formCategories();
        } catch (err) { $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
      });
      document.querySelectorAll('[data-suppr-cat]').forEach(b => b.addEventListener('click', async () => {
        try { await api('/categories/' + b.dataset.supprCat, { method: 'DELETE' }); toast('Catégorie supprimée.'); formCategories(); }
        catch (err) { $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
      }));
    });
  }

  function formImporterPdf() {
    chargerCategories();
    modale(`
      <h3 style="margin-bottom:6px">📚 Importer plusieurs livres PDF</h3>
      <p style="color:var(--gris);font-size:13px;margin-bottom:12px">
        Sélectionnez plusieurs fichiers PDF d'un coup. Le système déduit le <b>titre</b> du nom de fichier
        (nommez-les « Titre - Auteur.pdf » pour récupérer aussi l'auteur), détermine automatiquement la
        <b>catégorie</b> d'après le titre, et génère la couverture depuis la 1ʳᵉ page.
        Vous pouvez tout ajuster dans l'aperçu avant de lancer l'import.</p>
      <div id="msgForm"></div>
      <div class="champ"><label for="fPdfMultiples">Fichiers PDF (30 Mo max chacun)</label>
        <input id="fPdfMultiples" type="file" accept=".pdf,application/pdf" multiple></div>
      <div id="apercuPdf" style="max-height:340px;overflow-y:auto"></div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnLancerImportPdf" disabled>Importer tout</button>
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Fermer</button>
      </div>`);
    let filesPdf = [];
    $('#fPdfMultiples').addEventListener('change', e => {
      filesPdf = [...e.target.files];
      if (!filesPdf.length) return;
      $('#apercuPdf').innerHTML = `
        <table style="margin:10px 0"><thead><tr><th>Titre</th><th>Auteur</th><th>Catégorie (auto)</th><th>Taille</th></tr></thead><tbody>
        ${filesPdf.map((f, i) => {
          const { titre, auteur } = analyserNomFichier(f.name);
          const cat = classerParTitre(titre);
          const tropGros = f.size > 30 * 1024 * 1024;
          return `<tr ${tropGros ? 'style="opacity:.5"' : ''}>
            <td><input data-imp-titre="${i}" value="${echap(titre)}" style="width:100%;border:1px solid var(--bord);border-radius:6px;padding:5px 8px"></td>
            <td><input data-imp-auteur="${i}" value="${echap(auteur)}" placeholder="À préciser" style="width:100%;border:1px solid var(--bord);border-radius:6px;padding:5px 8px"></td>
            <td><select data-imp-cat="${i}" style="border:1px solid var(--bord);border-radius:6px;padding:5px 8px">
              ${optionsCategories(listeCategories.includes(cat) ? cat : listeCategories[0])}</select></td>
            <td style="white-space:nowrap">${(f.size / 1048576).toFixed(1)} Mo ${tropGros ? '<span class="retard">✖ trop gros</span>' : ''}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
        <p style="font-size:12.5px;color:var(--gris)">💡 Le titre est modifiable, et la catégorie proposée peut être corrigée avant l'import.</p>`;
      $('#btnLancerImportPdf').disabled = !filesPdf.some(f => f.size <= 30 * 1024 * 1024);
    });
    $('#btnLancerImportPdf').addEventListener('click', async () => {
      const btn = $('#btnLancerImportPdf');
      btn.disabled = true;
      let ok = 0, echoue = 0;
      const erreurs = [];
      for (let i = 0; i < filesPdf.length; i++) {
        const f = filesPdf[i];
        if (f.size > 30 * 1024 * 1024) { echoue++; erreurs.push(`${f.name} : trop volumineux`); continue; }
        btn.textContent = `Import ${i + 1}/${filesPdf.length}…`;
        try {
          const titre = document.querySelector(`[data-imp-titre="${i}"]`).value.trim() || analyserNomFichier(f.name).titre;
          const auteur = document.querySelector(`[data-imp-auteur="${i}"]`).value.trim() || 'Auteur à préciser';
          const categorie = document.querySelector(`[data-imp-cat="${i}"]`).value;
          const livre = await api('/livres', { method: 'POST', body: JSON.stringify({ titre, auteur, categorie, type: 'numerique' }) });
          await envoyerPdf(livre.id, f);
          await genererCouverture(livre.id, f);
          ok++;
        } catch (err) { echoue++; erreurs.push(`${f.name} : ${err.message}`); }
      }
      btn.textContent = 'Importer tout';
      $('#msgForm').innerHTML = `<div class="${echoue ? 'erreur' : 'succes'}">✅ ${ok} livre(s) importé(s) et classé(s)${echoue ? ` — ⚠️ ${echoue} échec(s) : ${echap(erreurs.slice(0, 3).join(' · '))}` : ''}</div>`;
      afficherOnglet('catalogue');
    });
  }

  function formNouveauMembre() {
    modale(`
      <h3 style="margin-bottom:14px">Inscrire un membre</h3>
      <div id="msgForm"></div>
      <div class="champ"><label for="fNom">Nom complet *</label><input id="fNom" placeholder="Ex. : Marie-Lourdes Jean"></div>
      <div class="champ"><label for="fEmail">Email *</label><input id="fEmail" type="email" placeholder="membre@exemple.ht"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="champ"><label for="fClasse">Classe</label><input id="fClasse" placeholder="Ex. : NS4"></div>
        <div class="champ"><label for="fMdp">Mot de passe initial</label><input id="fMdp" value="oasis123"></div>
      </div>
      <div class="rangee-boutons">
        <button class="btn btn-bleu" id="btnValiderMembre">Inscrire</button>
        <button class="btn" onclick="document.getElementById('zoneModale').innerHTML=''">Annuler</button>
      </div>`);
    $('#btnValiderMembre').addEventListener('click', async () => {
      try {
        await api('/membres', { method: 'POST', body: JSON.stringify({ nom: $('#fNom').value.trim(), email: $('#fEmail').value.trim(), classe: $('#fClasse').value.trim(), motDePasse: $('#fMdp').value }) });
        fermerModale(); toast('Membre inscrit.'); afficherOnglet('membres');
      } catch (err) { $('#msgForm').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
  }

  // ---------- Branchement des boutons dynamiques ----------
  const ongletsEtat = {};
  function brancherBoutons() {
    $('#btnNouvelEmprunt')?.addEventListener('click', formEmpruntGuichet);
    $('#btnNouveauLivre')?.addEventListener('click', formNouveauLivre);
    $('#btnImporter')?.addEventListener('click', formImporter);
    $('#btnImporterPdf')?.addEventListener('click', formImporterPdf);
    $('#btnCategories')?.addEventListener('click', formCategories);
    $('#btnAjouterMedia')?.addEventListener('click', async () => {
      const btn = $('#btnAjouterMedia');
      try {
        btn.disabled = true;
        const media = await api('/medias', { method: 'POST', body: JSON.stringify({
          type: $('#mType').value, titre: $('#mTitre').value.trim(), auteur: $('#mAuteur').value.trim(),
          categorie: $('#mCategorie').value.trim(), langue: $('#mLangue').value, lieu: $('#mLieu').value.trim(),
          duree: $('#mDuree').value.trim(), description: $('#mDescription').value.trim()
        }) });
        const f = $('#mFichier').files[0];
        if (f) {
          btn.textContent = 'Envoi du fichier… (patientez)';
          const rep = await fetch('/api/medias/' + media.id + '/fichier', {
            method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream', Authorization: 'Bearer ' + jeton }, body: f
          });
          if (!rep.ok) { const d = await rep.json().catch(() => ({})); throw new Error(d.erreur || 'Fichier refusé.'); }
        }
        toast('Média ajouté' + (f ? ' avec son fichier.' : ' — pensez à joindre le fichier.'));
        afficherOnglet('multimedia');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Ajouter le média';
        $('#msgMedia').innerHTML = `<div class="erreur">${echap(err.message)}</div>`;
      }
    });
    document.querySelectorAll('[data-suppr-media]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Supprimer ce média et son fichier ?')) return;
      try { await api('/medias/' + b.dataset.supprMedia, { method: 'DELETE' }); toast('Média supprimé.'); afficherOnglet('multimedia'); }
      catch (err) { toast(err.message); }
    }));
    $('#btnSauvegarde')?.addEventListener('click', async () => {
      try {
        const rep = await fetch('/api/sauvegarde', { headers: { Authorization: 'Bearer ' + jeton } });
        if (!rep.ok) throw new Error('Sauvegarde impossible.');
        const url = URL.createObjectURL(await rep.blob());
        const el = document.createElement('a'); el.href = url;
        el.download = 'sauvegarde-oasis-' + new Date().toISOString().slice(0, 10) + '.json'; el.click();
        URL.revokeObjectURL(url); toast('Sauvegarde téléchargée — conservez-la en lieu sûr.');
      } catch (err) { toast(err.message); }
    });
    $('#btnSauverParametres')?.addEventListener('click', async () => {
      try {
        await api('/parametres', { method: 'PUT', body: JSON.stringify({
          nom: $('#pNom').value, slogan: $('#pSlogan').value, messageAccueil: $('#pAccueil').value, piedDePage: $('#pPied').value, aPropos: $('#pAPropos').value,
          adresse: $('#pAdresse').value, telephone: $('#pTel').value, email: $('#pEmail').value, horaires: $('#pHoraires').value,
          dureeEmpruntPhysique: $('#pDureeP').value, dureeEmpruntNumerique: $('#pDureeN').value,
          maxEmprunts: $('#pMax').value, retraitReservationJours: $('#pRetrait').value,
          nbPlacesLecture: $('#pPlaces').value,
          creneaux: $('#pCreneaux').value.split('\n').map(x => x.trim()).filter(Boolean)
        }) });
        toast('Paramètres enregistrés — ils s\'appliquent immédiatement.');
        remplirPied();
      } catch (err) { $('#msgParam').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
    $('#fDatePlaces')?.addEventListener('change', e => { ongletsEtat.datePlaces = e.target.value; afficherOnglet('places'); });
    $('#btnAjouterRessource')?.addEventListener('click', async () => {
      try {
        const r = await api('/ressources', { method: 'POST', body: JSON.stringify({
          genre: $('#rGenre').value, titre: $('#rTitre').value.trim(),
          contenu: $('#rContenu').value.trim(), source: $('#rSource').value.trim(),
          lien: $('#rLien').value.trim(), icone: $('#rIcone').value.trim()
        }) });
        const img = $('#rImage')?.files[0];
        if (img) {
          if (img.size > 3 * 1024 * 1024) throw new Error('Ressource créée, mais image trop volumineuse (3 Mo max).');
          const rep = await fetch('/api/ressources/' + r.id + '/image', {
            method: 'POST', headers: { 'Content-Type': img.type, Authorization: 'Bearer ' + jeton }, body: img
          });
          if (!rep.ok) { const d = await rep.json().catch(() => ({})); throw new Error(d.erreur || 'Ressource créée, mais image refusée.'); }
        }
        toast('Ressource ajoutée.'); afficherOnglet('ressources');
      } catch (err) { $('#msgRessource').innerHTML = `<div class="erreur">${echap(err.message)}</div>`; }
    });
    document.querySelectorAll('[data-suppr-ressource]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/ressources/' + b.dataset.supprRessource, { method: 'DELETE' }); toast('Ressource supprimée.'); afficherOnglet('ressources'); }
      catch (err) { toast(err.message); }
    }));
    document.querySelectorAll('[data-remettre]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/reservations/' + b.dataset.remettre + '/remettre', { method: 'PUT' }); toast('Emprunt créé — le livre est remis au membre.'); afficherOnglet('reservations'); }
      catch (err) { toast(err.message); }
    }));
    document.querySelectorAll('[data-annuler-resa]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/reservations/' + b.dataset.annulerResa, { method: 'DELETE' }); toast('Réservation annulée.'); afficherOnglet('reservations'); }
      catch (err) { toast(err.message); }
    }));
    document.querySelectorAll('[data-annuler-place]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/places/' + b.dataset.annulerPlace, { method: 'DELETE' }); toast('Place libérée.'); afficherOnglet('places'); }
      catch (err) { toast(err.message); }
    }));
    $('#btnNouveauMembre')?.addEventListener('click', formNouveauMembre);
    document.querySelectorAll('[data-retour]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/emprunts/' + b.dataset.retour + '/retour', { method: 'PUT' }); toast('Retour enregistré — exemplaire remis en rayon.'); afficherOnglet(ongletActif); }
      catch (err) { toast(err.message); }
    }));
    document.querySelectorAll('[data-prolonger]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/emprunts/' + b.dataset.prolonger + '/prolonger', { method: 'PUT' }); toast('Échéance prolongée de 7 jours.'); afficherOnglet(ongletActif); }
      catch (err) { toast(err.message); }
    }));
    document.querySelectorAll('[data-exemplaires]').forEach(b => b.addEventListener('click', () => gererExemplaires(b.dataset.exemplaires, b.dataset.titre)));
    document.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => formPdf(b.dataset.pdf, b.dataset.titre, !!b.dataset.deja)));
    document.querySelectorAll('[data-supprimer]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Supprimer ce livre et tous ses exemplaires ?')) return;
      try { await api('/livres/' + b.dataset.supprimer, { method: 'DELETE' }); toast('Livre supprimé du catalogue.'); afficherOnglet('catalogue'); }
      catch (err) { toast(err.message); }
    }));
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-onglet]');
    if (el) afficherOnglet(el.dataset.onglet);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fermerModale(); });
  $('#btnMenu').addEventListener('click', () => $('#sidebar').classList.toggle('ouverte'));
  $('#btnDeconnexion').addEventListener('click', async () => {
    try { await api('/deconnexion', { method: 'POST' }); } catch {}
    localStorage.removeItem('oasis_jeton'); localStorage.removeItem('educa_jeton');
    location.href = '/';
  });

  // ---------- Pied de page ----------
  async function remplirPied() {
    try {
      const p = await api('/parametres');
      const blocs = [`<div class="bloc"><b>${echap(p.nom)}</b>${echap(p.slogan || '')}</div>`];
      if (p.adresse || p.telephone || p.email)
        blocs.push(`<div class="bloc"><b>Contact</b>${p.adresse ? echap(p.adresse) + '<br>' : ''}${p.telephone ? '📞 ' + echap(p.telephone) + '<br>' : ''}${p.email ? '✉️ ' + echap(p.email) : ''}</div>`);
      if (p.horaires) blocs.push(`<div class="bloc"><b>Horaires</b>${echap(p.horaires)}</div>`);
      blocs.push(`<div class="copyright">${echap(p.piedDePage || '')}</div>`);
      const pied = $('#piedPage');
      if (pied) pied.innerHTML = blocs.join('');
    } catch { /* silencieux */ }
  }

  // ---------- Démarrage ----------
  (async () => {
    try {
      moi = await api('/moi');
      if (moi.role !== 'bibliothecaire') throw new Error('Accès réservé');
    } catch {
      location.href = '/'; return;
    }
    $('#appli').hidden = false;
    $('#nomProfil').textContent = moi.nom;
    $('#avatarProfil').textContent = moi.nom.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    remplirPied();
    afficherOnglet('tableau');
  })();
})();
