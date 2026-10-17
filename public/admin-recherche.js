/* OASIS — Administration de la recherche plein texte */
window.OasisAdminRecherche = (() => {
  let api, donnees, filtre = '', minuteur;
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const date = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const STATUTS = {
    indexe: ['✅ Indexé', 'ok'], en_attente: ['⏳ En attente', 'attente'], sans_texte: ['🖼️ Scanné — OCR nécessaire', 'alerte'],
    erreur: ['⚠️ Erreur', 'ko'], sans_fichier: ['— Pas de fichier numérique', 'neutre']
  };
  const FORMATS = { pdf: 'PDF', epub: 'EPUB', texte: 'Texte' };
  const csv = v => { let s = String(v ?? ''); if (/^\s*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

  async function ouvrir(request) {
    api = request; donnees = await api('/admin-recherche');
    return `<div class="section-titre"><h3>🔍 Recherche dans les livres</h3><button class="btn btn-bleu" id="rtToutReindexer">↻ Tout réindexer</button></div>
      <p>Le texte des PDF, EPUB et livres en texte intégré est extrait automatiquement à l’ajout ou au remplacement d’un fichier. Les lecteurs peuvent alors chercher un mot ou une expression dans le contenu, avec la page ou le chapitre exact.</p>
      <div class="stats" id="rtStats"></div>
      <div class="rt-admin-colonnes">
        <section><h4>Documents</h4>
          <div class="champ"><label for="rtFiltre">Afficher</label><select id="rtFiltre"><option value="">Tous les documents numériques</option>${Object.entries(STATUTS).map(([k, [v]]) => `<option value="${k}">${E(v)}</option>`).join('')}</select></div>
          <div id="rtDocuments"></div></section>
        <section><h4>Recherches sans aucun résultat</h4>
          <p class="rt-aide">Ces demandes n’ont rien trouvé, ni dans le catalogue ni dans le texte des livres : de bonnes pistes d’acquisition ou de mots-clés à ajouter.</p>
          <div class="rangee-boutons" style="margin:0 0 10px"><button class="mini-btn" id="rtCSV">Exporter CSV</button><button class="mini-btn rouge" id="rtEffacer">Effacer la liste</button></div>
          <div id="rtSansResultat"></div></section>
      </div>`;
  }

  function peindre() {
    const e = donnees.etat;
    $('rtStats').innerHTML = [['Documents indexés', e.indexes], ['En attente', e.enAttente], ['Scannés (OCR requis)', e.sansTexte], ['Erreurs', e.erreurs], ['Mots distincts', e.mots.toLocaleString('fr-FR')]]
      .map(([l, v]) => `<div class="stat"><div class="libelle">${E(l)}</div><div class="valeur ${l.startsWith('Erreur') && v ? 'alerte' : ''}">${E(v)}</div></div>`).join('');
    const docs = donnees.documents.filter(d => filtre ? d.statut === filtre : d.statut !== 'sans_fichier');
    $('rtDocuments').innerHTML = `<div class="catalogue-table-scroll"><table><thead><tr><th>Document</th><th>Format</th><th>État</th><th>Contenu</th><th></th></tr></thead><tbody>
      ${docs.map(d => { const [lib, cl] = STATUTS[d.statut]; return `<tr><td><b>${E(d.titre)}</b><br><small>${E(d.auteur || '')}</small></td><td>${E(FORMATS[d.format] || '—')}</td>
        <td><span class="rt-statut ${cl}">${E(lib)}</span>${d.erreur ? `<br><small>${E(d.erreur)}</small>` : ''}${d.statut === 'sans_texte' ? '<br><small>Ce PDF est une image : il faudra l’OCR pour le rendre cherchable.</small>' : ''}</td>
        <td><small>${d.nbPages ? `${d.nbPages} ${E(d.unite)}${d.nbPages > 1 ? 's' : ''}<br>${E(date(d.extraitLe))}` : '—'}</small></td>
        <td>${d.format ? `<button class="mini-btn" data-rt-reindexer="${E(d.id)}">↻</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="5">Aucun document.</td></tr>'}
      </tbody></table></div>`;
    $('rtSansResultat').innerHTML = donnees.sansResultat.length ? `<table><thead><tr><th>Recherche</th><th>Fois</th><th>Dernière</th></tr></thead><tbody>
      ${donnees.sansResultat.map(s => `<tr><td>${E(s.texte)}</td><td>${s.nb}</td><td><small>${E(date(s.dernier))}</small></td></tr>`).join('')}</tbody></table>`
      : '<p class="vide">Aucune recherche infructueuse relevée pour le moment.</p>';
    clearTimeout(minuteur);
    if (e.enAttente) minuteur = setTimeout(async () => { if (!$('rtStats')) return; try { donnees = await api('/admin-recherche'); peindre(); } catch {} }, 4000);
  }

  function brancher() {
    if (!$('rtStats')) return;
    peindre();
    $('rtFiltre').oninput = ev => { filtre = ev.target.value; peindre(); };
    const reindexer = async (id) => { donnees.etat = (await api('/admin-recherche/reindexer', { method: 'POST', body: JSON.stringify(id ? { id } : {}) })).etat; donnees = await api('/admin-recherche'); peindre(); };
    $('rtToutReindexer').onclick = async ev => { if (!confirm('Réextraire le texte de tous les documents ? Le traitement se fait en arrière-plan, un document à la fois.')) return; ev.target.disabled = true; try { await reindexer(); } catch (err) { alert(err.message); } finally { ev.target.disabled = false; } };
    $('rtDocuments').onclick = async ev => { const b = ev.target.closest('[data-rt-reindexer]'); if (!b) return; b.disabled = true; try { await reindexer(b.dataset.rtReindexer); } catch (err) { alert(err.message); } };
    $('rtEffacer').onclick = async () => { if (!confirm('Effacer la liste des recherches sans résultat ?')) return; await api('/admin-recherche/sans-resultat', { method: 'DELETE' }); donnees.sansResultat = []; peindre(); };
    $('rtCSV').onclick = () => {
      const lignes = [['Recherche', 'Nombre', 'Première', 'Dernière'], ...donnees.sansResultat.map(s => [s.texte, s.nb, s.premier, s.dernier])];
      const blob = new Blob(['﻿' + lignes.map(l => l.map(csv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'recherches-sans-resultat.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  return { ouvrir, brancher };
})();
