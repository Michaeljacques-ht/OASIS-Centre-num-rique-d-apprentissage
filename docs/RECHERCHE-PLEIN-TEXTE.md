# Version 1.10.0 — Recherche dans le texte des livres

Les lecteurs peuvent maintenant chercher un mot ou une expression **dans le contenu** des livres, pas seulement dans le titre, l’auteur ou la catégorie.

## Côté lecteur

- Dans la barre de recherche habituelle, une section « 📄 Dans le texte des livres » s’ajoute sous les résultats du catalogue.
- Chaque résultat indique le livre, la **page** (PDF), le **chapitre** (EPUB) ou la **partie** (texte intégré), avec un extrait où les mots trouvés sont surlignés.
- « Ouvrir » lance le lecteur directement à la bonne page ou au bon chapitre, avec le passage rappelé en haut du lecteur PDF.
- Accents et majuscules ignorés (« reforme » trouve « Réforme »), début de mot accepté (« éduc » trouve « éducation »), tous les mots doivent figurer sur la même page.
- Expression exacte entre guillemets : `"école fondamentale"`.
- Les droits existants s’appliquent : un visiteur ou un compte sans accès complet n’ouvre que l’aperçu gratuit.

## Côté administration (onglet « Recherche dans les livres »)

- Extraction automatique à l’ajout, au remplacement ou à la suppression d’un PDF, d’un EPUB ou d’un texte. Au premier démarrage, tous les livres existants sont traités en arrière-plan, un à la fois.
- État de chaque document : indexé, en attente, erreur (PDF protégé, fichier abîmé…) ou **« Scanné — OCR nécessaire »** : ce PDF n’est qu’une image, il faudra l’OCR pour le rendre cherchable.
- Bouton de réindexation par document ou global.
- **Recherches sans aucun résultat** (ni catalogue ni texte), avec le nombre de demandes : pistes d’acquisition et de mots-clés. Export CSV et remise à zéro.

## Technique

- Aucune dépendance ajoutée : le pdf.js déjà présent dans `public/vendor/pdfjs` sert aussi côté serveur ; l’EPUB est lu dans l’ordre de lecture (spine), comme le lecteur.
- Textes extraits dans `data/textes/<id>.json`, hors de `db.json`. **Ce dossier doit être sur le disque persistant de Render**, comme `data/pdfs`. S’il est perdu, il est simplement reconstruit.
- Index en mémoire reconstruit au démarrage à partir de ces fichiers (pas de réextraction).
- Limites : 2 000 pages par PDF, 20 000 caractères par page, 12 millions de caractères par livre.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/recherche?q=` | Passages trouvés (public) ; `journal=1` relève les recherches infructueuses |
| GET | `/api/admin-recherche` | État de l’indexation et recherches sans résultat |
| POST | `/api/admin-recherche/reindexer` | `{ id }` ou tout le catalogue |
| DELETE | `/api/admin-recherche/sans-resultat` | Vider le relevé |

Fichiers nouveaux : `modules/recherche-texte.js`, `public/recherche-texte.js`, `public/admin-recherche.js`, `tests/recherche-texte.cjs`.
Modifiés : `server.js`, `public/app.js` (section de résultats, ouverture à la page), `public/lecteur-epub.js` (chapitre de départ), `public/index.html`, `public/admin.html`, `public/admin.js`, `public/styles.css`, `public/sw.js`, `package.json`.
