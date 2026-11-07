/* OASIS — lecteur EPUB (1.22.0)
   Pagination réelle (ou défilement), numéros de page, sommaire avec les vrais titres, plein écran,
   thèmes clair / sépia / sombre, police, interligne, largeur du texte, recherche dans le livre,
   signets, reprise automatique à la dernière position et navigation au clavier ou au doigt. */
window.OasisEpub = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const resolve = (base, href) => {
    const parts = (base.slice(0, base.lastIndexOf('/') + 1) + decodeURIComponent(String(href).split('#')[0])).split('/'), out = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
    return out.join('/');
  };
  const stock = {
    lire(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const THEMES = {
    clair: { fond: '#ffffff', texte: '#10243e', lien: '#1e4fa3' },
    sepia: { fond: '#f6efe0', texte: '#3b2f1e', lien: '#7a4a12' },
    sombre: { fond: '#14181f', texte: '#e4e7ec', lien: '#8ab4ff' }
  };
  const POLICES = {
    serif: "Georgia, 'Times New Roman', serif",
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    lisible: "Verdana, Tahoma, 'Segoe UI', sans-serif"
  };
  const LARGEURS = { etroite: 34, normale: 44, large: 60, pleine: 999 };
  let cleanup = () => {}, sl = null;

  return {
    close() { cleanup(); },
    async open(livre, token, mount, onclose, depart) {
      cleanup();
      const cleLivre = livre.urlEpub ? 'r-' + livre.id : 'l-' + livre.id;
      const prefs = Object.assign({ taille: 19, theme: 'clair', police: 'serif', interligne: 1.7, largeur: 'normale', mode: 'pages' }, stock.lire('oasis-epub-prefs', {}));
      let stopped = false, zip, index = 0, chapters = [], tailles = [], titres = [], urls = [], chapterText = '', assistance;
      let page = 0, pages = 1, fractionCible = null, rechercheCible = null, cacheTextes = new Map();
      const signets = stock.lire('oasis-epub-signets-' + cleLivre, []);
      const enleverEcouteurs = [];
      let aller = () => {}, afficherSignets = () => {};
      const ecouter = (cible, type, f, o) => { cible.addEventListener(type, f, o); enleverEcouteurs.push(() => cible.removeEventListener(type, f, o)); };
      cleanup = () => {
        stopped = true; sl?.fermer(); assistance?.close();
        urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
        enleverEcouteurs.splice(0).forEach(f => f());
        if (document.fullscreenElement && mount.contains(document.fullscreenElement)) document.exitFullscreen?.().catch(() => {});
      };

      mount.innerHTML = `<div class="voile"><div class="modale epub-lecteur" role="dialog" aria-modal="true" aria-label="Lecteur EPUB">
        <div class="epub-entete"><h3>${E(livre.titre)}</h3>
          <button class="mini-btn" id="epubPleinEcran" title="Lecture plein écran (F)" aria-label="Lecture plein écran">⛶ Plein écran</button>
          <button class="fermer" id="epubClose" aria-label="Fermer">✕</button></div>
        <div class="epub-commandes">
          <select id="epubChapitres" aria-label="Sommaire"></select>
          <button class="mini-btn" id="epubSmall" aria-label="Réduire le texte" title="Réduire le texte">A−</button>
          <button class="mini-btn" id="epubBig" aria-label="Agrandir le texte" title="Agrandir le texte">A+</button>
          <button class="mini-btn" id="epubBoutonReglages" aria-expanded="false" title="Affichage : thème, police, mise en page">⚙️ Affichage</button>
          <button class="mini-btn" id="epubBoutonRecherche" aria-expanded="false" title="Rechercher dans le livre">🔍</button>
          <button class="mini-btn" id="epubBoutonSignets" aria-expanded="false" title="Signets">🔖</button>
          <button class="mini-btn bleu" data-complete>Terminer</button>
        </div>
        <div class="epub-panneau" id="epubReglages" hidden>
          <div class="epub-ligne"><span>Thème</span>${Object.keys(THEMES).map(t => `<button class="mini-btn" data-theme="${t}">${{ clair: '☀️ Clair', sepia: '📜 Sépia', sombre: '🌙 Sombre' }[t]}</button>`).join('')}</div>
          <div class="epub-ligne"><span>Police</span>${Object.keys(POLICES).map(p => `<button class="mini-btn" data-police="${p}">${{ serif: 'Avec empattements', sans: 'Sans empattements', lisible: 'Très lisible' }[p]}</button>`).join('')}</div>
          <div class="epub-ligne"><span>Interligne</span>${[1.4, 1.7, 2.1].map(v => `<button class="mini-btn" data-interligne="${v}">${{ 1.4: 'Serré', 1.7: 'Normal', 2.1: 'Aéré' }[v]}</button>`).join('')}</div>
          <div class="epub-ligne"><span>Largeur</span>${Object.keys(LARGEURS).map(l => `<button class="mini-btn" data-largeur="${l}">${{ etroite: 'Étroite', normale: 'Normale', large: 'Large', pleine: 'Pleine' }[l]}</button>`).join('')}</div>
          <div class="epub-ligne"><span>Lecture</span><button class="mini-btn" data-mode="pages">📄 Page par page</button><button class="mini-btn" data-mode="defilement">📜 Défilement continu</button></div>
          <p class="epub-aide">Clavier : ← → pour tourner les pages, Début / Fin du chapitre, F pour le plein écran, Échap pour en sortir. Sur téléphone : glissez vers la gauche ou la droite.</p>
        </div>
        <div class="epub-panneau" id="epubRecherche" hidden>
          <form id="epubFormRecherche" class="epub-ligne"><input id="epubTermes" type="search" placeholder="Mot ou expression à chercher dans tout le livre" aria-label="Rechercher dans le livre"><button class="mini-btn bleu">Rechercher</button></form>
          <div id="epubResultats" class="epub-resultats"></div>
        </div>
        <div class="epub-panneau" id="epubSignets" hidden>
          <div class="epub-ligne"><button class="mini-btn bleu" id="epubAjouterSignet">🔖 Marquer cette page</button></div>
          <div id="epubListeSignets" class="epub-resultats"></div>
        </div>
        <div class="epub-zone">
          <button class="epub-tourne" id="epubPrev" aria-label="Page précédente" title="Page précédente">‹</button>
          <iframe id="epubFrame" title="Contenu du livre" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>
          <button class="epub-tourne" id="epubNext" aria-label="Page suivante" title="Page suivante">›</button>
        </div>
        <div class="epub-pied">
          <div class="epub-barre" aria-hidden="true"><div id="epubBarre"></div></div>
          <p id="epubStatus" role="status">Chargement de l’EPUB…</p>
        </div>
      </div></div>`;
      const $ = id => mount.querySelector('#' + id);
      const modale = mount.querySelector('.epub-lecteur'), voile = mount.querySelector('.voile');
      const frame = $('epubFrame');
      const fdoc = () => frame?.contentDocument;
      const pourcentageGlobal = () => {
        if (!chapters.length) return 0;
        const total = tailles.reduce((a, b) => a + b, 0) || 1, avant = tailles.slice(0, index).reduce((a, b) => a + b, 0);
        return Math.min(100, Math.round((avant + tailles[index] * ((page + 1) / Math.max(1, pages))) / total * 100));
      };

      sl = token && !livre.urlEpub ? window.OasisSurlignage?.brancher({ livre, unite: 'chapitre', doc: () => fdoc(), root: () => fdoc()?.body, cadre: () => frame, page: () => index + 1, filtre: n => n.page === index + 1, pourcentage: () => pourcentageGlobal() }) : null;
      assistance = window.OasisLecture?.start(modale, livre, token, () => chapterText, { unite: 'chapitre', page: () => index + 1, aller: n => { if (!chapters.length) return; aller(Math.max(0, Math.min(chapters.length - 1, n - 1)), 0); } });
      if (livre.urlEpub) mount.querySelector('[data-complete]').hidden = true;
      mount.querySelector('[data-complete]').onclick = async () => {
        try { const r = await fetch('/api/livres/' + encodeURIComponent(livre.id) + '/terminer', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); const d = await r.json(); statut(r.ok ? 'Lecture validée.' : d.erreur); }
        catch { statut('Validation indisponible.'); }
      };
      $('epubClose').onclick = () => { cleanup(); onclose(); };
      const statut = t => { const s = $('epubStatus'); if (s) s.textContent = t; };

      /* ---------- Plein écran ---------- */
      const pleinEcran = () => voile.classList.contains('epub-plein');
      const basculerPleinEcran = async (forcer) => {
        const activer = forcer ?? !pleinEcran();
        voile.classList.toggle('epub-plein', activer);
        $('epubPleinEcran').textContent = activer ? '🗗 Quitter le plein écran' : '⛶ Plein écran';
        try {
          if (activer && !document.fullscreenElement && modale.requestFullscreen) await modale.requestFullscreen();
          if (!activer && document.fullscreenElement) await document.exitFullscreen();
        } catch {}
        setTimeout(repaginer, 120);
      };
      $('epubPleinEcran').onclick = () => basculerPleinEcran();
      ecouter(document, 'fullscreenchange', () => { if (!document.fullscreenElement && pleinEcran()) basculerPleinEcran(false); });

      /* ---------- Panneaux ---------- */
      const panneaux = { epubBoutonReglages: 'epubReglages', epubBoutonRecherche: 'epubRecherche', epubBoutonSignets: 'epubSignets' };
      for (const [b, p] of Object.entries(panneaux)) $(b).onclick = () => {
        const ouvrir = $(p).hidden;
        for (const [b2, p2] of Object.entries(panneaux)) { $(p2).hidden = true; $(b2).setAttribute('aria-expanded', 'false'); }
        $(p).hidden = !ouvrir; $(b).setAttribute('aria-expanded', String(ouvrir));
        if (ouvrir && p === 'epubRecherche') $('epubTermes').focus();
        if (ouvrir && p === 'epubSignets') afficherSignets();
        setTimeout(repaginer, 60);
      };
      const marquerReglages = () => {
        mount.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('bleu', b.dataset.theme === prefs.theme));
        mount.querySelectorAll('[data-police]').forEach(b => b.classList.toggle('bleu', b.dataset.police === prefs.police));
        mount.querySelectorAll('[data-interligne]').forEach(b => b.classList.toggle('bleu', Number(b.dataset.interligne) === prefs.interligne));
        mount.querySelectorAll('[data-largeur]').forEach(b => b.classList.toggle('bleu', b.dataset.largeur === prefs.largeur));
        mount.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('bleu', b.dataset.mode === prefs.mode));
        modale.dataset.theme = prefs.theme; modale.dataset.mode = prefs.mode;
      };
      const changerPref = (k, v) => { prefs[k] = v; stock.ecrire('oasis-epub-prefs', prefs); marquerReglages(); const f = fraction(); appliquerStyle(); fractionCible = f; repaginer(); };
      mount.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => changerPref('theme', b.dataset.theme));
      mount.querySelectorAll('[data-police]').forEach(b => b.onclick = () => changerPref('police', b.dataset.police));
      mount.querySelectorAll('[data-interligne]').forEach(b => b.onclick = () => changerPref('interligne', Number(b.dataset.interligne)));
      mount.querySelectorAll('[data-largeur]').forEach(b => b.onclick = () => changerPref('largeur', b.dataset.largeur));
      mount.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => changerPref('mode', b.dataset.mode));
      $('epubSmall').onclick = () => changerPref('taille', Math.max(13, prefs.taille - 2));
      $('epubBig').onclick = () => changerPref('taille', Math.min(36, prefs.taille + 2));
      marquerReglages();

      /* ---------- Mise en page dans le cadre ---------- */
      const styleLecture = () => {
        const t = THEMES[prefs.theme] || THEMES.clair, largeurMax = LARGEURS[prefs.largeur] || 44;
        const commun = `html{background:${t.fond}}body{color:${t.texte}!important;background:${t.fond}!important;font-family:${POLICES[prefs.police]}!important;font-size:${prefs.taille}px!important;line-height:${prefs.interligne}!important;overflow-wrap:anywhere;margin:0}
          body *{font-family:inherit;color:inherit;background-color:transparent!important;line-height:inherit}
          p,li,div,span,td{font-size:inherit!important}h1{font-size:1.6em!important}h2{font-size:1.35em!important}h3{font-size:1.15em!important}
          a{color:${t.lien}!important}img,svg{max-width:100%;height:auto}table{max-width:100%}
          mark.sl{color:inherit;border-radius:2px;cursor:pointer}mark.sl-jaune{background:#ffe066!important;color:#10243e!important}mark.sl-vert{background:#a8e6b0!important;color:#10243e!important}mark.sl-bleu{background:#a9d1ff!important;color:#10243e!important}mark.sl-rose{background:#ffbcd8!important;color:#10243e!important}mark.sl-orange{background:#ffc98f!important;color:#10243e!important}mark.sl-com{border-bottom:2px dotted #7a5a00}
          ::highlight(epub-recherche){background:#ffd54a;color:#10243e}`;
        if (prefs.mode === 'pages') return commun + `
          html{height:100%;overflow:hidden}
          body{box-sizing:border-box;height:100vh;padding:28px var(--marge);column-width:calc(100vw - 2*var(--marge));column-gap:calc(2*var(--marge));column-fill:auto;overflow:visible}
          :root{--marge:max(24px, calc((100vw - ${largeurMax}em) / 2))}
          img{max-height:calc(100vh - 70px);object-fit:contain;break-inside:avoid}h1,h2,h3{break-after:avoid}`;
        return commun + `
          :root{--marge:max(20px, calc((100vw - ${largeurMax}em) / 2))}
          body{box-sizing:border-box;padding:28px var(--marge) 60px}`;
      };
      const appliquerStyle = () => {
        const d = fdoc(); if (!d) return;
        let s = d.getElementById('oasis-style-lecture');
        if (!s) { s = d.createElement('style'); s.id = 'oasis-style-lecture'; d.head.appendChild(s); }
        s.textContent = styleLecture();
      };
      const largeurPage = () => fdoc()?.documentElement.clientWidth || frame.clientWidth || 1;
      const hauteurPage = () => fdoc()?.documentElement.clientHeight || frame.clientHeight || 1;
      const compterPages = () => {
        const d = fdoc(); if (!d) return 1;
        if (prefs.mode === 'pages') return Math.max(1, Math.round(Math.max(d.documentElement.scrollWidth, d.body.scrollWidth) / largeurPage()));
        return Math.max(1, Math.ceil((d.documentElement.scrollHeight - 4) / hauteurPage()));
      };
      const fraction = () => pages > 1 ? page / pages : 0;
      const montrerPage = () => {
        const d = fdoc(); if (!d) return;
        page = Math.max(0, Math.min(pages - 1, page));
        if (prefs.mode === 'pages') { d.documentElement.scrollLeft = 0; d.body.style.transform = `translateX(${-page * largeurPage()}px)`; }
        else { d.body.style.transform = ''; d.documentElement.scrollTop = page * hauteurPage(); }
        majInfos();
      };
      function repaginer() {
        if (!fdoc()?.body) return;
        const f = fractionCible ?? fraction();
        fractionCible = null;
        pages = compterPages();
        page = f >= 1 ? pages - 1 : Math.floor(f * pages + 0.0001);
        montrerPage();
      }
      const titreChapitre = i => titres[i] || 'Section ' + (i + 1);
      function majInfos() {
        if (!chapters.length) return;
        const total = tailles.reduce((a, b) => a + b, 0) || 1, avant = tailles.slice(0, index).reduce((a, b) => a + b, 0);
        const octetsParPage = Math.max(400, (tailles[index] || 1) / Math.max(1, pages));
        const pageLivre = Math.floor(avant / octetsParPage) + page + 1, totalLivre = Math.max(pageLivre, Math.round(total / octetsParPage));
        const pct = pourcentageGlobal();
        statut(`Page ${page + 1} sur ${pages} de ce chapitre · environ page ${pageLivre} sur ${totalLivre} · ${pct} % du livre · ${titreChapitre(index)}`);
        $('epubBarre').style.width = pct + '%';
        $('epubPrev').disabled = index === 0 && page === 0;
        $('epubNext').disabled = index === chapters.length - 1 && page >= pages - 1;
        stock.ecrire('oasis-epub-pos-' + cleLivre, { c: index, f: fraction() });
        assistance?.progress(pct);
        enregistrerProgression(pct);
      }
      let minuterieProgression = null;
      const enregistrerProgression = pct => {
        if (!token || livre.urlEpub) return;
        clearTimeout(minuterieProgression);
        minuterieProgression = setTimeout(() => fetch('/api/livres/' + encodeURIComponent(livre.id) + '/progression', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ pourcentage: pct }) }).then(r => r.ok ? r.json() : null).then(d => assistance?.valider?.(d)).catch(() => {}), 1500);
      };

      /* ---------- Navigation ---------- */
      const suivante = () => { if (page < pages - 1) { page++; montrerPage(); } else if (index < chapters.length - 1) aller(index + 1, 0); };
      const precedente = () => { if (page > 0) { page--; montrerPage(); } else if (index > 0) aller(index - 1, 1); };
      $('epubPrev').onclick = precedente; $('epubNext').onclick = suivante;
      $('epubChapitres').onchange = e => aller(Number(e.target.value), 0);
      const touches = e => {
        if (e.target?.closest?.('input,textarea,select')) return;
        if (['ArrowRight', 'PageDown', ' '].includes(e.key) && !(e.key === ' ' && prefs.mode === 'defilement')) { e.preventDefault(); suivante(); }
        else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); precedente(); }
        else if (e.key === 'Home') { page = 0; montrerPage(); }
        else if (e.key === 'End') { page = pages - 1; montrerPage(); }
        else if (e.key === 'f' || e.key === 'F') basculerPleinEcran();
        else if (e.key === 'Escape' && pleinEcran()) basculerPleinEcran(false);
      };
      ecouter(document, 'keydown', touches);
      ecouter(window, 'resize', () => { clearTimeout(window.__oasisEpubRedim); window.__oasisEpubRedim = setTimeout(repaginer, 150); });

      function brancherCadre() {
        const d = fdoc(); if (!d) return;
        d.addEventListener('keydown', touches);
        let x0 = null, y0 = null;
        d.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
        d.addEventListener('touchend', e => {
          if (x0 === null || prefs.mode !== 'pages') return;
          const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && !d.getSelection()?.toString()) { dx < 0 ? suivante() : precedente(); }
        }, { passive: true });
        d.addEventListener('wheel', e => {
          if (prefs.mode !== 'pages' || Math.abs(e.deltaY) < 30) return;
          e.preventDefault(); clearTimeout(d.__roue); d.__roue = setTimeout(() => (e.deltaY > 0 ? suivante() : precedente()), 40);
        }, { passive: false });
        d.addEventListener('scroll', () => {
          if (prefs.mode !== 'defilement') return;
          const p = Math.min(pages - 1, Math.floor((d.documentElement.scrollTop + 10) / hauteurPage()));
          if (p !== page) { page = p; majInfos(); }
        });
        d.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
          e.preventDefault(); const cible = d.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); if (cible) allerAuNoeud(cible);
        }));
      }
      const pageDuNoeud = noeud => {
        const d = fdoc(); if (!d || !noeud) return 0;
        const r = (noeud.getBoundingClientRect ? noeud : (() => { const g = d.createRange(); g.selectNode(noeud); return g; })()).getBoundingClientRect();
        return prefs.mode === 'pages'
          ? Math.max(0, Math.floor((r.left + page * largeurPage()) / largeurPage()))
          : Math.max(0, Math.floor((r.top + d.documentElement.scrollTop - 20) / hauteurPage()));
      };
      const allerAuNoeud = n => { page = pageDuNoeud(n); montrerPage(); };

      /* ---------- Lecture du fichier ---------- */
      try {
        const response = await fetch(livre.urlEpub || '/api/livres/' + encodeURIComponent(livre.id) + '/epub?lecture=1', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
        if (!response.ok) { const d = await response.json().catch(() => ({})); throw Error(d.erreur || 'EPUB indisponible.'); }
        zip = await JSZip.loadAsync(await response.arrayBuffer()); if (stopped) return;
        let total = 0; for (const entry of Object.values(zip.files)) { total += entry._data?.uncompressedSize || 0; if (total > 80 * 1024 * 1024) throw Error('Ce document est trop volumineux pour le lecteur en ligne.'); }
        const read = async path => { const f = zip.file(path); if (!f) throw Error('Fichier EPUB incomplet : ' + path); if ((f._data?.uncompressedSize || 0) > 10 * 1024 * 1024) throw Error('Chapitre trop volumineux.'); return f.async('string'); };
        const xml = s => new DOMParser().parseFromString(s, 'application/xml');
        const container = xml(await read('META-INF/container.xml'));
        const opfPath = container.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path'); if (!opfPath) throw Error('Structure EPUB invalide.');
        const opf = xml(await read(opfPath)), items = new Map([...opf.getElementsByTagNameNS('*', 'item')].map(x => [x.getAttribute('id'), x]));
        chapters = [...opf.getElementsByTagNameNS('*', 'itemref')].filter(x => x.getAttribute('linear') !== 'no').map(x => items.get(x.getAttribute('idref'))).filter(Boolean).map(x => resolve(opfPath, x.getAttribute('href')));
        if (!chapters.length) throw Error('Aucun chapitre lisible.');
        tailles = chapters.map(p => Math.max(200, zip.file(p)?._data?.uncompressedSize || 2000));

        // Sommaire : titres réels tirés de la table des matières (EPUB 3 « nav » ou EPUB 2 « toc.ncx »)
        const titresParFichier = new Map();
        try {
          const nav = [...items.values()].find(x => /\bnav\b/.test(x.getAttribute('properties') || ''));
          if (nav) {
            const navPath = resolve(opfPath, nav.getAttribute('href'));
            const nd = new DOMParser().parseFromString(await read(navPath), 'text/html');
            const toc = [...nd.querySelectorAll('nav')].find(n => /toc/.test(n.getAttribute('epub:type') || n.getAttribute('type') || n.id || '')) || nd.querySelector('nav');
            toc?.querySelectorAll('a[href]').forEach(a => { const p = resolve(navPath, a.getAttribute('href')), t = a.textContent.replace(/\s+/g, ' ').trim(); if (t && !titresParFichier.has(p)) titresParFichier.set(p, t); });
          }
          if (!titresParFichier.size) {
            const ncxItem = items.get(opf.getElementsByTagNameNS('*', 'spine')[0]?.getAttribute('toc')) || [...items.values()].find(x => /ncx/.test(x.getAttribute('media-type') || ''));
            if (ncxItem) {
              const ncxPath = resolve(opfPath, ncxItem.getAttribute('href')), ncx = xml(await read(ncxPath));
              for (const np of ncx.getElementsByTagNameNS('*', 'navPoint')) {
                const src = np.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('src'), t = np.getElementsByTagNameNS('*', 'text')[0]?.textContent.replace(/\s+/g, ' ').trim();
                if (src && t) { const p = resolve(ncxPath, src); if (!titresParFichier.has(p)) titresParFichier.set(p, t); }
              }
            }
          }
        } catch {}
        let dernier = '';
        titres = chapters.map((p, i) => { const t = titresParFichier.get(p); if (t) { dernier = t; return t; } return dernier ? dernier + ' (suite)' : (i === 0 ? 'Début' : 'Section ' + (i + 1)); });
        $('epubChapitres').innerHTML = chapters.map((p, i) => `<option value="${i}">${E(titres[i].slice(0, 90))}</option>`).join('');

        // Point de départ : demandé par l'appelant, sinon dernière position mémorisée
        const memo = stock.lire('oasis-epub-pos-' + cleLivre, null);
        if (depart !== undefined && depart !== null && depart !== '') { index = Math.max(0, Math.min(chapters.length - 1, Number(depart) || 0)); fractionCible = 0; }
        else if (memo && memo.c < chapters.length) { index = memo.c; fractionCible = memo.f || 0; }

        const textesChapitre = async i => {
          if (cacheTextes.has(i)) return cacheTextes.get(i);
          const d = new DOMParser().parseFromString(await read(chapters[i]), 'text/html');
          const t = (d.body?.textContent || '').replace(/\s+/g, ' ');
          cacheTextes.set(i, t); return t;
        };

        let serial = 0;
        async function render() {
          const task = ++serial, current = index; assistance?.changed(); statut('Chargement…');
          const path = chapters[current];
          try {
            const doc = new DOMParser().parseFromString(await read(path), 'text/html');
            doc.querySelectorAll('script,iframe,object,embed,form,input,button,meta,base,audio,video').forEach(n => n.remove());
            const css = [];
            for (const link of [...doc.querySelectorAll('link')]) {
              const href = link.getAttribute('href');
              if (link.rel === 'stylesheet' && href && !/^(?:[a-z]+:|\/\/)/i.test(href)) { const f = zip.file(resolve(path, href)); if (f && (f._data?.uncompressedSize || 0) < 1048576) css.push(await f.async('string')); }
              link.remove();
            }
            for (const node of doc.querySelectorAll('*')) for (const a of [...node.attributes]) if (/^on/i.test(a.name) || ['srcset', 'action', 'formaction', 'target', 'xlink:href'].includes(a.name)) node.removeAttribute(a.name);
            for (const img of doc.querySelectorAll('img')) {
              const href = img.getAttribute('src') || ''; img.removeAttribute('src');
              if (!/^(?:[a-z]+:|\/\/)/i.test(href)) { const f = zip.file(resolve(path, href)); if (f && (f._data?.uncompressedSize || 0) < 5 * 1024 * 1024) { const u = URL.createObjectURL(await f.async('blob')); urls.push(u); img.src = u; } }
            }
            doc.querySelectorAll('svg image').forEach(n => n.remove());
            doc.querySelectorAll('a').forEach(a => { const h = a.getAttribute('href') || ''; if (!h.startsWith('#')) a.removeAttribute('href'); });
            if (stopped || task !== serial) return;
            chapterText = doc.body.textContent; cacheTextes.set(current, chapterText.replace(/\s+/g, ' '));
            assistance?.ready();
            const policy = "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; font-src 'none';";
            await new Promise(ok => {
              frame.onload = () => ok();
              frame.srcdoc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join('\n').replace(/<\/style/gi, '')}</style></head><body>${doc.body.innerHTML}</body></html>`;
            });
            if (stopped || task !== serial) return;
            appliquerStyle(); brancherCadre();
            const d = fdoc(); await Promise.race([Promise.all([...d.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 1500))]);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            index = current; $('epubChapitres').value = String(current);
            repaginer();
            sl?.rafraichir();
            if (rechercheCible) { const c = rechercheCible; rechercheCible = null; surlignerRecherche(c); }
          } catch (e) { if (!stopped) statut(e.message); }
        }
        aller = (i, f) => { index = Math.max(0, Math.min(chapters.length - 1, i)); fractionCible = f; render(); };

        /* ---------- Recherche dans tout le livre ---------- */
        const sansAccent = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        function surlignerRecherche(terme) {
          const d = fdoc(); if (!d) return;
          const cible = sansAccent(terme), w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const i = sansAccent(n.nodeValue).indexOf(cible);
            if (i >= 0) {
              const r = d.createRange(); r.setStart(n, i); r.setEnd(n, Math.min(n.nodeValue.length, i + terme.length));
              const box = r.getBoundingClientRect();
              page = prefs.mode === 'pages' ? Math.max(0, Math.floor((box.left + page * largeurPage()) / largeurPage())) : Math.max(0, Math.floor((box.top + d.documentElement.scrollTop - 20) / hauteurPage()));
              montrerPage();
              try { const H = d.defaultView.Highlight, reg = d.defaultView.CSS?.highlights; if (H && reg) { reg.set('epub-recherche', new H(r)); setTimeout(() => reg.delete('epub-recherche'), 6000); } } catch {}
              return;
            }
          }
        }
        $('epubFormRecherche').onsubmit = async e => {
          e.preventDefault();
          const terme = $('epubTermes').value.trim(), zone = $('epubResultats');
          if (terme.length < 2) { zone.innerHTML = '<p class="epub-aide">Saisissez au moins 2 caractères.</p>'; return; }
          zone.innerHTML = '<p class="epub-aide">Recherche en cours…</p>';
          const cible = sansAccent(terme), res = [];
          for (let i = 0; i < chapters.length && res.length < 80; i++) {
            let t; try { t = await textesChapitre(i); } catch { continue; }
            const bas = sansAccent(t); let pos = bas.indexOf(cible);
            while (pos >= 0 && res.length < 80) {
              res.push({ i, extrait: '…' + t.slice(Math.max(0, pos - 60), pos) + '<b>' + E(t.slice(pos, pos + terme.length)) + '</b>' + t.slice(pos + terme.length, pos + terme.length + 60) + '…' });
              pos = bas.indexOf(cible, pos + cible.length);
            }
          }
          zone.innerHTML = res.length ? `<p class="epub-aide">${res.length >= 80 ? '80 premiers résultats' : res.length + ' résultat' + (res.length > 1 ? 's' : '')}</p>` + res.map((r, k) => `<button class="epub-resultat" data-r="${k}"><small>${E(titreChapitre(r.i))}</small><span>${r.extrait.replace(/<b>|<\/b>/g, m => m === '<b>' ? '\u0001' : '\u0002').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/\u0001/g, '<b>').replace(/\u0002/g, '</b>')}</span></button>`).join('')
            : '<p class="epub-aide">Aucun résultat dans ce livre.</p>';
          zone.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
            const r = res[Number(b.dataset.r)];
            if (r.i === index) surlignerRecherche(terme); else { rechercheCible = terme; aller(r.i, 0); }
          });
        };

        /* ---------- Signets ---------- */
        afficherSignets = () => {
          const zone = $('epubListeSignets');
          zone.innerHTML = signets.length ? signets.map((s, k) => `<div class="epub-signet"><button class="epub-resultat" data-s="${k}"><small>${E(new Date(s.d).toLocaleDateString('fr-FR'))}</small><span>${E(s.t)}</span></button><button class="mini-btn" data-sup="${k}" aria-label="Supprimer ce signet">✕</button></div>`).join('')
            : '<p class="epub-aide">Aucun signet pour ce livre. Cliquez sur « Marquer cette page » pour en ajouter un.</p>';
          zone.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = signets[Number(b.dataset.s)]; aller(s.c, s.f); });
          zone.querySelectorAll('[data-sup]').forEach(b => b.onclick = () => { signets.splice(Number(b.dataset.sup), 1); stock.ecrire('oasis-epub-signets-' + cleLivre, signets); afficherSignets(); });
        };
        $('epubAjouterSignet').onclick = () => {
          signets.push({ c: index, f: fraction(), d: Date.now(), t: `${titreChapitre(index)} — page ${page + 1} sur ${pages}` });
          signets.sort((a, b) => a.c - b.c || a.f - b.f); stock.ecrire('oasis-epub-signets-' + cleLivre, signets); afficherSignets();
        };

        await render();
      } catch (e) { if (!stopped) statut(e.message); }
    }
  };
})();
