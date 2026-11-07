/* OASIS 1.27.0 — Page « À propos » : la bibliothèque, ses collections, son modèle et son fondateur. */
window.OasisAPropos = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombre = n => Number(n || 0).toLocaleString('fr-FR');
  const initiales = nom => String(nom || 'OASIS').split(/\s+/).filter(Boolean).map(m => m[0]).join('').slice(0, 2).toUpperCase();

  async function render(api, p) {
    const st = await api('/statistiques-publiques').catch(() => null) || {};
    const multimedia = (st.videos || 0) + (st.audios || 0) + (st.cartes || 0);
    const chiffres = [
      ['📚', st.livres, 'livres et documents'], ['🎬', multimedia, 'vidéos, audios et cartes'],
      ['🔎', st.ressources, 'ressources en ligne'], ['🗂️', st.categories, 'catégories'],
      ['👥', st.membres, 'membres inscrits'], ['📖', st.lectures, 'lectures']
    ].filter(([, n]) => n);
    const collections = [
      ['📚', 'Livres et e-books', 'Romans, essais, manuels, classiques du domaine public et ouvrages haïtiens, à lire en ligne en EPUB ou PDF.'],
      ['🏛️', 'Documents officiels et historiques', 'Constitutions, lois, Moniteur, archives et grands textes de l’histoire d’Haïti.'],
      ['🎧', 'Multimédia', 'Livres audio, conférences, documentaires et vidéos éducatives en créole, en français et en d’autres langues.'],
      ['🗺️', 'Cartes', 'Cartes historiques et géographiques d’Haïti et du monde.'],
      ['🔬', 'Ressources spécialisées', 'Bases de données, encyclopédies, dictionnaires et sites de référence par discipline.'],
      ['🧪', 'Laboratoire virtuel', 'Simulations et expériences interactives en sciences, mathématiques et technologie.'],
      ['🧑‍🏫', 'Outils technopédagogiques', 'Une sélection d’outils numériques pour les enseignants et pour les apprenants.']
    ];
    const outils = [
      ['📖', 'Lecteur moderne', 'Pagination, plein écran, thèmes clair, sépia et sombre, signets et recherche dans le texte.'],
      ['🤖', 'OASIS IA', 'Un assistant qui explique, résume et répond aux questions sur le livre en cours.'],
      ['⏱️', 'Suivi de lecture réel', 'La progression avance avec le temps de lecture véritable, jusqu’au certificat de lecture.'],
      ['🧠', 'Quiz et défis', 'Des questions pour vérifier la compréhension et motiver la lecture.'],
      ['👥', 'Clubs de lecture', 'Des groupes d’étude et de discussion entre élèves, étudiants et enseignants.'],
      ['📑', 'Citations', 'Références prêtes à copier en APA, MLA, Chicago, ISO 690 et IEEE, et export vers Zotero.']
    ];
    const domaines = String(p.fondateurDomaines || '').split(',').map(x => x.trim()).filter(Boolean);
    const contacts = [
      p.adresse && ['📍', 'Adresse', E(p.adresse)],
      p.telephone && ['📞', 'Téléphone', `<a href="tel:${E(String(p.telephone).replace(/[^\d+]/g, ''))}">${E(p.telephone)}</a>`],
      p.email && ['✉️', 'Courriel', `<a href="mailto:${E(p.email)}">${E(p.email)}</a>`],
      p.horaires && ['🕐', 'Disponibilité', E(p.horaires)]
    ].filter(Boolean);

    return `<div class="apropos">
      <section class="apropos-hero">
        <img src="/logo.png" alt="" class="apropos-logo">
        <div>
          <span class="apropos-surtitre">À propos</span>
          <h2>${E(p.nom || 'OASIS Bibliothèque Numérique')}</h2>
          <p class="apropos-slogan">${E(p.slogan || '')}</p>
          <p class="apropos-intro">${E(p.aPropos || '')}</p>
          <div class="apropos-actions"><button class="btn btn-bleu" data-vue="bibliotheque">📚 Explorer la bibliothèque</button><button class="btn btn-orange" data-vue="abonnement">💝 Soutenir par un don</button></div>
        </div>
      </section>

      ${chiffres.length ? `<section class="apropos-chiffres" aria-label="OASIS en chiffres">${chiffres.map(([i, n, t]) => `<div><span aria-hidden="true">${i}</span><b>${nombre(n)}</b><small>${t}</small></div>`).join('')}</section>` : ''}

      <section class="apropos-duo">
        <article><span class="apropos-pastille">🎯</span><h3>Notre mission</h3><p>${E(p.mission || '')}</p></article>
        <article><span class="apropos-pastille">🔭</span><h3>Notre vision</h3><p>${E(p.vision || '')}</p></article>
      </section>

      <section class="apropos-bloc">
        <h3>Ce que vous trouvez sur OASIS</h3>
        <div class="apropos-grille">${collections.map(([i, t, d]) => `<article><span aria-hidden="true">${i}</span><h4>${t}</h4><p>${d}</p></article>`).join('')}</div>
      </section>

      <section class="apropos-bloc">
        <h3>Une bibliothèque pensée pour apprendre</h3>
        <div class="apropos-grille compacte">${outils.map(([i, t, d]) => `<article><span aria-hidden="true">${i}</span><h4>${t}</h4><p>${d}</p></article>`).join('')}</div>
      </section>

      <section class="apropos-modele">
        <div><h3>💝 Gratuite, portée par les dons</h3>
          <p>OASIS ne vend pas l’accès au savoir. La bibliothèque vit uniquement des dons des lecteurs, des familles, des établissements et des partenaires. Un don, par MonCash ou NatCash, ouvre l’accès complet et finance la numérisation de nouveaux livres et l’accès des apprenants qui ne peuvent pas donner.</p>
          <ul><li>Élèves et étudiants : un petit don mensuel ou annuel</li><li>Écoles et universités : des paliers adaptés à leur taille</li><li>Entreprises : le programme Partenaires supporteurs</li></ul>
        </div>
        <div class="apropos-modele-actions"><button class="btn btn-orange" data-vue="abonnement">Faire un don</button><button class="btn" data-vue="partenaires">🤝 Nos partenaires</button></div>
      </section>

      ${p.fondateurNom ? `<section class="apropos-fondateur">
        <div class="fondateur-avatar" aria-hidden="true">${E(initiales(p.fondateurNom))}</div>
        <div>
          <span class="apropos-surtitre">Le fondateur</span>
          <h3>${E(p.fondateurNom)}</h3>
          ${p.fondateurTitre ? `<p class="fondateur-titre">${E(p.fondateurTitre)}</p>` : ''}
          <p>${E(p.fondateurBio || '')}</p>
          ${domaines.length ? `<ul class="fondateur-domaines">${domaines.map(d => `<li>${E(d)}</li>`).join('')}</ul>` : ''}
        </div>
      </section>` : ''}

      ${contacts.length ? `<section class="apropos-bloc"><h3>Nous joindre</h3><div class="apropos-contacts">${contacts.map(([i, t, v]) => `<div><span aria-hidden="true">${i}</span><small>${t}</small><b>${v}</b></div>`).join('')}</div></section>` : ''}
    </div>`;
  }
  return { render };
})();
