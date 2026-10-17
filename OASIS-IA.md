# Version 1.11.0 — OASIS IA (lot 2)

## Ce que voient les lecteurs

**Dans les lecteurs PDF, EPUB et texte**, un bouton « ✨ OASIS IA » ouvre un panneau :
- **💡 Comprendre cette page** : idée principale, points importants, mots difficiles, exemple. Le niveau d’explication se choisit : primaire, secondaire, université ou formation professionnelle. Par défaut, c’est le niveau du profil.
- **📝 Résumer** la page, le chapitre (EPUB) ou la partie (texte).
- **🌐 Traduire** la page, ou un passage collé depuis la page, vers le créole haïtien, l’anglais ou le français. La réponse rappelle que c’est une traduction automatique à vérifier.
- **❓ Poser une question sur ce livre** : l’assistant cherche les passages pertinents (grâce à l’index du lot 1), répond à partir d’eux seulement et cite les pages. Chaque page citée est un bouton qui ouvre le lecteur à cet endroit.

**Dans la recherche**, l’encart « ✨ Demander à OASIS IA » lit les passages trouvés dans toute la bibliothèque. Il indique quels livres consulter et à quelle page, par exemple pour « Quels livres expliquent la réforme Bernard ? ».

**Recommandations enrichies** (sans IA) :
- sur l’accueil, « 📖 Continuer votre lecture » : jusqu’à 6 livres commencés, avec un bouton Reprendre ;
- dans la fiche d’un livre, « 👥 Les lecteurs de ce livre ont aussi lu ». Il faut au moins 2 lecteurs en commun et aucun nom n’est affiché ; à défaut, la fiche propose des livres de la même catégorie ;
- chaque lecteur peut masquer ces suggestions, puis les réactiver depuis Mon espace.

## Garde-fous

- **Le texte envoyé à l’IA est toujours relu sur le serveur**, depuis l’index du lot 1. Jamais celui du navigateur : impossible de détourner l’assistant pour d’autres usages.
- **Droits d’auteur** : par défaut, l’IA ne travaille que sur les documents cochés par l’administrateur. L’option inverse existe : tous les documents sauf ceux exclus.
- **Abonnement** : sans accès complet, l’assistant n’utilise que les 5 pages de l’aperçu gratuit.
- **Pas de références inventées** : une page citée par l’IA qui ne lui a pas été fournie est retirée de la réponse, et le lecteur en est averti.
- **Coûts maîtrisés** : un quota par lecteur et par jour (20 par défaut) et un plafond global (500 par jour). Les réponses déjà produites sont resservies sans nouvel appel et ne comptent pas dans le quota.
- Les pages scannées ou presque vides sont refusées avec un message clair (l’OCR est nécessaire).

## Administration

- **Onglet « ✨ OASIS IA »** :
  - état du service et bouton « Tester la connexion » ;
  - réglages : activation, politique des droits, fonctions proposées, quotas, taille du texte envoyé ;
  - liste des documents à ouvrir ou fermer à l’IA, un par un ou en lot ;
  - utilisation sur 30 jours : demandes, cache, jetons consommés.
- **Quiz de lecture → « ✨ Générer des questions avec OASIS IA »** : choisissez le livre associé, les pages et le nombre de questions. Les questions arrivent en brouillon, marquées « brouillon IA à relire », dans l’éditeur existant. Rien n’est publié sans votre relecture.

## Configuration sur Render

Ajoutez ces variables d’environnement au service, puis redémarrez :

| Variable | Rôle |
|---|---|
| `OASIS_IA_CLE` (ou `ANTHROPIC_API_KEY`) | Clé API du fournisseur (obligatoire) |
| `OASIS_IA_MODELE` | Facultatif ; par défaut `claude-haiku-5-5`, le modèle Claude le moins cher |
| `OASIS_IA_FOURNISSEUR=openai` + `OASIS_IA_URL` | Pour une API compatible OpenAI (autre fournisseur ou serveur local) |

Sans clé, tout le reste de la plateforme fonctionne et le bouton IA ne s’affiche pas. Le cache des réponses est rangé dans `data/ia/` (disque persistant).

## Routes

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/ia/etat` | Disponibilité, fonctions, quota restant |
| POST | `/api/ia/lecture` | `{ livreId, action: comprendre/resumer/traduire, page, niveau, langue, passage? }` |
| POST | `/api/ia/question` | `{ livreId, question, page? }` |
| POST | `/api/ia/bibliotheque` | `{ question }` |
| GET/PUT | `/api/admin-ia`, `/api/admin-ia/parametres` | Tableau et réglages |
| PUT | `/api/admin-ia/documents[/:id]` | `{ autorise: true/false/null, ids? }` |
| POST | `/api/admin-ia/tester`, `/api/admin-ia/quiz` | Test, brouillon de quiz |
| GET | `/api/suggestions/continuer`, `/api/livres/:id/aussi-lus` | Recommandations |
| PUT | `/api/suggestions/preferences` | `{ desactivees }` |

Fichiers nouveaux : `modules/ia.js`, `modules/suggestions.js`, `public/ia.js`, `public/suggestions.js`, `public/admin-ia.js`, `tests/ia.cjs`.
Fichiers modifiés : `modules/recherche-texte.js` (accès aux pages pour l’assistant), `public/lecture-assistance.js`, `public/lecteur-epub.js`, `public/app.js`, `public/recherche-texte.js`, `public/admin-quiz.js`, `server.js`, les fichiers HTML, CSS, `sw.js` et `package.json`.
