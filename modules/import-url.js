'use strict';
/* ============================================================
   OASIS — Import d'un document depuis une adresse web (1.15.0 ; cartes PNG/JPEG en 1.16.0)

   Le serveur télécharge lui-même un PDF ou un EPUB public (Gallica, Wikisource, ONU…),
   sans passer par l'ordinateur du bibliothécaire.
   Protections :
   - https uniquement, 5 redirections au plus (chacune revérifiée) ;
   - refus des adresses privées ou locales (127.x, 10.x, 192.168.x, 169.254.x, ::1…),
     vérifiées au moment de la connexion pour éviter les changements de DNS ;
   - 100 Mo au maximum, délai de 10 minutes ;
   - le contenu doit être un vrai PDF ou EPUB (vérifié sur les premiers octets).
   ============================================================ */
const https = require('https');
const dns = require('dns');
const net = require('net');
const fs = require('fs');

const TAILLE_MAX = 100 * 1024 * 1024;
const DELAI = 10 * 60 * 1000;   // 1.15.2 : archive.org envoie parfois à moins de 300 Ko/s

function adressePrivee(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return adressePrivee(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff');
}
/** Résolution DNS qui refuse toute adresse privée (utilisée au moment même de la connexion). */
function lookupSur(hote, options, rappel) {
  dns.lookup(hote, { ...options, all: true }, (err, adresses) => {
    if (err) return rappel(err);
    const liste = Array.isArray(adresses) ? adresses : [{ address: adresses, family: options.family || 4 }];
    const bonne = liste.find(a => !adressePrivee(a.address));
    if (!bonne || liste.some(a => adressePrivee(a.address))) return rappel(new Error('Adresse privée ou locale refusée.'));
    if (options.all) return rappel(null, [bonne]);
    rappel(null, bonne.address, bonne.family);
  });
}
function verifierUrl(texte) {
  let u;
  try { u = new URL(String(texte || '').trim()); } catch { throw new Error('Adresse invalide.'); }
  if (u.protocol !== 'https:') throw new Error('Seules les adresses https:// sont acceptées.');
  if (u.username || u.password) throw new Error('Adresse avec identifiants refusée.');
  if (net.isIP(u.hostname) && adressePrivee(u.hostname)) throw new Error('Adresse privée ou locale refusée.');
  return u;
}
function nature(tete) {
  if (tete.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (tete[0] === 0x89 && tete.slice(1, 4).toString('latin1') === 'PNG') return 'png';
  if (tete[0] === 0xFF && tete[1] === 0xD8 && tete[2] === 0xFF) return 'jpeg';
  if (tete[0] === 0x50 && tete[1] === 0x4B && tete.slice(30, 58).toString('latin1') === 'mimetypeapplication/epub+zip') return 'epub';
  // certains PDF commencent par quelques octets parasites avant l'en-tête
  if (tete.slice(0, 1024).toString('latin1').includes('%PDF-')) return 'pdf';
  return '';
}

/**
 * Télécharge l'adresse dans le fichier « destination ».
 * Renvoie { nature: 'pdf'|'epub', taille, nomFichier, urlFinale }.
 */
function telecharger(adresse, destination, { redirections = 5, debut = Date.now(), natures = ['pdf', 'epub'] } = {}) {
  return new Promise((ok, ko) => {
    let u;
    try { u = verifierUrl(adresse); } catch (e) { return ko(e); }
    const req = https.get(u, {
      lookup: lookupSur,
      timeout: 120000,   // archive.org peut mettre plus d'une minute avant d'envoyer le premier octet
      headers: { 'User-Agent': 'OASIS-Bibliotheque/1.16.1 (+https://oasis-centre-num-rique-d-apprentissage.onrender.com/; bibliotheque numerique educative en Haiti) Node.js', Accept: 'application/pdf,application/epub+zip,image/png,image/jpeg,*/*;q=0.5' }
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (redirections <= 0) return ko(new Error('Trop de redirections.'));
        const suivante = new URL(res.headers.location || '', u).toString();
        return telecharger(suivante, destination, { redirections: redirections - 1, debut, natures }).then(ok, ko);
      }
      if (res.statusCode !== 200) { res.resume(); return ko(new Error(`Le site a répondu ${res.statusCode}.`)); }
      const annonce = Number(res.headers['content-length'] || 0);
      if (annonce > TAILLE_MAX) { res.resume(); return ko(new Error('Document trop volumineux (100 Mo max).')); }
      let taille = 0, tete = Buffer.alloc(0), fini = false;
      const flux = fs.createWriteStream(destination);
      const echec = e => { if (fini) return; fini = true; res.destroy(); flux.destroy(); fs.rm(destination, { force: true }, () => {}); ko(e); };
      const minuteur = setTimeout(() => echec(new Error('Téléchargement trop long (10 minutes max).')), Math.max(1000, DELAI - (Date.now() - debut)));
      res.on('data', c => {
        taille += c.length;
        if (tete.length < 1100) tete = Buffer.concat([tete, c.slice(0, 1100 - tete.length)]);
        if (taille > TAILLE_MAX) echec(new Error('Document trop volumineux (100 Mo max).'));
      });
      res.on('error', echec);
      flux.on('error', echec);
      res.pipe(flux);
      flux.on('finish', () => {
        clearTimeout(minuteur);
        if (fini) return; fini = true;
        const n = nature(tete);
        if (!n || !natures.includes(n)) { fs.rm(destination, { force: true }, () => {}); return ko(new Error(`Le document reçu n’est pas d’un format accepté (${natures.join(', ').toUpperCase()}) : page web ou fichier protégé ?`)); }
        const dispo = String(res.headers['content-disposition'] || '');
        const nomFichier = decodeURIComponent((dispo.match(/filename\*=UTF-8''([^;]+)/i) || dispo.match(/filename="?([^";]+)/i) || [, ''])[1] || '') || decodeURIComponent(u.pathname.split('/').pop() || '');
        ok({ nature: n, taille, nomFichier: nomFichier.slice(0, 160), urlFinale: u.toString() });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Le site ne répond pas.')));
    req.on('error', e => ko(new Error(e.message === 'Adresse privée ou locale refusée.' ? e.message : 'Connexion impossible : ' + e.message)));
  });
}

module.exports = { telecharger, verifierUrl, adressePrivee, nature, TAILLE_MAX };
