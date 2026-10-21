# Version 1.12.0 — Surlignage en couleurs

## Pour les lecteurs (compte connecté)

- Dans les lecteurs **PDF, EPUB et texte**, sélectionnez un passage : une petite barre apparaît avec **5 couleurs** (jaune, vert, bleu, rose, orange) et un bouton 🗒️ pour surligner en ajoutant une note.
- Touchez un passage déjà surligné pour **changer sa couleur**, **ajouter ou modifier sa note**, ou le **retirer** 🗑️. Un pointillé signale un surlignage accompagné d’une note.
- Les surlignages sont enregistrés sur le serveur : ils réapparaissent sur tous vos appareils, à la bonne page (PDF), au bon chapitre (EPUB) ou dans le texte intégré.
- Pour rendre le texte des PDF sélectionnable, une couche de texte invisible est posée sur chaque page. Les PDF scannés (images) ne peuvent pas être surlignés tant qu’ils ne sont pas passés par l’OCR.

## Rangés avec les notes

- La fenêtre **« 🗒️ Mes notes »** d’un livre affiche maintenant les surlignages avec leur couleur, la page, le passage et la note.
- Filtres : Tout · Surlignages · Notes et marque-pages.
- Bouton **📖 Ouvrir** : le lecteur s’ouvre directement à la page du passage.
- **Exporter (.txt)** inclut les passages surlignés et leurs notes.

## Technique

- Un surlignage est une note de type `surlignage` dans la collection `notes` existante : `couleur`, `texte` (le passage), `commentaire`, `page`, `unite` (page / chapitre / partie), `debut`, `fin`.
- Si le texte a légèrement changé (fichier remplacé), le passage est retrouvé par sa citation. Sinon, il reste consultable dans « Mes notes ».
- Limites : 2 000 surlignages par livre et par lecteur, 2 000 caractères par passage.
- Routes : `POST /api/livres/:id/notes` avec `type: "surlignage"`, puis la nouvelle route **`PUT /api/notes/:id`** (couleur, note) et `DELETE /api/notes/:id` (existante).
- Le lecteur EPUB autorise désormais l’accès au contenu du chapitre (`sandbox="allow-same-origin"`), toujours **sans exécution de scripts** : c’est nécessaire pour la sélection.

Fichiers nouveaux : `modules/surlignages.js`, `public/surlignage.js`, `tests/surlignages.cjs`.
Fichiers modifiés : `server.js`, `public/app.js` (lecteurs PDF et texte, Mes notes), `public/lecteur-epub.js`, `public/index.html`, `public/styles.css`, `public/sw.js`, `public/admin.js`, `public/admin.html`, `package.json`.
