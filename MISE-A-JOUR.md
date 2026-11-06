## 1.25.0 — Annonces défilantes, partenaires supporteurs, fin de la période de découverte

- **Période de découverte supprimée** : les nouveaux comptes (lecteurs et établissements) n'ont plus 30 jours gratuits ; l'accès complet s'ouvre par un don. Les essais déjà en cours vont à leur terme. Le compte de démonstration est considéré comme donateur.
- **Annonces** (Espace bibliothécaire › Annonces) : messages courts avec type (information, important, événement, nouveauté, partenaire, appel aux dons), lien facultatif, dates de début et de fin, ordre et activation. Ils défilent dans une barre en haut de toutes les pages (pause au survol, fermeture possible, sans animation si l'appareil demande moins de mouvements).
- **Partenaires supporteurs** (Espace bibliothécaire › Partenaires) : logo, niveau (Or, Argent, Bronze, Supporteur), secteur, slogan, présentation, offre spéciale pour les membres OASIS, adresse, téléphone, WhatsApp, email, site, Facebook, Instagram, couleur, période d'affichage et ordre. Carrousel sur l'accueil, page « Partenaires » avec les petites publicités, compteur de visites des liens.

## 1.24.0 — Bibliothèque par dons et confirmation d'inscription par email

- **Accès par don** : les abonnements sont remplacés par des dons. Le montant affiché (mensuel ou annuel, selon le profil) est le don minimum qui ouvre l'accès complet ; le donateur peut donner davantage. Les dons d'accès confirmés apparaissent dans la liste des dons avec un reçu `REC-DON-…`. Les 30 jours de découverte gratuits sont conservés.
- **Établissements** : dons annuels par paliers selon l'effectif — petite (100 élèves), moyenne (300), grande (600), et deux nouveaux paliers plus élevés : très grande école (1 200 élèves, 250 000 HTG) et réseau scolaire / université (3 000 élèves, 500 000 HTG). L'établissement peut donner plus que le montant suggéré.
- **Confirmation d'inscription** : quand l'envoi d'emails est configuré, un nouvel inscrit reçoit un email « Activez votre compte » ; le compte ne peut pas se connecter avant d'avoir ouvert le lien (valable 48 h). Bouton « Renvoyer l'email de confirmation ». Les comptes existants ne sont pas concernés.
- **À configurer sur Render** (Environment) : `BREVO_API_KEY` (clé API Brevo), `BREVO_SENDER_EMAIL` (adresse d'expéditeur validée dans Brevo) et, si besoin, `SITE_URL`. Sans ces variables, les inscriptions restent actives immédiatement, comme avant.

## 1.23.0 — Nouvel en-tête sur téléphone

- Bandeau bleu nuit aux coins arrondis, logo et marque « OASIS — Bibliothèque numérique intelligente », boutons en verre dépoli, carte de salutation, en-tête qui reste visible en faisant défiler.
- Sur téléphone, Collaboration et À propos quittent l'en-tête (Collaboration reste dans le menu ; « À propos » y est ajouté) pour laisser la place à la marque.

## 1.22.0 — Nouveau lecteur EPUB

- Pagination réelle : « Page 3 sur 21 de ce chapitre · environ page 145 sur 980 · 15 % du livre », avec barre de progression.
- Sommaire avec les vrais titres des chapitres (table des matières EPUB 3 ou EPUB 2) au lieu de « Chapitre 7 ».
- Lecture plein écran (bouton ou touche F), flèches de page sur les côtés, clavier (← →, Début, Fin), glissement du doigt sur téléphone, molette.
- Panneau « Affichage » : thème clair, sépia ou sombre ; trois polices ; interligne ; largeur du texte ; lecture page par page ou défilement continu. Les choix sont mémorisés sur l'appareil.
- Recherche dans tout le livre avec extraits et accès direct au passage surligné.
- Signets par livre et reprise automatique à la dernière page lue.

## 1.21.0 — Ressources : Laboratoire virtuel

- Nouvelle section `laboratoire` (🧪 Laboratoire virtuel) : simulations et laboratoires en ligne de physique, chimie, biologie, électronique et astronomie.
- La section « Bibliothèques en ligne » est retirée ; au démarrage, ses fiches éventuelles sont rangées dans « Bases de données ».

## 1.20.0 — Ressources : nouvelles sections

- Quatre nouvelles sections dans la page Ressources et dans le formulaire du bibliothécaire : `bibliotheque` (📚 Bibliothèques en ligne), `specialise` (🔬 Ressources spécialisées par discipline), `outil-enseignant` (🧑‍🏫 Outils technopédagogiques pour les enseignants) et `outil-apprenant` (🎒 Outils technopédagogiques pour les apprenants).
- Nouvelle route `PUT /api/ressources/:id` (bibliothécaire) : modifier le titre, le texte, la source, le lien, l'icône, la catégorie ou la section d'une ressource sans perdre son document ni son image.

## 1.19.0 — Ressources : import de documents par adresse web

- Nouvelle route `POST /api/ressources/:id/importer-url` (bibliothécaire) : le serveur télécharge lui-même un PDF ou un EPUB public et le joint à une ressource (documents officiels, administratifs…), avec les mêmes protections que pour les livres (https, adresses privées refusées, 100 Mo, 10 minutes, contrôle des premiers octets).

## 1.18.0 — Cinémathèque : vidéos YouTube intégrées

- Une vidéo peut désormais être un lien YouTube (champ « lien YouTube » du formulaire, ou `youtube` dans `POST /api/medias` ; `POST /api/medias/:id/youtube` pour une fiche existante). Rien n'est téléchargé : la vidéo est lue dans OASIS via le lecteur sans cookies `youtube-nocookie.com`.
- La politique de sécurité (CSP) autorise uniquement `www.youtube-nocookie.com` en cadre et `i.ytimg.com` pour les vignettes. Le service worker ne met plus en cache les ressources d'autres sites.

## 1.17.0 — Audiothèque et cinémathèque : import par adresse web

- `POST /api/medias/:id/importer-url` accepte maintenant l'audio (MP3, OGG, M4A, WAV) et la vidéo (MP4, WebM), en plus des cartes. Le format est reconnu sur les premiers octets du fichier.

## 1.16.1 — Import par adresse : identification auprès des sites

- Le serveur se présente désormais avec l'adresse du site OASIS dans son en-tête User-Agent, comme l'exige Wikimedia Commons, qui refusait les téléchargements (erreur 429).

## 1.16.0 — Cartothèque : import de cartes depuis une adresse web

- Nouvelle route `POST /api/medias/:id/importer-url` (bibliothécaire, cartothèque uniquement) : le serveur télécharge lui-même une carte PDF, PNG ou JPEG publique (Wikimedia Commons, Bibliothèque du Congrès, OCHA…), avec les mêmes protections que pour les livres (https, adresses privées refusées, 100 Mo, 10 minutes, contrôle des premiers octets).
- `modules/import-url.js` reconnaît désormais les PNG et JPEG ; les livres restent limités au PDF et à l'EPUB.

## 1.15.2 — Import depuis une adresse : 10 minutes au lieu de 3

- Un gros PDF d'archive.org (40 à 85 Mo) peut arriver à moins de 300 Ko/s : le téléchargement complet a maintenant 10 minutes au lieu de 3.

## 1.15.1 — Import depuis une adresse : délai allongé

- Le serveur attend désormais jusqu'à 2 minutes le premier octet (au lieu de 30 s) : archive.org met souvent plus de 30 s à commencer l'envoi d'un gros PDF, ce qui provoquait l'erreur « Le site ne répond pas ».

# Mettre à jour OASIS — mode d’emploi

Le site tourne sur **Render**, qui lit le dépôt **GitHub** `Michaeljacques-ht/OASIS-Centre-num-rique-d-apprentissage`.
Mettre à jour = **envoyer les fichiers sur GitHub, au bon endroit**, puis **redéployer sur Render**.

## La structure du projet (à respecter sur GitHub)

```
(racine du dépôt)
├── server.js            ← programme du serveur (Render lance « node server.js »)
├── package.json         ← numéro de version
├── manifeste.json       ← liste de contrôle de tous les fichiers (sert au diagnostic)
├── MISE-A-JOUR.md       ← ce mode d’emploi
├── README.md
├── modules/             ← fonctions du serveur (dons, quiz, IA, recherche…)
├── lib/                 ← passerelle de paiement PLOP PLOP
├── public/              ← tout ce qui s’affiche dans le navigateur
├── tests/               ← vérifications automatiques (npm test)
├── outils/              ← outil de génération du manifeste
├── docs/                ← documentation de chaque version
└── integrations/        ← archives d’intégration (ne change presque jamais)
```

**Jamais sur GitHub : le dossier `data/`** (livres, membres, PDF). Il vit sur le disque persistant de Render.

## Méthode la plus simple : `envoyer.bat` (Windows)

Le fichier `envoyer.bat`, à la racine du projet, envoie tout le dossier sur GitHub en un double-clic, sans limite de 100 fichiers.

**Une seule fois :** installez **Git pour Windows** (https://git-scm.com/download/win, en gardant les choix proposés).
Si Node.js est installé, le manifeste est aussi recalculé automatiquement.

**À chaque mise à jour :**
1. Décompressez la version **complète** (`oasis-<version>-complet.zip`) dans un dossier de votre ordinateur,
   ou mettez à jour votre dossier habituel avec les fichiers livrés.
2. Double-cliquez sur `envoyer.bat`.
3. La première fois : indiquez votre nom et votre email, puis connectez-vous à GitHub dans la fenêtre qui s'ouvre.
4. Le script affiche ce qui va changer (ajouts, modifications, suppressions) et demande **O** pour confirmer.
5. Sur Render : le site se met à jour seul si le déploiement automatique est actif, sinon **Manual Deploy → Deploy latest commit**.

Le dossier de votre ordinateur devient la référence : un fichier absent de ce dossier est retiré de GitHub.
Le script vous prévient si plus de 10 fichiers seraient supprimés — répondez **N** si votre dossier n'est pas complet.
Le dossier `data/` n'est jamais envoyé.

## Mise à jour normale (paquet de mise à jour)

Chaque nouvelle version vous est livrée sous la forme d’un paquet `oasis-<version>-mise-a-jour.zip`.
Il contient **uniquement les fichiers modifiés**, déjà rangés dans leurs dossiers, toujours **moins de 100 fichiers**,
et un fichier `FICHIERS-DE-CETTE-MISE-A-JOUR.txt` qui en donne la liste.

1. Décompressez le paquet sur votre ordinateur.
2. Sur GitHub, restez sur la **page d’accueil du dépôt** (la racine, pas un sous-dossier).
3. **Add file → Upload files**, puis glissez **tout le contenu** du dossier décompressé
   (les fichiers *et* les dossiers `modules`, `public`… tels quels). GitHub conserve les sous-dossiers.
4. En bas : **Commit changes**.
5. Sur Render : **Manual Deploy → Deploy latest commit** (inutile si le déploiement automatique est actif).
6. Vérifiez : ouvrez l’**espace bibliothécaire**. Aucun bandeau rouge = tout est en place.
   Un bandeau « Installation incomplète » donne la **liste exacte** des fichiers à renvoyer ou à supprimer.

## Les trois erreurs à éviter

| Erreur | Conséquence | Bonne pratique |
|---|---|---|
| Ouvrir le dossier `public` sur GitHub puis y glisser un dossier `public` | Création de `public/public/…` | Toujours envoyer depuis la **racine** |
| Glisser le *contenu* de `public` à la racine | Des dossiers `vendor/`, `diffusion/`, `app.js`… apparaissent à la racine | Glisser le **dossier** `public` lui-même |
| Envoyer plus de 100 fichiers d’un coup | GitHub n’en enregistre qu’une partie | Les paquets de mise à jour restent sous 100 fichiers |

## Installation complète (ou remise en ordre du dépôt)

Pour repartir d’un dépôt propre, utilisez l’archive complète `oasis-<version>-complet.zip`, livrée en lots de moins de 100 fichiers,
ou plus simplement l’éditeur en ligne de GitHub, qui n’a pas de limite :

1. Sur la page du dépôt, appuyez sur la touche **`.`** (point) : `github.dev` s’ouvre.
2. Supprimez les éléments signalés « en trop » par le diagnostic.
3. Glissez le contenu complet du projet décompressé dans l’explorateur, à la racine, et acceptez de remplacer.
4. Onglet **Source Control** → message → **Commit & Push**, puis déployez sur Render.

## Revenir en arrière

Sur Render : **Events** → choisissez un déploiement réussi plus ancien → **Rollback**. Les données (`data/`) ne sont pas touchées.

## Vérifications utiles

- `https://…onrender.com/api/version` : numéro de version du serveur.
- Espace bibliothécaire : bandeau de diagnostic (fichiers manquants, différents ou en trop).
- Sur votre ordinateur, avec Node.js : `npm test` vérifie tout le système ; `npm run manifeste` régénère `manifeste.json` après une modification.

## Version 1.14.0 — Pagination, ressources PDF/EPUB et nouveau design

- Catalogue (administration) et bibliothèque (lecteurs) : affichage par groupes de 50 avec « 50 précéd. », « 50 suiv. » et « Tout afficher ».
- Catalogue : recherche, filtres par catégorie et par état (incomplets, auteur à préciser, téléchargement restreint), tableau redessiné avec couvertures.
- Ressources : un document PDF ou EPUB (100 Mo max) peut être joint à chaque ressource, avec une catégorie (thème). Les fichiers sont rangés dans `data/ressources-docs/`.
- Lecteurs : ressources regroupées par section ou par catégorie, avec « Consulter le PDF » / « Lire l’EPUB ».

## Version 1.14.1 — Site plus rapide

- Base de données : une écriture toutes les 2 secondes au plus, JSON compact, copies de secours une fois par heure (sauvegarde environ 13 fois plus rapide ; le serveur ne se fige plus à chaque page lue).
- Accueil et tableau de bord : seuls les livres affichés sont téléchargés (4 Ko au lieu de 3 Mo).
- Couvertures : nouvelles couvertures en JPEG, vignettes légères pour les listes, conservées 30 jours par le navigateur. Après le déploiement, cliquez une fois sur « ⚡ Alléger les couvertures » dans le Catalogue et laissez la fenêtre ouverte jusqu'à la fin.

## Version 1.14.2 — Beaucoup plus d'utilisateurs simultanés

- Le catalogue commun à tous les lecteurs est préparé une fois puis réutilisé (30 secondes, ou jusqu'à la prochaine modification) : seuls les champs personnels (favori, progression, réservation) sont calculés pour chaque lecteur.
- Bibliothèque, Catégories et Nouveautés : le serveur n'envoie que la page de 50 livres affichée, avec les filtres, au lieu des 3 300 livres.
- Aucun réglage à faire : déployez simplement cette version.

## Version 1.15.0 — Importer depuis une adresse web

- Catalogue → « 🌐 Importer depuis une adresse » : collez une adresse https:// par ligne (`adresse | titre | auteur | catégorie`). Le serveur télécharge lui-même le PDF ou l'EPUB (Gallica, Wikisource, archive.org, sites officiels), crée la fiche et la couverture.
- Protections : https seulement, adresses privées refusées, 100 Mo et 3 minutes au maximum, vrai PDF/EPUB exigé, réservé aux bibliothécaires. À utiliser uniquement pour des documents libres de droits.

