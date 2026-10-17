# Version 1.9.0 — Dons et Quiz de lecture

## 💝 Faire un don (PLOP PLOP)

Les particuliers, **avec ou sans compte**, peuvent soutenir l’institution depuis le menu « Faire un don » du portail (visible aussi des visiteurs).

- Montants suggérés + montant libre (minimum 20 HTG imposé par PLOP PLOP, maximum réglable).
- Affectation : besoin général, livres, abonnements offerts, équipement.
- Don anonyme possible : le nom et le message ne sont pas affichés publiquement (l’administration les voit).
- Paiement sur PLOP PLOP (MonCash, NatCash, Kashpaw), confirmation automatique toutes les 5 s, bouton « Vérifier mon paiement ».
- À la confirmation : **reçu numéroté** `REC-DON-AAAA-0001`, imprimable / enregistrable en PDF.
- Un visiteur sans compte retrouve ses dons grâce à une clé de suivi gardée dans son navigateur ; un lecteur connecté les retrouve depuis n’importe quel appareil.
- Anti-abus : 8 créations de dons maximum par adresse IP toutes les 10 minutes.

**Administration → Dons** (administrateur principal) : totaux, nombre de donateurs, progression vers l’objectif, réglages de la campagne (activer/suspendre, titre, message, objectif, montants suggérés, affichage des donateurs), filtres, revérification des dons en attente, export CSV.

Configuration : les mêmes variables que les abonnements, `PLOP_CLIENT_ID` et `PLOP_CLIENT_SECRET`.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/dons/infos` | Campagne, totaux, derniers donateurs |
| POST | `/api/dons` | Créer un don → URL PLOP PLOP + clé de suivi |
| POST | `/api/dons/verifier/:id` | Confirmer (corps `{cle}` si sans compte) |
| GET | `/api/dons/:id?cle=` | Détail / reçu |
| GET | `/api/dons?mes=1` | Dons du lecteur connecté |
| GET | `/api/admin-dons` | Tableau administrateur |
| PUT | `/api/admin-dons/parametres` | Réglages de campagne |
| POST | `/api/admin-dons/:id/verifier` | Revérifier un don |

## 🧠 Quiz de lecture à plusieurs niveaux

**Administration → Quiz de lecture** : créer, modifier, dupliquer, publier/dépublier, supprimer.

Chaque quiz a : une **catégorie** du catalogue, un **niveau** (🌱 1 Débutant · 📘 2 Intermédiaire · 🚀 3 Avancé · 🏆 4 Expert), un livre associé facultatif, 1 à 50 questions à choix (2 à 6 réponses, une bonne, explication facultative), un seuil de réussite (50–100 %, 70 % par défaut), une durée (chronomètre facultatif), un nombre de tentatives, le mélange des questions et réponses, l’affichage de la correction.
Import rapide de questions en texte : un bloc par question, réponse juste précédée de `*`, explication précédée de `?`.

**Progression** : dans une catégorie, un niveau se débloque quand le lecteur a réussi un quiz du niveau existant juste en dessous.

**Récompenses** (à la première réussite seulement) :
- badge (nom et emoji personnalisables, par défaut Bronze / Argent / Or / Diamant) ;
- points (10 / 20 / 35 / 50 par défaut) → rangs : Lecteur curieux, Explorateur des pages (50), Érudit (150), Sage d’OASIS (400) ;
- jours d’**accès complet offerts** (0–90), cumulables, sans toucher à la comptabilité des abonnements (champ `accesOffertFin`) ;
- badge **👑 Maître** de la catégorie (+100 points) quand les 4 niveaux sont réussis ;
- **attestation de réussite** imprimable pour chaque badge.

Côté lecteur (menu « Quiz de lecture ») : quiz par catégorie et niveau, passage question par question (touches A–F et flèches), chronomètre avec validation automatique, résultat et correction, onglets « Mes récompenses » et « Classement » (par établissement).

Sécurité : les bonnes réponses ne quittent jamais le serveur avant la soumission ; une tentative n’est corrigée qu’une fois ; une réponse arrivée après le temps imparti (+30 s de marge) n’est pas validée. La suppression d’un quiz conserve les badges déjà obtenus.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/quiz` | Quiz publiés, verrous, progression |
| POST | `/api/quiz/:id/commencer` | Ouvrir une tentative |
| POST | `/api/quiz/tentatives/:tid/soumettre` | Corriger `{reponses:{idQuestion:index}}` |
| GET | `/api/quiz/recompenses` | Badges, points, rang |
| GET | `/api/quiz/classement` | Top 10 |
| GET/POST | `/api/admin-quiz` | Liste / création |
| PUT/DELETE | `/api/admin-quiz/:id` | Modification, publication `{publie}`, suppression |

## Fichiers

Nouveaux : `modules/dons.js`, `modules/quiz.js`, `public/don.js`, `public/quiz.js`, `public/admin-dons.js`, `public/admin-quiz.js`, `tests/dons.cjs`, `tests/quiz.cjs`.
Modifiés : `server.js` (branchement des routes), `modules/abonnement.js` (accès offert), `modules/administration-comptes.js` (pages dons/quiz lisibles par les administrateurs délégués), `public/index.html`, `public/app.js`, `public/admin.html`, `public/admin.js`, `public/styles.css`, `public/sw.js`, `package.json` (1.9.0).

Nouvelles collections JSON créées automatiquement : `dons`, `compteurRecusDons`, `quiz`, `quizTentatives`, `quizBadges`. Conservez votre dossier `data` lors de la mise à jour.
