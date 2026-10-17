/* OASIS — Administration des quiz de lecture */
window.OasisAdminQuiz = (() => {
  let api, donnees, edition = null, filtreCat = '', filtreNiv = '';
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const niv = n => donnees.niveaux.find(x => x.niveau === Number(n)) || donnees.niveaux[0];
  const vide = () => ({ titre: '', description: '', categorie: donnees.categories[0] || '', niveau: 1, livreId: '', seuil: 70, dureeMinutes: 0, tentativesMax: 0,
    melanger: true, afficherCorrection: true, publie: false, recompense: { badgeNom: '', badgeEmoji: '', points: '', joursOfferts: 0 },
    questions: [{ enonce: '', choix: ['', ''], bonne: 0, explication: '' }] });

  async function ouvrir(request) {
    api = request; donnees = await api('/admin-quiz');
    return `<div class="section-titre"><h3>🧠 Quiz de lecture</h3><button class="btn btn-bleu" id="quizNouveau">+ Nouveau quiz</button></div>
      <p>Créez des quiz par catégorie et par niveau. Dans une catégorie, chaque niveau se débloque quand le lecteur a réussi le niveau inférieur. Une réussite rapporte un badge, des points et, si vous le souhaitez, des jours d’accès offerts ; réussir les quatre niveaux donne le badge « Maître ».</p>
      <div class="stats">
        <div class="stat"><div class="libelle">Quiz</div><div class="valeur">${donnees.quiz.length}</div></div>
        <div class="stat"><div class="libelle">Publiés</div><div class="valeur">${donnees.quiz.filter(q => q.publie).length}</div></div>
        <div class="stat"><div class="libelle">Tentatives</div><div class="valeur">${donnees.quiz.reduce((s, q) => s + q.stats.tentatives, 0)}</div></div>
        <div class="stat"><div class="libelle">Badges remis</div><div class="valeur">${donnees.badgesDistribues}</div></div>
      </div>
      <div id="quizZone"></div>`;
  }

  function liste() {
    const quiz = donnees.quiz.filter(q => (!filtreCat || q.categorie === filtreCat) && (!filtreNiv || q.niveau === Number(filtreNiv)))
      .sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr') || a.niveau - b.niveau || a.titre.localeCompare(b.titre, 'fr'));
    $('quizZone').innerHTML = `<div class="abo-admin-filtres">
        <div class="champ"><label for="quizFiltreCat">Catégorie</label><select id="quizFiltreCat"><option value="">Toutes</option>${[...new Set(donnees.quiz.map(q => q.categorie))].sort().map(c => `<option ${c === filtreCat ? 'selected' : ''}>${E(c)}</option>`).join('')}</select></div>
        <div class="champ"><label for="quizFiltreNiv">Niveau</label><select id="quizFiltreNiv"><option value="">Tous</option>${donnees.niveaux.map(n => `<option value="${n.niveau}" ${String(n.niveau) === filtreNiv ? 'selected' : ''}>${n.emoji} ${E(n.nom)}</option>`).join('')}</select></div>
      </div>
      ${quiz.length ? `<div class="catalogue-table-scroll"><table><thead><tr><th>Quiz</th><th>Catégorie</th><th>Niveau</th><th>Questions</th><th>Récompense</th><th>Résultats</th><th>Publication</th><th></th></tr></thead><tbody>
      ${quiz.map(q => `<tr><td><b>${E(q.titre)}</b>${q.livreId ? `<br><small>📖 ${E(donnees.livres.find(l => l.id === q.livreId)?.titre || 'Livre retiré')}</small>` : ''}</td>
        <td>${E(q.categorie)}</td><td>${niv(q.niveau).emoji} ${E(niv(q.niveau).nom)}</td><td>${q.questions.length}${q.dureeMinutes ? ` · ⏱️ ${q.dureeMinutes} min` : ''}</td>
        <td>${E(q.recompense.badgeEmoji)} ${E(q.recompense.badgeNom)}<br><small>+${q.recompense.points} pts${q.recompense.joursOfferts ? ' · ' + q.recompense.joursOfferts + ' j offerts' : ''}</small></td>
        <td><small>${q.stats.tentatives} tentative(s) · ${q.stats.lecteurs} lecteur(s)<br>${q.stats.tentatives ? `${Math.round(q.stats.reussites / q.stats.tentatives * 100)} % de réussite · moyenne ${q.stats.moyenne} %` : '—'}</small></td>
        <td><button class="mini-btn ${q.publie ? 'bleu' : ''}" data-quiz-publier="${E(q.id)}" aria-pressed="${q.publie}">${q.publie ? '✅ Publié' : 'Brouillon'}</button></td>
        <td style="white-space:nowrap"><button class="mini-btn" data-quiz-modifier="${E(q.id)}">✏️ Modifier</button> <button class="mini-btn" data-quiz-dupliquer="${E(q.id)}">⧉</button> <button class="mini-btn rouge" data-quiz-supprimer="${E(q.id)}">🗑</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vide">Aucun quiz. Créez le premier avec « + Nouveau quiz ».</p>'}`;
    $('quizFiltreCat').oninput = e => { filtreCat = e.target.value; liste(); };
    $('quizFiltreNiv').oninput = e => { filtreNiv = e.target.value; liste(); };
  }

  /* ---------- Éditeur ---------- */
  function editeur() {
    const q = edition.quiz, r = q.recompense, info = niv(q.niveau);
    const cats = donnees.categories.includes(q.categorie) || !q.categorie ? donnees.categories : [q.categorie, ...donnees.categories];
    $('quizZone').innerHTML = `<form id="quizForm" class="panneau quiz-editeur" novalidate>
      <h4>${edition.id ? 'Modifier le quiz' : 'Nouveau quiz'}</h4>
      <div class="quiz-ed-grille">
        <div class="champ large"><label for="qTitre">Titre *</label><input id="qTitre" data-q="titre" maxlength="160" value="${E(q.titre)}" required></div>
        <div class="champ large"><label for="qDesc">Description</label><textarea id="qDesc" data-q="description" rows="2" maxlength="600">${E(q.description)}</textarea></div>
        <div class="champ"><label for="qCat">Catégorie *</label><select id="qCat" data-q="categorie">${cats.map(c => `<option ${c === q.categorie ? 'selected' : ''}>${E(c)}</option>`).join('')}</select></div>
        <div class="champ"><label for="qNiv">Niveau *</label><select id="qNiv" data-q="niveau" data-num>${donnees.niveaux.map(n => `<option value="${n.niveau}" ${n.niveau === Number(q.niveau) ? 'selected' : ''}>${n.emoji} ${n.niveau} — ${E(n.nom)}</option>`).join('')}</select></div>
        <div class="champ"><label for="qLivre">Livre associé (facultatif)</label><select id="qLivre" data-q="livreId"><option value="">— Aucun —</option>${donnees.livres.map(l => `<option value="${E(l.id)}" ${l.id === q.livreId ? 'selected' : ''}>${E(l.titre)}${l.categorie ? ' · ' + E(l.categorie) : ''}</option>`).join('')}</select></div>
        <div class="champ"><label for="qSeuil">Seuil de réussite (%)</label><input id="qSeuil" data-q="seuil" data-num type="number" min="50" max="100" value="${q.seuil}"></div>
        <div class="champ"><label for="qDuree">Durée (min, 0 = libre)</label><input id="qDuree" data-q="dureeMinutes" data-num type="number" min="0" max="180" value="${q.dureeMinutes}"></div>
        <div class="champ"><label for="qTent">Tentatives max (0 = illimité)</label><input id="qTent" data-q="tentativesMax" data-num type="number" min="0" max="50" value="${q.tentativesMax}"></div>
      </div>
      <div class="quiz-ed-cases">
        <label class="don-case"><input type="checkbox" data-q="melanger" ${q.melanger ? 'checked' : ''}> Mélanger questions et réponses</label>
        <label class="don-case"><input type="checkbox" data-q="afficherCorrection" ${q.afficherCorrection ? 'checked' : ''}> Montrer la correction après soumission</label>
        <label class="don-case"><input type="checkbox" data-q="publie" ${q.publie ? 'checked' : ''}> Publier pour les lecteurs</label>
      </div>
      <fieldset class="quiz-ed-recompense"><legend>Récompense à la première réussite</legend>
        <div class="quiz-ed-grille">
          <div class="champ"><label for="qBadge">Nom du badge</label><input id="qBadge" data-r="badgeNom" maxlength="80" placeholder="${E(info.badge + ' · ' + (q.categorie || 'catégorie'))}" value="${E(r.badgeNom)}"></div>
          <div class="champ"><label for="qEmoji">Emoji du badge</label><input id="qEmoji" data-r="badgeEmoji" maxlength="8" placeholder="${info.emoji}" value="${E(r.badgeEmoji)}"></div>
          <div class="champ"><label for="qPoints">Points</label><input id="qPoints" data-r="points" data-num type="number" min="0" max="1000" placeholder="${info.points}" value="${E(r.points)}"></div>
          <div class="champ"><label for="qJours">Jours d’accès complet offerts</label><input id="qJours" data-r="joursOfferts" data-num type="number" min="0" max="90" value="${E(r.joursOfferts)}"></div>
        </div></fieldset>
      <h4 style="margin-top:14px">Questions (${q.questions.length})</h4>
      <div id="qQuestions">${q.questions.map((x, i) => `<fieldset class="quiz-ed-question ${x.brouillonIA ? 'brouillon-ia' : ''}" data-i="${i}"><legend>Question ${i + 1}${x.brouillonIA ? ' · ✨ brouillon IA à relire' : ''}</legend>
        <div class="champ"><label for="qE${i}">Énoncé *</label><textarea id="qE${i}" data-qe="enonce" rows="2" maxlength="500">${E(x.enonce)}</textarea></div>
        <p class="quiz-ed-aide">Cochez la bonne réponse.</p>
        ${x.choix.map((c, k) => `<div class="quiz-ed-choix"><input type="radio" name="bonne${i}" value="${k}" ${x.bonne === k ? 'checked' : ''} data-bonne="${k}" aria-label="Réponse ${k + 1} correcte">
          <input data-choix="${k}" maxlength="200" value="${E(c)}" placeholder="Réponse ${k + 1}" aria-label="Réponse ${k + 1}">
          ${x.choix.length > 2 ? `<button type="button" class="mini-btn" data-retirer-choix="${k}" aria-label="Retirer la réponse ${k + 1}">✕</button>` : ''}</div>`).join('')}
        ${x.choix.length < 6 ? '<button type="button" class="mini-btn" data-ajouter-choix>+ Réponse</button>' : ''}
        <div class="champ" style="margin-top:10px"><label for="qX${i}">Explication (montrée à la correction)</label><input id="qX${i}" data-qe="explication" maxlength="500" value="${E(x.explication)}"></div>
        <div class="rangee-boutons"><button type="button" class="mini-btn" data-monter ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="mini-btn" data-descendre ${i === q.questions.length - 1 ? 'disabled' : ''}>↓</button>${q.questions.length > 1 ? '<button type="button" class="mini-btn rouge" data-retirer-question>Supprimer la question</button>' : ''}</div>
      </fieldset>`).join('')}</div>
      <button type="button" class="btn" id="qAjouter" ${q.questions.length >= 50 ? 'disabled' : ''}>+ Ajouter une question</button>
      <details class="quiz-ed-import"><summary>Importer des questions en texte</summary>
        <p>Une question par bloc séparé d’une ligne vide. Première ligne : l’énoncé. Lignes suivantes : les réponses, la bonne précédée de <code>*</code>. Ligne facultative commençant par <code>?</code> : l’explication.</p>
        <textarea id="qImport" rows="6" placeholder="Qui a écrit Gouverneurs de la Rosée ?&#10;*Jacques Roumain&#10;Jacques Stephen Alexis&#10;Frankétienne&#10;? Roman publié en 1944."></textarea>
        <button type="button" class="mini-btn bleu" id="qImporter">Ajouter ces questions</button></details>
      <details class="quiz-ed-import quiz-ed-ia"><summary>✨ Générer des questions avec OASIS IA</summary>
        <p>L’IA rédige des questions à partir du <b>livre associé</b> choisi plus haut, au niveau du quiz. Elles arrivent en brouillon : relisez chaque énoncé et la bonne réponse avant de publier. Le livre doit être ouvert à l’IA (onglet OASIS IA).</p>
        <div class="quiz-ed-grille"><div class="champ"><label for="qIaDe">De la page / du chapitre</label><input id="qIaDe" type="number" min="1" value="1"></div>
          <div class="champ"><label for="qIaA">À</label><input id="qIaA" type="number" min="1" value="10"></div>
          <div class="champ"><label for="qIaNb">Nombre de questions</label><input id="qIaNb" type="number" min="1" max="15" value="5"></div></div>
        <button type="button" class="mini-btn bleu" id="qGenerer">✨ Générer le brouillon</button></details>
      <div id="qMsg" role="status" aria-live="polite"></div>
      <div class="rangee-boutons"><button class="btn btn-bleu">Enregistrer le quiz</button><button type="button" class="btn" id="qAnnuler">Annuler</button></div>
    </form>`;
  }

  /** Lit le formulaire dans edition.quiz (sans re-rendu). */
  function lire() {
    const f = $('quizForm'); if (!f) return;
    const q = edition.quiz;
    f.querySelectorAll('[data-q]').forEach(el => { q[el.dataset.q] = el.type === 'checkbox' ? el.checked : el.hasAttribute('data-num') ? Number(el.value || 0) : el.value; });
    f.querySelectorAll('[data-r]').forEach(el => { q.recompense[el.dataset.r] = el.hasAttribute('data-num') ? (el.value === '' ? '' : Number(el.value)) : el.value; });
    f.querySelectorAll('.quiz-ed-question').forEach(fs => {
      const x = q.questions[Number(fs.dataset.i)];
      fs.querySelectorAll('[data-qe]').forEach(el => x[el.dataset.qe] = el.value);
      fs.querySelectorAll('[data-choix]').forEach(el => x.choix[Number(el.dataset.choix)] = el.value);
      const coche = fs.querySelector('[data-bonne]:checked'); x.bonne = coche ? Number(coche.value) : -1;
    });
  }

  function importer(texteBrut) {
    const blocs = texteBrut.split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length >= 3);
    return blocs.map(b => {
      const explication = (b.find(l => l.startsWith('?')) || '').slice(1).trim();
      const reponses = b.slice(1).filter(l => !l.startsWith('?')).slice(0, 6);
      const bonne = Math.max(0, reponses.findIndex(l => l.startsWith('*')));
      return { enonce: b[0], choix: reponses.map(l => l.replace(/^\*\s*/, '')), bonne, explication };
    });
  }

  function brancher() {
    if (!$('quizZone')) return;
    $('quizNouveau').onclick = () => { edition = { id: null, quiz: vide() }; editeur(); };
    liste();
    $('quizZone').addEventListener('click', async e => {
      const t = s => e.target.closest(s);
      let el;
      try {
        if ((el = t('[data-quiz-modifier]')) || (el = t('[data-quiz-dupliquer]'))) {
          const src = donnees.quiz.find(q => q.id === (el.dataset.quizModifier || el.dataset.quizDupliquer));
          const copie = JSON.parse(JSON.stringify(src)); delete copie.stats;
          if (el.dataset.quizDupliquer) { copie.titre += ' (copie)'; copie.publie = false; copie.questions.forEach(x => delete x.id); }
          edition = { id: el.dataset.quizModifier || null, quiz: { ...copie, livreId: copie.livreId || '' } }; editeur(); $('quizZone').scrollIntoView({ block: 'start' }); return;
        }
        if ((el = t('[data-quiz-publier]'))) {
          const q = donnees.quiz.find(x => x.id === el.dataset.quizPublier);
          await api('/admin-quiz/' + encodeURIComponent(q.id), { method: 'PUT', body: JSON.stringify({ publie: !q.publie }) });
          q.publie = !q.publie; liste(); return;
        }
        if ((el = t('[data-quiz-supprimer]'))) {
          const q = donnees.quiz.find(x => x.id === el.dataset.quizSupprimer);
          if (!confirm(`Supprimer « ${q.titre} » ? Les badges déjà obtenus par les lecteurs sont conservés.`)) return;
          await api('/admin-quiz/' + encodeURIComponent(q.id), { method: 'DELETE' });
          donnees = await api('/admin-quiz'); liste(); return;
        }
        if (!edition || !$('quizForm')) return;
        const fs = e.target.closest('.quiz-ed-question'), i = fs ? Number(fs.dataset.i) : -1, qs = edition.quiz.questions;
        if (t('#qAnnuler')) { edition = null; liste(); return; }
        if (t('#qAjouter')) { lire(); qs.push({ enonce: '', choix: ['', ''], bonne: 0, explication: '' }); editeur(); $('qE' + (qs.length - 1))?.focus(); return; }
        if (t('#qImporter')) { lire(); const n = importer($('qImport').value); if (!n.length) { $('qMsg').innerHTML = '<div class="erreur">Aucune question reconnue : énoncé puis au moins deux réponses.</div>'; return; }
          edition.quiz.questions = [...qs.filter(x => x.enonce.trim()), ...n].slice(0, 50); editeur(); $('qMsg').innerHTML = `<div class="succes">${n.length} question(s) ajoutée(s). Vérifiez les bonnes réponses.</div>`; return; }
        if (t('#qGenerer')) {
          lire(); const q = edition.quiz, msg = $('qMsg'), b = $('qGenerer');
          if (!q.livreId) { msg.innerHTML = '<div class="erreur">Choisissez d’abord le livre associé.</div>'; return; }
          b.disabled = true; msg.innerHTML = '<div class="succes">✨ Rédaction des questions en cours… (quelques secondes)</div>';
          try {
            const r = await api('/admin-ia/quiz', { method: 'POST', body: JSON.stringify({ livreId: q.livreId, niveau: q.niveau, de: Number($('qIaDe').value), a: Number($('qIaA').value), nombre: Number($('qIaNb').value) }) });
            edition.quiz.questions = [...q.questions.filter(x => x.enonce.trim()), ...r.questions].slice(0, 50); editeur();
            $('qMsg').innerHTML = `<div class="succes">${r.questions.length} question(s) ajoutée(s) depuis les ${E(r.unite)}s ${r.de} à ${r.a}. ${E(r.avertissement)}</div>`;
          } catch (err) { $('qMsg').innerHTML = `<div class="erreur">${E(err.message)}</div>`; b.disabled = false; }
          return;
        }
        if (t('[data-ajouter-choix]')) { lire(); qs[i].choix.push(''); editeur(); return; }
        if ((el = t('[data-retirer-choix]'))) { lire(); const k = Number(el.dataset.retirerChoix); qs[i].choix.splice(k, 1); if (qs[i].bonne === k) qs[i].bonne = 0; else if (qs[i].bonne > k) qs[i].bonne--; editeur(); return; }
        if (t('[data-retirer-question]')) { lire(); qs.splice(i, 1); editeur(); return; }
        if (t('[data-monter]') || t('[data-descendre]')) { lire(); const j = t('[data-monter]') ? i - 1 : i + 1; [qs[i], qs[j]] = [qs[j], qs[i]]; editeur(); return; }
      } catch (err) { alert(err.message); }
    });
    $('quizZone').addEventListener('submit', async e => {
      if (e.target.id !== 'quizForm') return;
      e.preventDefault(); lire();
      const q = edition.quiz, msg = $('qMsg');
      const mauvaise = q.questions.findIndex(x => x.bonne < 0 || !String(x.choix[x.bonne] || '').trim());
      if (mauvaise >= 0) { msg.innerHTML = `<div class="erreur">Question ${mauvaise + 1} : cochez une bonne réponse non vide.</div>`; return; }
      const corps = { ...q, livreId: q.livreId || null, questions: q.questions.map(x => {
        const choix = x.choix.map(c => c.trim()); const bonneTexte = choix[x.bonne]; const gardes = choix.filter(Boolean);
        return { id: x.id, enonce: x.enonce, choix: gardes, bonne: gardes.indexOf(bonneTexte), explication: x.explication };
      }), recompense: { ...q.recompense, points: q.recompense.points === '' ? undefined : q.recompense.points } };
      delete corps.id; delete corps.creeLe; delete corps.modifieLe; delete corps.auteurId;
      const bouton = e.target.querySelector('.btn-bleu'); bouton.disabled = true;
      try {
        await api('/admin-quiz' + (edition.id ? '/' + encodeURIComponent(edition.id) : ''), { method: edition.id ? 'PUT' : 'POST', body: JSON.stringify(corps) });
        edition = null; donnees = await api('/admin-quiz'); liste();
        document.querySelectorAll('.toast').forEach(t => t.remove());
        const t = document.createElement('div'); t.className = 'toast'; t.textContent = 'Quiz enregistré.'; document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
      } catch (err) { msg.innerHTML = `<div class="erreur">${E(err.message)}</div>`; bouton.disabled = false; }
    });
  }
  return { ouvrir, brancher };
})();
