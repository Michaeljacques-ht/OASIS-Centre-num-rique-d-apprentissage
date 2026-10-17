/* OASIS — Surlignage en couleurs dans les lecteurs PDF, EPUB et texte.
   Les surlignages sont enregistrés avec les notes du livre (type « surlignage »). */
window.OasisSurlignage = (() => {
  const COULEURS = [['jaune', 'Jaune'], ['vert', 'Vert'], ['bleu', 'Bleu'], ['rose', 'Rose'], ['orange', 'Orange']];
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jeton = () => localStorage.getItem('oasis_jeton') || localStorage.getItem('educa_jeton') || '';
  async function api(chemin, options = {}) {
    const r = await fetch('/api' + chemin, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton() } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.erreur || 'Surlignage indisponible.');
    return d;
  }
  let notes = { livreId: null, liste: [] }, courant = null, pop = null;
  function oublier() { notes = { livreId: null, liste: [] }; }

  async function charger(livreId) {
    if (notes.livreId !== livreId) notes = { livreId, liste: (await api('/livres/' + encodeURIComponent(livreId) + '/notes').catch(() => [])).filter(n => n.type === 'surlignage') };
    return notes.liste;
  }

  /* ---------- Positions dans le texte ---------- */
  const marcheur = (doc, root) => doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentNode?.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  function texteDe(doc, root) { const w = marcheur(doc, root); let t = '', n; while ((n = w.nextNode())) t += n.data; return t; }
  function positionDe(doc, root, conteneur, decalage) {
    const w = marcheur(doc, root); let pos = 0, n;
    if (conteneur.nodeType === 3) { while ((n = w.nextNode())) { if (n === conteneur) return pos + decalage; pos += n.data.length; } return null; }
    const ref = conteneur.childNodes[decalage] || null;
    while ((n = w.nextNode())) {
      if (ref ? (ref === n || ref.contains(n) || (ref.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) : (!conteneur.contains(n) && (conteneur.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING))) return pos;
      pos += n.data.length;
    }
    return pos;
  }
  /** Repère le passage : à sa position d'origine, sinon par sa citation (espaces ignorés). */
  function localiser(texte, n) {
    const compact = s => s.replace(/\s+/g, ' ').trim();
    if (compact(texte.slice(n.debut, n.fin)) === n.texte) return [n.debut, n.fin];
    let c = '', carte = [];
    for (let i = 0; i < texte.length; i++) { const blanc = /\s/.test(texte[i]); if (blanc && (c.endsWith(' ') || !c)) continue; c += blanc ? ' ' : texte[i]; carte.push(i); }
    const i = c.indexOf(n.texte);
    return i < 0 ? null : [carte[i], carte[i + n.texte.length - 1] + 1];
  }
  function envelopper(doc, root, debut, fin, n) {
    const w = marcheur(doc, root), cibles = []; let pos = 0, t;
    while ((t = w.nextNode())) { const a = pos, b = pos + t.data.length; if (b > debut && a < fin) cibles.push([t, Math.max(0, debut - a), Math.min(t.data.length, fin - a)]); pos = b; if (pos >= fin) break; }
    for (const [noeud, s, e] of cibles) {
      if (e <= s) continue;
      let x = noeud; if (s > 0) x = x.splitText(s); if (e - s < x.data.length) x.splitText(e - s);
      const m = doc.createElement('mark'); m.className = `sl sl-${n.couleur}${n.commentaire ? ' sl-com' : ''}`; m.dataset.sl = n.id;
      m.title = n.commentaire ? 'Note : ' + n.commentaire : 'Surlignage — touchez pour modifier';
      x.parentNode.insertBefore(m, x); m.appendChild(x);
    }
  }
  function nettoyer(root) { root.querySelectorAll('mark.sl').forEach(m => { const p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); }); }

  /* ---------- Barre d'outils flottante ---------- */
  function fermerPop() { pop?.remove(); pop = null; }
  function ouvrirPop(rect, contenu) {
    fermerPop();
    pop = document.createElement('div'); pop.className = 'sl-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Surlignage');
    pop.innerHTML = contenu; document.body.append(pop);
    const l = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - l - 8, rect.left + rect.width / 2 - l / 2));
    let y = rect.bottom + 10; if (y + h > innerHeight - 8) y = Math.max(8, rect.top - h - 10);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    return pop;
  }
  const pastilles = (actuelle) => COULEURS.map(([k, nom]) => `<button type="button" class="sl-pastille sl-${k} ${k === actuelle ? 'actuelle' : ''}" data-sl-couleur="${k}" aria-label="Surligner en ${nom.toLowerCase()}" title="${nom}"></button>`).join('');

  /* ---------- Branchement d'un lecteur ---------- */
  /**
   * o = { livre, unite, root(): Element, doc(): Document, cadre(): iframe|null,
   *       page(debut): numéro, filtre(note): bool, pourcentage(): % }
   */
  function brancher(o) {
    courant?.fermer(); oublier();
    if (!jeton() || !o.livre) return { rafraichir() {}, fermer() {} };
    const docDe = () => o.doc ? o.doc() : document;
    let docActif = null, minuteur = null, ferme = false;
    const decalageCadre = () => { const f = o.cadre?.(); if (!f) return { x: 0, y: 0 }; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top }; };
    const rectDe = (r) => { const b = r.getBoundingClientRect(), d = decalageCadre(); return { left: b.left + d.x, top: b.top + d.y, bottom: b.bottom + d.y, width: b.width }; };

    function selectionValide() {
      const doc = docDe(), root = o.root?.(); if (!doc || !root) return null;
      const s = doc.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
      const r = s.getRangeAt(0);
      if (!root.contains(r.commonAncestorContainer) && r.commonAncestorContainer !== root) return null;
      const texte = s.toString().replace(/\s+/g, ' ').trim(); if (texte.length < 2) return null;
      return { r, texte, doc, root };
    }
    function proposer() {
      if (ferme) return;
      const sel = selectionValide(); if (!sel) return;
      const p = ouvrirPop(rectDe(sel.r), `<div class="sl-ligne">${pastilles()}<button type="button" class="sl-note" data-sl-note title="Surligner et ajouter une note">🗒️</button></div>
        <div class="sl-commentaire" hidden><textarea rows="2" maxlength="2000" placeholder="Votre note sur ce passage"></textarea><button type="button" class="mini-btn bleu" data-sl-enregistrer>Enregistrer</button></div>`);
      const debut = positionDe(sel.doc, sel.root, sel.r.startContainer, sel.r.startOffset), fin = positionDe(sel.doc, sel.root, sel.r.endContainer, sel.r.endOffset);
      if (debut === null || fin === null || fin <= debut) { fermerPop(); return; }
      let couleur = 'jaune';
      const creer = async (commentaire) => {
        try {
          const n = await api('/livres/' + encodeURIComponent(o.livre.id) + '/notes', { method: 'POST', body: JSON.stringify({ type: 'surlignage', couleur, texte: sel.texte.slice(0, 2000), commentaire, unite: o.unite, page: o.page(debut), debut, fin, pourcentage: o.pourcentage?.() }) });
          notes.liste.push(n); sel.doc.getSelection().removeAllRanges(); fermerPop(); rafraichir();
        } catch (err) { p.insertAdjacentHTML('beforeend', `<p class="sl-erreur">${E(err.message)}</p>`); }
      };
      p.onclick = ev => {
        const c = ev.target.closest('[data-sl-couleur]');
        if (c) { couleur = c.dataset.slCouleur; if (p.querySelector('.sl-commentaire').hidden) creer(''); else { p.querySelectorAll('.sl-pastille').forEach(b => b.classList.toggle('actuelle', b === c)); } return; }
        if (ev.target.closest('[data-sl-note]')) { p.querySelector('.sl-commentaire').hidden = false; p.querySelector(`[data-sl-couleur="${couleur}"]`).classList.add('actuelle'); p.querySelector('textarea').focus(); return; }
        if (ev.target.closest('[data-sl-enregistrer]')) creer(p.querySelector('textarea').value);
      };
    }
    function modifier(mark) {
      const n = notes.liste.find(x => x.id === mark.dataset.sl); if (!n) return;
      const p = ouvrirPop(rectDe(mark), `<div class="sl-ligne">${pastilles(n.couleur)}<button type="button" class="sl-note" data-sl-supprimer title="Retirer le surlignage" aria-label="Retirer le surlignage">🗑️</button></div>
        <div class="sl-commentaire"><textarea rows="2" maxlength="2000" placeholder="Ajouter une note sur ce passage">${E(n.commentaire || '')}</textarea><button type="button" class="mini-btn bleu" data-sl-enregistrer>Enregistrer la note</button></div>`);
      p.onclick = async ev => {
        try {
          const c = ev.target.closest('[data-sl-couleur]');
          if (c) { Object.assign(n, await api('/notes/' + n.id, { method: 'PUT', body: JSON.stringify({ couleur: c.dataset.slCouleur }) })); fermerPop(); rafraichir(); return; }
          if (ev.target.closest('[data-sl-enregistrer]')) { Object.assign(n, await api('/notes/' + n.id, { method: 'PUT', body: JSON.stringify({ commentaire: p.querySelector('textarea').value }) })); fermerPop(); rafraichir(); return; }
          if (ev.target.closest('[data-sl-supprimer]')) { await api('/notes/' + n.id, { method: 'DELETE' }); notes.liste = notes.liste.filter(x => x.id !== n.id); fermerPop(); rafraichir(); }
        } catch (err) { p.insertAdjacentHTML('beforeend', `<p class="sl-erreur">${E(err.message)}</p>`); }
      };
    }

    const surFin = () => { clearTimeout(minuteur); minuteur = setTimeout(proposer, 60); };
    const surSelection = () => { clearTimeout(minuteur); minuteur = setTimeout(() => { if (!pop || !pop.contains(document.activeElement)) proposer(); }, 450); };
    const surClic = ev => {
      const m = ev.target.closest?.('mark.sl');
      if (m && (!docDe().getSelection() || docDe().getSelection().isCollapsed)) { ev.preventDefault(); modifier(m); }
    };
    const exterieur = ev => { if (pop && !pop.contains(ev.target) && !ev.target.closest?.('mark.sl')) fermerPop(); };
    function attacherDoc() {
      const doc = docDe(); if (!doc || doc === docActif) return;
      detacherDoc(); docActif = doc;
      doc.addEventListener('pointerup', surFin); doc.addEventListener('keyup', surFin); doc.addEventListener('selectionchange', surSelection); doc.addEventListener('click', surClic);
      if (doc !== document) doc.addEventListener('pointerdown', exterieur);
    }
    function detacherDoc() {
      if (!docActif) return;
      for (const [e, f] of [['pointerup', surFin], ['keyup', surFin], ['selectionchange', surSelection], ['click', surClic], ['pointerdown', exterieur]]) docActif.removeEventListener(e, f);
      docActif = null;
    }
    document.addEventListener('pointerdown', exterieur);

    async function rafraichir() {
      if (ferme) return;
      attacherDoc();
      const liste = await charger(o.livre.id), doc = docDe(), root = o.root?.();
      if (!doc || !root || !root.isConnected) return;
      nettoyer(root);
      const texte = texteDe(doc, root);
      const aPlacer = liste.filter(n => n.unite === o.unite && (!o.filtre || o.filtre(n))).map(n => ({ n, pos: localiser(texte, n) })).filter(x => x.pos)
        .sort((a, b) => b.pos[0] - a.pos[0]);   // de la fin vers le début : les positions restent justes
      for (const { n, pos } of aPlacer) envelopper(doc, root, pos[0], pos[1], n);
      root.dataset.surlignages = String(aPlacer.length);
    }
    const handle = { rafraichir, fermer() { ferme = true; detacherDoc(); document.removeEventListener('pointerdown', exterieur); fermerPop(); if (courant === handle) courant = null; } };
    courant = handle;
    return handle;
  }
  /** Les notes ont changé ailleurs (modale « Mes notes ») : relire au prochain affichage. */
  return { brancher, oublier, fermer: () => courant?.fermer(), COULEURS };
})();
