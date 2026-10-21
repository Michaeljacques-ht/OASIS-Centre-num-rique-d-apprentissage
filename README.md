# OASIS — Bibliothèque numérique intelligente

Plateforme de bibliothèque numérique et physique pour les apprenants haïtiens. Node.js pur, sans dépendance npm, base de données JSON, application installable (PWA).

- **Mettre à jour le site : lire [`MISE-A-JOUR.md`](MISE-A-JOUR.md).**
- Démarrage local : `node server.js` → portail http://localhost:3000, espace bibliothécaire http://localhost:3000/admin
- Vérification : `npm test`
- Comptes de démonstration (base neuve) : `admin@oasis.ht` / `admin123` · `emma@oasis.ht` / `demo123`

## Fonctions principales et documentation

| Domaine | Documentation (dossier `docs/`) |
|---|---|
| Catalogue, lecteurs PDF / EPUB / texte, emprunts, réservations | `DOCUMENTATION.md`, `VALIDATION-LECTURE.md`, `LECTURE-VOCALE-TEMPS.md` |
| Abonnements, tarifs, comptabilité (PLOP PLOP) | `TARIFS-ABONNEMENTS.md`, `ABONNEMENTS-COMPTABILITE.md`, `ADMINISTRATEURS-TARIFS-PROFILS.md` |
| Établissements scolaires | `ETABLISSEMENTS.md`, `NIVEAUX.md` |
| Dons et quiz de lecture (1.9) | `DONS-ET-QUIZ.md` |
| Recherche dans le texte des livres (1.10) | `RECHERCHE-PLEIN-TEXTE.md` |
| Assistant OASIS IA (1.11) | `OASIS-IA.md` |
| Surlignage en couleurs (1.12) | `SURLIGNAGE.md` |
| Diagnostic d’installation et mises à jour (1.13) | `../MISE-A-JOUR.md` |
| Corrections et notes techniques | autres fichiers de `docs/` |

## Configuration (variables d’environnement sur Render)

| Variable | Rôle |
|---|---|
| `PLOP_CLIENT_ID`, `PLOP_CLIENT_SECRET` | Paiements PLOP PLOP (abonnements, dons) |
| `OASIS_IA_CLE` (ou `ANTHROPIC_API_KEY`) | Assistant OASIS IA (facultatif) |
| `OASIS_IA_MODELE`, `OASIS_IA_FOURNISSEUR`, `OASIS_IA_URL` | Réglages avancés de l’IA (facultatif) |
| `PORT` | Fourni par Render |

Données : `data/db.json`, `data/pdfs/`, `data/textes/`, `data/ia/` — **à garder sur le disque persistant Render, jamais sur GitHub.**
