/* OASIS 1.27.0 — Citations bibliographiques complètes (APA 7, MLA 9, Chicago, ISO 690, IEEE, BibTeX, RIS).
   Utilise l'éditeur réel du document ; si l'information manque, la citation le signale au lieu d'inventer. */
window.OasisCitations = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BIBLIO = 'OASIS Bibliothèque Numérique';
  const ANONYME = /^(anonyme|inconnu|auteur inconnu|collectif)?$/i;

  /* ---------- Auteurs ---------- */
  // Auteurs collectifs (institutions, collections, équipes) : jamais inversés ni réduits à des initiales.
  const COLLECTIF = /(?:^|[^\p{L}])(collection|équipe|equipe|collectif|anthologie|minist[eè]re|universit[ée]|institut|organisation|association|commission|conseil|direction|gouvernement|r[ée]publique|soci[ée]t[ée]|banque|bureau|centre|comit[ée]|fondation|acad[ée]mie|[ée]cole|unesco|unicef|onu|oms|fao|menfp|bnf|biblioth[eè]que|archives|service|agence|programme|projet|parlement|s[ée]nat|chambre|f[ée]d[ée]ration|groupe|club|r[ée]seau|[ée]ditions?)(?![\p{L}])|^[A-Z0-9&.\- ]{2,12}$/iu;
  function decouper(auteur) {
    if (ANONYME.test(String(auteur || '').trim())) return [];
    if (COLLECTIF.test(String(auteur).trim())) return [{ nom: String(auteur).trim(), prenom: '', collectif: true }];
    return String(auteur).split(/\s*(?:;|\bet\b|&|\band\b|,(?=\s*[A-ZÀ-Ý][^,]*\s[A-ZÀ-Ý]))\s*/).map(x => x.trim()).filter(Boolean).map(nom => {
      if (nom.includes(',')) { const [n, p] = nom.split(',').map(x => x.trim()); return { nom: n, prenom: p || '' }; }
      const mots = nom.split(/\s+/);
      if (mots.length === 1) return { nom: nom, prenom: '' };
      // particules : de, du, des, van, von, d'
      let k = mots.length - 1; while (k > 1 && /^(de|du|des|da|van|von|le|la|d’|d')$/i.test(mots[k - 1])) k--;
      return { prenom: mots.slice(0, k).join(' '), nom: mots.slice(k).join(' ') };
    });
  }
  const initiales = p => p.split(/[\s]+/).filter(Boolean).map(m => m.split('-').map(x => x[0].toUpperCase() + '.').join('-')).join(' ');
  const nomInv = a => a.prenom ? `${a.nom}, ${a.prenom}` : a.nom;
  const nomDir = a => a.prenom ? `${a.prenom} ${a.nom}` : a.nom;
  const liste = (xs, sep, dernier) => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(sep) + dernier + xs[xs.length - 1];

  /* ---------- Données ---------- */
  function donnees(l) {
    const aujourdhui = new Date();
    const edition = String(l.edition || '').trim();
    const numEd = (edition.match(/^(\d+)/) || [])[1];
    return {
      auteurs: decouper(l.auteur), auteurBrut: ANONYME.test(String(l.auteur || '').trim()) ? '' : String(l.auteur).trim(),
      titre: String(l.titre || '').trim(), annee: l.annee ? String(l.annee) : '',
      edition: numEd && numEd !== '1' ? `${numEd}${numEd === '1' ? 're' : 'e'} éd.` : (edition && !/^1(re|ère|er)?\b/i.test(edition) ? edition : ''),
      editeur: String(l.editeur || '').trim(), lieu: String(l.lieuEdition || '').trim(), isbn: String(l.isbn || '').trim(),
      source: String(l.sourceNumerique || '').trim(), langue: l.langue || '', type: l.pdf ? 'PDF' : l.epub ? 'EPUB' : l.versionNumerique ? 'texte en ligne' : 'imprimé',
      url: location.origin + '/?livre=' + encodeURIComponent(l.id), numerique: !!l.versionNumerique,
      consulte: aujourdhui.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      consulteIso: aujourdhui.toISOString().slice(0, 10)
    };
  }
  const point = s => /[.!?…»]$/.test(s) ? s : s + '.';

  /* ---------- Styles (HTML : titre en italique) ---------- */
  function styles(d) {
    const T = `<i>${E(d.titre)}</i>`, A = d.auteurs;
    const ed = d.edition ? ` (${E(d.edition)})` : '';
    const disponible = d.numerique ? ` ${BIBLIO}. ${E(d.url)}` : '';
    const lieuEd = [d.lieu, d.editeur].filter(Boolean).map(E).join(' : ');
    const out = {};

    // APA 7e édition
    const apaAut = A.length ? liste(A.map(a => a.prenom ? `${E(a.nom)}, ${initiales(a.prenom)}` : E(a.nom)), ', ', A.length > 2 ? ', & ' : ' & ') : '';
    const apaAn = `(${d.annee || 's. d.'})`;
    out['APA 7'] = A.length
      ? `${point(apaAut)} ${apaAn}. ${T}${ed}.${d.editeur ? ' ' + point(E(d.editeur)) : ''}${disponible}`
      : `${T}${ed}. ${apaAn}.${d.editeur ? ' ' + point(E(d.editeur)) : ''}${disponible}`;

    // MLA 9e édition
    const mlaAut = A.length === 1 ? nomInv(A[0]) : A.length === 2 ? `${nomInv(A[0])} et ${nomDir(A[1])}` : A.length ? `${nomInv(A[0])} et al` : '';
    out['MLA 9'] = `${mlaAut ? point(E(mlaAut)) + ' ' : ''}${T}.${d.edition ? ' ' + E(d.edition) + ',' : ''}${[d.editeur, d.annee].filter(Boolean).length ? ' ' + [d.editeur, d.annee].filter(Boolean).map(E).join(', ') + '.' : ''}${d.numerique ? ` <i>${BIBLIO}</i>, ${E(d.url)}. Consulté le ${E(d.consulte)}.` : ''}`;

    // Chicago 17e (bibliographie)
    const chiAut = A.length ? liste(A.map((a, i) => E(i === 0 ? nomInv(a) : nomDir(a))), ', ', ' et ') : '';
    out['Chicago'] = `${chiAut ? point(chiAut) + ' ' : ''}${T}.${d.edition ? ' ' + point(E(d.edition)) : ''}${lieuEd || d.annee ? ' ' + [lieuEd, E(d.annee)].filter(Boolean).join(', ') + '.' : ''}${d.numerique ? ` ${E(d.url)}.` : ''}`;

    // ISO 690 (norme française / internationale)
    const isoAut = A.length ? liste(A.map(a => `${E(a.collectif ? a.nom : a.nom.toUpperCase())}${a.prenom ? ', ' + E(a.prenom) : ''}`), ', ', ' et ') + '. ' : '';
    out['ISO 690'] = `${isoAut}${T}${d.numerique ? ' [en ligne]' : ''}.${d.edition ? ' ' + point(E(d.edition)) : ''} ${E(d.lieu || '[s.l.]')} : ${E(d.editeur || '[s.n.]')}, ${E(d.annee || '[s.d.]')}.${d.isbn ? ' ISBN ' + E(d.isbn) + '.' : ''}${d.numerique ? ` Disponible sur : ${E(d.url)} (consulté le ${E(d.consulte)}).` : ''}`;

    // IEEE
    const ieeeAut = A.length ? liste(A.map(a => `${a.prenom ? initiales(a.prenom) + ' ' : ''}${E(a.nom)}`), ', ', ' et ') + ', ' : '';
    out['IEEE'] = `${ieeeAut}${point(T + (d.edition ? ', ' + E(d.edition) : ''))} ${[lieuEd, E(d.annee)].filter(Boolean).join(', ') || 's. d.'}.${d.numerique ? ` [En ligne]. Disponible : ${E(d.url)}` : ''}`;
    return out;
  }
  const texteBrut = html => { const t = document.createElement('div'); t.innerHTML = html; return t.textContent.replace(/\s+/g, ' ').trim(); };

  /* ---------- Exports ---------- */
  function bibtex(d, id) {
    const cle = ((d.auteurs[0]?.nom || 'anonyme').normalize('NFD').replace(/[^\w]/g, '') + (d.annee || '')).toLowerCase() || 'oasis' + id;
    const champs = [['author', d.auteurs.map(a => nomInv(a)).join(' and ')], ['title', d.titre], ['edition', d.edition], ['publisher', d.editeur], ['address', d.lieu], ['year', d.annee], ['isbn', d.isbn], ['url', d.numerique ? d.url : ''], ['urldate', d.numerique ? d.consulteIso : ''], ['note', d.source ? 'Source numérique : ' + d.source : '']].filter(([, v]) => v);
    return `@book{${cle},\n${champs.map(([k, v]) => `  ${k} = {${String(v).replace(/[{}]/g, '')}}`).join(',\n')}\n}\n`;
  }
  function ris(d) {
    return ['TY  - BOOK', ...d.auteurs.map(a => 'AU  - ' + nomInv(a)), 'TI  - ' + d.titre, d.edition && 'ET  - ' + d.edition, d.editeur && 'PB  - ' + d.editeur, d.lieu && 'CY  - ' + d.lieu, d.annee && 'PY  - ' + d.annee, d.isbn && 'SN  - ' + d.isbn, d.numerique && 'UR  - ' + d.url, d.numerique && 'Y2  - ' + d.consulteIso, d.source && 'N1  - Source numérique : ' + d.source, 'DB  - ' + BIBLIO, 'ER  - '].filter(Boolean).join('\r\n') + '\r\n';
  }
  function telecharger(nom, contenu, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenu], { type })); a.download = nom; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function copier(html, toast) {
    const txt = texteBrut(html);
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]);
      else await navigator.clipboard.writeText(txt);
      toast?.('Citation copiée — le titre reste en italique dans Word 📋');
    } catch { try { await navigator.clipboard.writeText(txt); toast?.('Citation copiée 📋'); } catch { toast?.('Copie impossible — sélectionnez le texte manuellement.'); } }
  }

  /* ---------- Fenêtre ---------- */
  function ouvrir(l, zone, fermer, toast) {
    const d = donnees(l), c = styles(d);
    const ligne = (lib, val, manque) => `<div class="cit-meta-ligne${val ? '' : ' manque'}"><dt>${lib}</dt><dd>${val ? E(val) : `<span>${manque}</span>`}</dd></div>`;
    const manques = [!d.auteurBrut && 'auteur', !d.editeur && 'éditeur', !d.annee && 'année', !d.lieu && 'lieu d’édition'].filter(Boolean);
    zone.innerHTML = `<div class="voile" id="voile"><div class="modale modale-citer" role="dialog" aria-modal="true" aria-labelledby="citTitre">
      <div class="modale-entete"><div style="flex:1"><small class="cit-surtitre">📑 Citer ce document</small><h3 id="citTitre">${E(l.titre)}</h3></div><button class="fermer" id="btnFermer" aria-label="Fermer">✕</button></div>
      <div class="corps">
        <dl class="cit-meta">
          ${ligne('Auteur', d.auteurBrut, 'Anonyme / non renseigné')}
          ${ligne('Éditeur', d.editeur, 'Éditeur d’origine non renseigné')}
          ${ligne('Lieu', d.lieu, 'Non renseigné')}
          ${ligne('Année', d.annee, 'Sans date')}
          ${d.edition ? ligne('Édition', d.edition) : ''}${d.isbn ? ligne('ISBN', d.isbn) : ''}
          ${d.source ? ligne('Source numérique', d.source) : ''}
          ${ligne('Format', d.type)}${d.langue ? ligne('Langue', d.langue) : ''}
        </dl>
        ${manques.length ? `<p class="cit-avertissement">⚠️ Information manquante : ${manques.join(', ')}. Les citations l’indiquent selon les normes (« s. d. », « [s.n.] »). Vérifiez la page de titre du document avant de citer dans un travail officiel.</p>` : ''}
        <div class="cit-styles">${Object.entries(c).map(([nom, html], i) => `<article class="cit-style">
          <header><b>${nom}</b><button class="mini-btn bleu" data-cit-copier="${i}">📋 Copier</button></header>
          <p>${html}</p></article>`).join('')}</div>
        <div class="cit-export"><span>Exporter vers Zotero, Mendeley, EndNote :</span>
          <button class="mini-btn" data-cit-export="bib">BibTeX (.bib)</button><button class="mini-btn" data-cit-export="ris">RIS (.ris)</button></div>
        ${d.numerique ? `<p class="cit-note">Consulté le ${E(d.consulte)} sur ${BIBLIO}.</p>` : ''}
      </div></div></div>`;
    const htmls = Object.values(c);
    zone.querySelectorAll('[data-cit-copier]').forEach(b => b.onclick = () => copier(htmls[+b.dataset.citCopier], toast));
    zone.querySelectorAll('[data-cit-export]').forEach(b => b.onclick = () => {
      const base = (d.titre || 'citation').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 50).toLowerCase() || 'citation';
      if (b.dataset.citExport === 'bib') telecharger(base + '.bib', bibtex(d, l.id), 'application/x-bibtex');
      else telecharger(base + '.ris', ris(d), 'application/x-research-info-systems');
    });
    zone.querySelector('#btnFermer').onclick = fermer;
    zone.querySelector('#voile').onclick = e => { if (e.target.id === 'voile') fermer(); };
  }
  return { ouvrir, styles, donnees, bibtex, ris, decouper };
})();
