/* OASIS Bibliothèque Numérique — Service Worker (PWA) */
importScripts('/partage-stockage.js');
const CACHE = 'oasis-v56';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord partout ; le cache ne sert qu'en secours hors ligne
self.addEventListener('fetch', e => {
  if(e.request.method==='POST' && new URL(e.request.url).pathname==='/recevoir-partage'){
    e.respondWith((async()=>{try{const form=await e.request.formData();await OasisPartages.ajouter(form.getAll('documents'));return Response.redirect(new URL('/partage.html',self.location.origin).href,303)}catch(err){return Response.redirect(new URL('/partage.html?erreur='+encodeURIComponent(err.message),self.location.origin).href,303)}})());return;
  }
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ erreur: 'Hors ligne — reconnectez-vous à Internet.' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(
    fetch(e.request).then(rep => {
      const copie = rep.clone();
      caches.open(CACHE).then(c => c.put(e.request, copie));
      return rep;
    }).catch(() => caches.match(e.request))
  );
});
