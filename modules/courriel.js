'use strict';
/* OASIS — envoi des emails (1.24.0)
   Les emails partent par l'API HTTP de Brevo (les ports SMTP sont souvent bloqués sur Render).
   Variables Render : BREVO_API_KEY, BREVO_SENDER_EMAIL (adresse validée dans Brevo), SITE_URL (facultatif).
   OASIS_EMAIL_JOURNAL=1 : mode test, l'email est écrit dans le journal du serveur au lieu d'être envoyé. */

const actif = (env = process.env) => env.OASIS_EMAIL_JOURNAL === '1' || !!(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
const siteUrl = (env = process.env) => (env.SITE_URL || 'https://oasis-centre-num-rique-d-apprentissage.onrender.com').replace(/\/+$/, '');
const echap = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function envoyer({ a, nom, sujet, texte, html }, env = process.env, transport = fetch) {
  if (env.OASIS_EMAIL_JOURNAL === '1') { console.log('EMAIL_TEST:' + JSON.stringify({ a, sujet, texte })); return { ok: true, test: true }; }
  if (!actif(env)) return { ok: false, erreur: 'Envoi d’emails non configuré.' };
  const r = await transport('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { email: env.BREVO_SENDER_EMAIL, name: 'OASIS Bibliothèque Numérique' }, to: [{ email: a, name: nom || '' }], subject: sujet, textContent: texte, htmlContent: html })
  });
  if (!r.ok) return { ok: false, erreur: 'Brevo a répondu ' + r.status };
  return { ok: true };
}

function confirmation(utilisateur, jeton, env = process.env) {
  const lien = siteUrl(env) + '/api/confirmer-email?jeton=' + encodeURIComponent(jeton);
  const texte = `Bonjour ${utilisateur.nom},\n\nMerci pour votre inscription à OASIS Bibliothèque Numérique.\nPour activer votre compte, ouvrez ce lien dans les 48 heures :\n${lien}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.\n\nOASIS Bibliothèque Numérique — Haïti`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10243e">
    <div style="background:linear-gradient(135deg,#06152f,#123f85);color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:22px;font-weight:800;letter-spacing:3px">OASIS</div>
      <div style="color:#ffc76b;font-weight:700;font-size:13px">Bibliothèque numérique intelligente</div></div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 14px 14px">
      <p>Bonjour ${echap(utilisateur.nom)},</p>
      <p>Merci pour votre inscription à <b>OASIS Bibliothèque Numérique</b>. Confirmez votre adresse email pour activer votre compte :</p>
      <p style="text-align:center;margin:26px 0"><a href="${echap(lien)}" style="background:#ff920c;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;display:inline-block">Activer mon compte</a></p>
      <p style="font-size:13px;color:#5b6b82">Ce lien est valable 48 heures. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br>${echap(lien)}</p>
      <p style="font-size:13px;color:#5b6b82">Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.</p></div></div>`;
  return { a: utilisateur.email, nom: utilisateur.nom, sujet: 'Activez votre compte OASIS', texte, html };
}

module.exports = { actif, envoyer, confirmation, siteUrl };
