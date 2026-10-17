/* OASIS — Quiz de lecture (portail lecteur) */
window.OasisQuiz = (() => {
  let api, moi, session = null, minuteur = null, onglet = 'quiz';
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zone = () => document.getElementById('zonePrincipale');
  const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const LETTRES = 'ABCDEF';

  const ongletsHTML = () => `<div class="quiz-onglets" role="tablist">
    ${[['quiz', '🧠 Quiz'], ['recompenses', '🏅 Mes récompenses'], ['classement', '🥇 Classement']].map(([k, v]) =>
      `<button role="tab" aria-selected="${onglet === k}" class="${onglet === k ? 'actif' : ''}" data-quiz-onglet="${k}">${v}</button>`).join('')}</div>`;

  function enteteProfil(p) {
    const r = p.rang, suivant = r.prochain;
    const pct = suivant ? Math.round((p.points - r.min) / (suivant.min - r.min) * 100) : 100;
    return `<div class="quiz-hero">
      <div><span class="surtitre">QUIZ DE LECTURE</span><h2>Lisez, testez-vous, gagnez des badges</h2>
      <p>Chaque catégorie compte quatre niveaux. Réussissez un quiz pour débloquer le niveau suivant et remporter badges, points et récompenses.</p></div>
      <div class="quiz-rang"><span class="quiz-rang-emoji">${r.emoji}</span><div><b>${E(r.nom)}</b><small>${p.points} point${p.points > 1 ? 's' : ''} · ${p.badges} badge${p.badges > 1 ? 's' : ''}</small>
      <div class="quiz-barre"><span style="width:${pct}%"></span></div><small>${suivant ? `${suivant.min - p.points} points avant « ${E(suivant.nom)} »` : 'Rang maximal atteint'}</small></div></div>
    </div>`;
  }

  function carteQuiz(q) {
    const r = q.recompense;
    const etat = q.reussi ? '<span class="quiz-etat ok">✅ Réussi</span>' : q.verrou ? '<span class="quiz-etat verrou">🔒 Verrouillé</span>' : '';
    const epuise = q.tentativesRestantes === 0;
    return `<article class="quiz-carte ${q.verrou ? 'verrouille' : ''}">
      <header><h4>${E(q.titre)}</h4>${etat}</header>
      ${q.description ? `<p>${E(q.description)}</p>` : ''}
      ${q.livre ? `<button class="quiz-livre" data-livre="${E(q.livre.id)}">📖 ${E(q.livre.titre)}</button>` : ''}
      <ul class="quiz-meta"><li>${q.nbQuestions} question${q.nbQuestions > 1 ? 's' : ''}</li><li>${q.dureeMinutes ? '⏱️ ' + q.dureeMinutes + ' min' : 'Sans chrono'}</li><li>Réussite : ${q.seuil} %</li>
        ${q.meilleur !== null ? `<li>Meilleur : ${q.meilleur} %</li>` : ''}${q.tentativesRestantes !== null ? `<li>${q.tentativesRestantes} essai${q.tentativesRestantes > 1 ? 's' : ''} restant${q.tentativesRestantes > 1 ? 's' : ''}</li>` : ''}</ul>
      <div class="quiz-gain"><span class="quiz-badge-mini">${E(r.badgeEmoji)}</span><div><b>${E(r.badgeNom)}</b><small>+${r.points} points${r.joursOfferts ? ` · ${r.joursOfferts} jour${r.joursOfferts > 1 ? 's' : ''} d’accès offert${r.joursOfferts > 1 ? 's' : ''}` : ''}</small></div></div>
      ${q.verrou ? `<p class="quiz-raison">${E(q.verrou)}</p>` : epuise ? '<p class="quiz-raison">Toutes vos tentatives ont été utilisées.</p>'
        : `<button class="btn ${q.reussi ? '' : 'btn-bleu'}" data-quiz-commencer="${E(q.id)}">${q.reussi ? 'Rejouer' : q.tentatives ? 'Réessayer' : 'Commencer'}</button>`}
    </article>`;
  }

  async function vueCatalogue() {
    const d = await api('/quiz');
    if (!d.categories.length) return enteteProfil(d.profil) + ongletsHTML() + '<p class="vide">Aucun quiz n’est encore publié. Revenez bientôt !</p>';
    return enteteProfil(d.profil) + ongletsHTML() + d.categories.map(c => `<section class="quiz-categorie">
      <div class="section-titre"><h3>${E(c.nom)}</h3>${c.maitrise ? '<span class="quiz-maitrise">👑 Maîtrise obtenue</span>' : ''}</div>
      <ol class="quiz-paliers" aria-label="Niveaux de ${E(c.nom)}">${c.niveaux.map(n => `<li class="${n.reussi ? 'reussi' : ''}"><span>${n.emoji}</span>${E(n.nom)}</li>`).join('')}</ol>
      ${c.niveaux.map(n => `<div class="quiz-niveau"><h4 class="quiz-niveau-titre">${n.emoji} Niveau ${n.niveau} — ${E(n.nom)}</h4>
        <div class="quiz-grille">${n.quiz.map(carteQuiz).join('')}</div></div>`).join('')}
    </section>`).join('');
  }

  async function vueRecompenses() {
    const d = await api('/quiz/recompenses');
    const p = { points: d.points, rang: d.rang, badges: d.badges.length };
    const acces = d.accesOffertFin && new Date(d.accesOffertFin) > new Date();
    return enteteProfil(p) + ongletsHTML() + `
      ${acces ? `<div class="succes">🎁 Accès complet offert grâce à vos quiz jusqu’au ${E(dateFr(d.accesOffertFin))}.</div>` : ''}
      <div class="section-titre"><h3>Rangs de lecteur</h3></div>
      <ol class="quiz-rangs">${d.rangs.map(r => `<li class="${d.points >= r.min ? 'atteint' : ''}"><span>${r.emoji}</span><b>${E(r.nom)}</b><small>${r.min} pts</small></li>`).join('')}</ol>
      <div class="section-titre"><h3>Mes badges (${d.badges.length})</h3></div>
      ${d.badges.length ? `<div class="quiz-badges">${d.badges.map(b => `<div class="carte-badge obtenu quiz-badge">
        <span class="embleme">${E(b.emoji)}</span><div><b>${E(b.nom)}</b><br><small>${b.type === 'maitrise' ? 'Les 4 niveaux réussis' : E(b.quizTitre || '')} · +${b.points} pts<br>${E(dateFr(b.date))}</small>
        <br><button class="mini-btn" data-quiz-attestation="${E(b.id)}">📜 Attestation</button></div></div>`).join('')}</div>`
        : '<p class="vide">Réussissez votre premier quiz pour obtenir un badge.</p>'}`;
  }

  async function vueClassement() {
    const [l, d] = await Promise.all([api('/quiz/classement'), api('/quiz/recompenses')]);
    return enteteProfil({ points: d.points, rang: d.rang, badges: d.badges.length }) + ongletsHTML() + `<div class="section-titre"><h3>🥇 Meilleurs lecteurs aux quiz</h3></div>
      ${l.length ? `<table><thead><tr><th>#</th><th>Lecteur</th><th>Points</th><th>Badges</th></tr></thead><tbody>${l.map((u, i) => `<tr ${u.moi ? 'style="background:var(--bleu-clair)"' : ''}>
        <td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><b>${E(u.nom)}</b>${u.moi ? ' (vous)' : ''}</td><td>${u.points}</td><td>${u.badges}</td></tr>`).join('')}</tbody></table>` : '<p class="vide">Personne n’a encore marqué de points.</p>'}`;
  }

  async function render(request, user) {
    api = request; moi = user; arreter();
    session = null;
    return onglet === 'recompenses' ? vueRecompenses() : onglet === 'classement' ? vueClassement() : vueCatalogue();
  }
  const arreter = () => { clearInterval(minuteur); minuteur = null; };

  /* ---------- Passage d'un quiz ---------- */
  async function commencer(id) {
    const t = await api('/quiz/' + encodeURIComponent(id) + '/commencer', { method: 'POST' });
    session = { ...t, index: 0, reponses: {} };
    afficherQuestion();
    if (t.finPrevue) { arreter(); minuteur = setInterval(tic, 1000); tic(); }
  }
  function tic() {
    if (!session?.finPrevue) return;
    const reste = Math.max(0, Math.round((new Date(session.finPrevue) - Date.now()) / 1000));
    const el = document.getElementById('quizChrono');
    if (el) { el.textContent = `⏱️ ${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`; el.classList.toggle('urgent', reste <= 30); }
    if (reste === 0) { arreter(); soumettre(true); }
  }
  function afficherQuestion() {
    const s = session, q = s.questions[s.index], n = s.questions.length;
    const repondues = Object.keys(s.reponses).length;
    zone().innerHTML = `<div class="quiz-passage">
      <div class="quiz-passage-tete"><button class="mini-btn" data-quiz-quitter>← Quitter</button><b>${E(s.titre)}</b>${s.finPrevue ? '<span id="quizChrono" class="quiz-chrono" aria-live="off"></span>' : ''}</div>
      <div class="quiz-progression" aria-label="Question ${s.index + 1} sur ${n}"><span style="width:${(s.index + 1) / n * 100}%"></span></div>
      <p class="quiz-compteur">Question ${s.index + 1} / ${n} · ${repondues} réponse${repondues > 1 ? 's' : ''} donnée${repondues > 1 ? 's' : ''}</p>
      <fieldset class="quiz-question"><legend>${E(q.enonce)}</legend>
        ${q.choix.map((c, i) => `<label class="quiz-choix ${s.reponses[q.id] === i ? 'choisi' : ''}"><input type="radio" name="quizChoix" value="${i}" ${s.reponses[q.id] === i ? 'checked' : ''} data-quiz-choix="${i}"><span class="lettre">${LETTRES[i]}</span><span>${E(c)}</span></label>`).join('')}
      </fieldset>
      <nav class="quiz-points" aria-label="Aller à une question">${s.questions.map((x, i) => `<button class="${i === s.index ? 'courant' : ''} ${s.reponses[x.id] !== undefined ? 'fait' : ''}" data-quiz-aller="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`).join('')}</nav>
      <div class="quiz-actions">
        <button class="btn" data-quiz-aller="${s.index - 1}" ${s.index === 0 ? 'disabled' : ''}>← Précédente</button>
        ${s.index < n - 1 ? `<button class="btn btn-bleu" data-quiz-aller="${s.index + 1}">Suivante →</button>` : `<button class="btn btn-orange" data-quiz-soumettre>Valider mes réponses</button>`}
      </div></div>`;
    tic();
  }
  async function soumettre(auto) {
    const s = session; if (!s || s.envoi) return;
    const manquantes = s.questions.length - Object.keys(s.reponses).length;
    if (!auto && manquantes && !confirm(`${manquantes} question${manquantes > 1 ? 's' : ''} sans réponse. Valider quand même ?`)) return;
    s.envoi = true; arreter();
    try {
      const r = await api('/quiz/tentatives/' + encodeURIComponent(s.tentative) + '/soumettre', { method: 'POST', body: JSON.stringify({ reponses: s.reponses }) });
      session = null; resultat(r, auto);
    } catch (err) { s.envoi = false; alert(err.message); }
  }
  function resultat(r, auto) {
    const angle = Math.round(r.pourcentage * 3.6);
    zone().innerHTML = `<div class="quiz-resultat ${r.reussi ? 'reussi' : ''}">
      <div class="quiz-score" style="--angle:${angle}deg"><span>${r.pourcentage}%</span></div>
      <h2>${r.reussi ? 'Bravo, quiz réussi !' : r.horsDelai ? 'Temps écoulé' : 'Pas encore…'}</h2>
      <p>${r.bonnes} bonne${r.bonnes > 1 ? 's' : ''} réponse${r.bonnes > 1 ? 's' : ''} sur ${r.total} · seuil de réussite ${r.seuil} %${auto ? ' · validation automatique à la fin du temps' : ''}.</p>
      ${r.horsDelai ? '<p class="erreur">Vos réponses sont arrivées après la fin du temps imparti : la tentative ne peut pas être validée.</p>' : ''}
      ${r.recompenses.length ? `<div class="quiz-nouveaux">${r.recompenses.map(b => `<div class="quiz-nouveau"><span>${E(b.emoji)}</span><b>${E(b.nom)}</b><small>+${b.points} points${b.joursOfferts ? ` · ${b.joursOfferts} jour${b.joursOfferts > 1 ? 's' : ''} d’accès offert${b.joursOfferts > 1 ? 's' : ''}` : ''}</small></div>`).join('')}</div>` : ''}
      <p>Total : <b>${r.points} points</b>${r.tentativesRestantes !== null ? ` · ${r.tentativesRestantes} tentative${r.tentativesRestantes > 1 ? 's' : ''} restante${r.tentativesRestantes > 1 ? 's' : ''}` : ''}</p>
      <div class="rangee-boutons"><button class="btn btn-bleu" data-quiz-onglet="quiz">Retour aux quiz</button>${r.recompenses.length ? '<button class="btn" data-quiz-onglet="recompenses">Voir mes badges</button>' : ''}</div>
    </div>
    ${r.corrections ? `<div class="section-titre"><h3>Correction</h3></div><ol class="quiz-corrections">${r.corrections.map(c => `<li class="${c.juste ? 'juste' : 'faux'}">
      <b>${E(c.enonce)}</b>
      <p>${c.juste ? '✅' : '❌'} Votre réponse : ${c.votre === null ? '<i>aucune</i>' : E(c.choix[c.votre])}${c.juste ? '' : `<br>✔️ Bonne réponse : <b>${E(c.choix[c.bonne])}</b>`}</p>
      ${c.explication ? `<p class="quiz-explication">💡 ${E(c.explication)}</p>` : ''}</li>`).join('')}</ol>` : ''}`;
    zone().scrollIntoView({ block: 'start' });
  }

  async function attestation(id) {
    const d = await api('/quiz/recompenses');
    const b = d.badges.find(x => x.id === id); if (!b) return;
    const w = window.open('', '_blank'); if (!w) return alert('Autorisez les fenêtres pour afficher l’attestation.');
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Attestation — ${E(b.nom)}</title><style>
      @page{size:A4 landscape;margin:0}body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#10243e;background:#f5f1e6}
      .cadre{box-sizing:border-box;width:100%;min-height:100vh;padding:48px;display:flex;align-items:center;justify-content:center}
      .att{border:10px double #1e4fa3;background:#fff;padding:48px 64px;text-align:center;max-width:900px;width:100%}
      .emb{font-size:72px}h1{font-size:34px;margin:6px 0 4px;letter-spacing:1px}h2{font-size:30px;color:#1e4fa3;margin:18px 0}
      p{font-size:17px;line-height:1.6;margin:6px 0}small{color:#64748b;font-family:system-ui,sans-serif}
      button{margin-top:22px;padding:10px 18px;border-radius:8px;border:0;background:#1e4fa3;color:#fff;font-weight:700}@media print{button{display:none}}</style></head><body>
      <div class="cadre"><div class="att"><div class="emb">${E(b.emoji)}</div><small>OASIS · QUIZ DE LECTURE</small><h1>Attestation de réussite</h1>
      <p>Cette attestation est décernée à</p><h2>${E(d.nom)}</h2>
      <p>pour l’obtention du badge <b>« ${E(b.nom)} »</b></p>
      <p>${b.type === 'maitrise' ? `après avoir réussi les quatre niveaux de la catégorie <b>${E(b.categorie)}</b>` : `en réussissant le quiz <b>${E(b.quizTitre)}</b> — catégorie ${E(b.categorie)}, niveau ${b.niveau}`}.</p>
      <p><small>Délivrée le ${E(dateFr(b.date))} · n° ${E(b.id)}</small></p>
      <button onclick="print()">Imprimer / enregistrer en PDF</button></div></div></body></html>`);
    w.document.close();
  }

  document.addEventListener('click', async e => {
    const t = s => e.target.closest(s);
    let el;
    try {
      if ((el = t('[data-quiz-onglet]'))) { onglet = el.dataset.quizOnglet; arreter(); session = null; zone().innerHTML = await render(api, moi); return; }
      if ((el = t('[data-quiz-commencer]'))) { el.disabled = true; await commencer(el.dataset.quizCommencer); return; }
      if (!session && (el = t('[data-quiz-attestation]'))) { await attestation(el.dataset.quizAttestation); return; }
      if (!session) return;
      if ((el = t('[data-quiz-choix]'))) { session.reponses[session.questions[session.index].id] = Number(el.dataset.quizChoix); afficherQuestion(); return; }
      if ((el = t('[data-quiz-aller]'))) { const i = Number(el.dataset.quizAller); if (i >= 0 && i < session.questions.length) { session.index = i; afficherQuestion(); } return; }
      if (t('[data-quiz-soumettre]')) { await soumettre(false); return; }
      if (t('[data-quiz-quitter]')) { if (confirm('Quitter ce quiz ? Vos réponses ne seront pas enregistrées et cet essai ne sera pas compté.')) { arreter(); session = null; onglet = 'quiz'; zone().innerHTML = await render(api, moi); } }
    } catch (err) { if (el) el.disabled = false; alert(err.message); }
  });
  document.addEventListener('keydown', e => {
    if (!session || !document.querySelector('.quiz-passage') || e.target.matches('input[type=text],textarea')) return;
    const q = session.questions[session.index];
    const k = e.key.toUpperCase(), i = LETTRES.indexOf(k);
    if (i >= 0 && i < q.choix.length && k.length === 1) { session.reponses[q.id] = i; afficherQuestion(); }
    else if (e.key === 'ArrowRight' && session.index < session.questions.length - 1) { session.index++; afficherQuestion(); }
    else if (e.key === 'ArrowLeft' && session.index > 0) { session.index--; afficherQuestion(); }
  });

  return { render, arreter, quitter: () => { arreter(); session = null; } };
})();
