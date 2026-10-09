# 📖 Oasis Centre numérique d'apprentissage — Documentation des fonctionnalités

**Version 3.1 · Haïti 🇭🇹**
*Apprendre aujourd'hui pour un meilleur demain*

Oasis Centre numérique d'apprentissage est une plateforme complète d'apprentissage et de gestion de bibliothèque **hybride** : elle gère à la fois un fonds physique (exemplaires en rayon, emprunts, retours) et un fonds numérique (e-books PDF, ressources documentaires, contenus multimédias). Elle s'adresse aux écoles, universités, bibliothèques et centres de formation.

Elle se compose de deux interfaces : le **Portail apprenant** (`http://localhost:3000`) et l'**Espace bibliothécaire** (`http://localhost:3000/admin`).

---

## 1. Comptes et accès

- **Deux rôles** : *apprenant* (lecteur) et *bibliothécaire* (gestionnaire). Les apprenants créent leur compte librement depuis l'écran de connexion ; le bibliothécaire peut aussi inscrire des membres depuis son espace.
- **Sécurité** : mots de passe chiffrés (scrypt), sessions par jeton, chaque action sensible est réservée au rôle approprié.
- **Comptes de démonstration** : `admin@oasis.ht / admin123` (bibliothécaire) et `emma@oasis.ht / demo123` (apprenant).

---

## 2. Portail apprenant

### 2.1 Accueil et navigation
- **En-tête de bienvenue personnalisé** : « 👋 Bonjour *Prénom* — *message configurable* », adapté à l'heure (Bonjour / Bon après-midi / Bonsoir).
- **Bannière d'accueil** avec slogan configurable, sections *Nouveautés* et *Catégories populaires*.
- **Panneaux latéraux** : *Lectures Populaires*, *Ma Liste de Lecture* et *Reprendre la lecture* (vos lectures en cours avec leur pourcentage).
- **Pied de page** : nom de la bibliothèque, coordonnées, horaires et copyright (configurables).
- **Bouton ℹ️ À propos** : présentation de la plateforme avec logo, texte modifiable et coordonnées.

### 2.2 Recherche intelligente
- **Recherche instantanée** portant sur : titre, auteur, ISBN, catégorie, éditeur, langue, niveau scolaire, mots-clés et résumé.
- **Filtres combinables** dans la Bibliothèque : catégorie, langue, niveau scolaire, format (📕 physique / 💻 e-book / 📕+💻 hybride) et tri (meilleures notes, plus récents).

### 2.3 Fiche d'un livre
Chaque livre affiche sa couverture (générée automatiquement depuis la première page du PDF), sa note moyenne en étoiles, sa catégorie colorée et ses métadonnées (éditeur, langue, niveau, ISBN, mots-clés). La fiche indique clairement les **deux disponibilités** :
- 💻 *Disponible en ligne — lecture immédiate* pour la version numérique ;
- 📕 *En rayon : x/y exemplaires disponibles* pour la version physique.

Un titre présent sous les deux formes est signalé **hybride** : si tous les exemplaires sont sortis, la version numérique reste accessible.

Actions disponibles : Lire en ligne, Emprunter, Réserver, ❤️ Favoris, 📋 Liste de lecture, 🗒️ Mes notes, 📑 Citer, 🔗 Partager, 💬 Commentaires, ⭐ Noter (1 à 5 étoiles).

### 2.4 Lecture en ligne
- **Visionneuse PDF** intégrée (plein écran, téléchargement) et **lecteur de texte** pour les e-books rédigés en Markdown.
- **Confort de lecture** : mode sombre 🌙, zoom du texte A− / A+, plein écran ⛶.
- **Lecture vocale 🔊** (synthèse vocale du navigateur, en français) pour les personnes malvoyantes.
- **Lecture continue** : la progression est enregistrée automatiquement ; à la réouverture, le livre **reprend à la dernière position**. Une jauge de progression est visible pendant la lecture et sur la fiche.
- **Historique de lecture** : le panneau *Reprendre la lecture* liste les ouvrages en cours.
- **Marque-pages 🔖** : enregistrez votre position en un clic ; ils rejoignent vos notes.
- **✅ Terminer** : marquer un livre comme lu délivre le **certificat de lecture**.

### 2.5 Emprunts, retours et réservations
- **Emprunt d'un exemplaire physique** en un clic (durée configurable, 14 jours par défaut), dans la limite du nombre d'emprunts actifs autorisés (5 par défaut).
- **Mes Emprunts** : suivi des échéances, alerte visuelle de retard, **prolongation** (+7 jours, 2 fois maximum), bouton *Lire* pour les titres hybrides.
- **Réservation avec file d'attente** : quand tous les exemplaires sont sortis, le bouton 📌 *Réserver* place l'apprenant dans la file. À chaque retour, le premier est servi : l'exemplaire est **mis de côté** pendant un délai configurable (3 jours), avec notification ; non retiré à temps, il passe automatiquement au suivant. L'apprenant voit sa position dans la file et peut annuler.

### 2.6 Places de lecture
Réservation d'une **place assise en salle** par date et créneau horaire (nombre de places et créneaux configurables). Attribution automatique du numéro de place, une réservation par créneau et par personne, annulation libre.

### 2.7 Ressources documentaires (🔎 Ressources)
Cinq sections consultables et recherchables : **📖 Dictionnaire** (définitions, y compris créoles : Konbit, Lakou…), **🌍 Encyclopédie**, **🗄️ Bases de données**, **📋 Documents administratifs** et **📜 Documents historiques** (ex. : Acte de l'Indépendance d'Haïti, 1804). Chaque entrée peut porter une icône ou une image d'illustration, une source et un **lien externe** (« Consulter la ressource en ligne »).

### 2.8 Bibliothèque multimédia (🎬 Multimédia)
- **🎧 Audiothèque** : livres audio, podcasts, conférences, cours de langues (MP3, OGG, M4A, WAV). Écoute en **streaming** avec reprise automatique à la position d'arrêt, **vitesse réglable de 0,5× à 2×**, **minuteur d'arrêt automatique** (15/30/60 min) et téléchargement pour écoute hors connexion.
- **🗺️ Cartothèque** : cartes (PNG, JPEG, PDF) avec visionneuse **zoom 🔍+/−**, plein écran, impression 🖨️ et téléchargement. Champs *Lieu / Échelle* pour bâtir une Cartothèque d'Haïti (départements, communes, cartes historiques et thématiques).
- **🎬 Cinémathèque** : documentaires, cours filmés, archives, tutoriels (MP4, WebM) en streaming avec reprise et vitesse réglable.
- Le streaming utilise les **plages HTTP (206)** : on avance ou recule dans un fichier sans le télécharger entièrement — adapté aux connexions limitées. Fichiers jusqu'à 300 Mo, accès protégé par authentification.

### 2.9 Collaboration (👥)
- **📖 Clubs de lecture** : création libre (nom, description, livre du catalogue associé en option), adhésion ouverte, **invitations** entre apprenants (l'invité est notifié).
- **🎓 Groupes d'étude** : même principe, orienté révisions et travail collectif.
- **Discussions** : chaque groupe dispose d'une messagerie (bulles, horodatage, envoi par Entrée), réservée aux membres. Le créateur ou le bibliothécaire peut supprimer un groupe.
- **💬 Commentaires publics** sur chaque livre et chaque ressource ; chacun supprime les siens, le bibliothécaire modère tout.

### 2.10 Motivation et gamification (🏆 Défis de lecture)
- **Certificat de lecture imprimable** (avec le logo Oasis) délivré à la fin de chaque ouvrage.
- **Badges** progressifs : 📗 Premier livre (1), 📚 Lecteur régulier (3), 🏅 Grand lecteur (5), 🏆 Maître lecteur (10).
- **Classement des lecteurs les plus actifs** (top 10, livres terminés et lectures en cours).

### 2.11 Outils d'étude
- **🗒️ Notes et marque-pages** par livre : commentaires personnels, citations à retenir, positions de lecture — **exportables en fichier .txt**.
- **📑 Références bibliographiques** générées automatiquement aux formats **APA, MLA, Chicago et IEEE**, avec copie en un clic.
- **🔗 Partage d'un livre** par lien direct (menu de partage du téléphone ou copie du lien).

### 2.12 Notifications et recommandations
- **🔔 Notifications** avec compteur : retards, échéances à moins de 2 jours, réservations prêtes à retirer, invitations à un groupe, nouveautés du catalogue.
- **⭐ Recommandations personnalisées** calculées à partir des favoris, emprunts et lectures de l'apprenant (ses centres d'intérêt sont affichés).

---

## 3. Espace bibliothécaire

### 3.1 Tableau de bord
Indicateurs en temps réel : titres au catalogue, e-books, titres hybrides, exemplaires disponibles, emprunts en cours, **retards**, réservations à remettre, file d'attente, places réservées du jour, membres, membres actifs (7 jours), lectures en ligne, lectures terminées. S'y ajoutent le **top 5 des livres les plus lus** (lectures, téléchargements, note) et la liste des **retards à relancer**.

### 3.2 Catalogue
- **Ajout d'un livre** avec métadonnées complètes : titre, auteur, catégorie, type (physique / e-book / hybride), année, ISBN, éditeur, langue, niveau scolaire, mots-clés, résumé, icône, couleur, nombre d'exemplaires (cotes générées automatiquement par catégorie : LIT-, MAT-, SCI-…), fichier PDF ou contenu texte.
- **📚 Import multiple de PDF** : sélection de plusieurs fichiers d'un coup ; le titre (et l'auteur si le fichier est nommé `Titre - Auteur.pdf`) est déduit du nom, la **catégorie est déterminée automatiquement** par analyse du titre, la **couverture est générée depuis la première page** — le tout ajustable dans un aperçu avant import.
- **📥 Import CSV / JSON** : import en masse depuis Excel (encodage Windows détecté, séparateurs `;` `,` et tabulation, en-têtes flexibles : Ouvrage, Écrivain, Matière, Quantité…), avec diagnostic des colonnes et classement automatique si la catégorie manque.
- **📄 Gestion des PDF** : joindre, remplacer ou retirer le PDF d'un titre ; régénération de couverture.
- **📕 Exemplaires** : ajout par cote avec état (neuf / bon / usé), retrait protégé si emprunté.
- **🗂️ Catégories personnalisées** : création (nom, icône, couleur) et suppression protégée ; répercussion immédiate sur tous les formulaires et les rayons du portail.

### 3.3 Circulation
- **Emprunts & Retours** : enregistrement au guichet au nom d'un membre, retour (l'exemplaire revient en rayon ou passe au premier de la file d'attente), prolongation, historique.
- **Réservations** : vue des exemplaires **mis de côté** (avec date limite de retrait) et de la file d'attente ; bouton *Remettre au membre* qui transforme la réservation en emprunt.
- **Places de lecture** : plan de la journée par créneau, occupation, annulation.

### 3.4 Contenus
- **Ressources** : ajout d'entrées dans les cinq sections avec icône, image, source et lien.
- **Multimédia** : ajout d'un média (type, titre, auteur/réalisateur/source, thème, langue, lieu/échelle, durée, description) et téléversement du fichier (jusqu'à 300 Mo, en flux direct), compteur de lectures.

### 3.5 Membres
Inscription des apprenants (nom, email, classe, mot de passe initial), suivi des emprunts actifs de chacun.

### 3.6 Journal et sauvegarde
- **📜 Journal des activités** : les 100 derniers événements (emprunts, retours, réservations, lectures terminées, ajouts et suppressions, clubs créés, sauvegardes) horodatés avec l'utilisateur concerné.
- **⬇ Sauvegarde complète** : téléchargement de la base de données en un clic depuis les Paramètres, pour archivage ou restauration.

### 3.7 ⚙️ Paramètres
Tout se configure sans toucher au code :
- **Identité** : nom de la bibliothèque (en-tête, onglet, logo, certificats), slogan, message de bienvenue, texte « À propos », ligne de copyright.
- **Coordonnées** : adresse, téléphone, email, horaires (affichés au pied de page et dans À propos).
- **Règles** : durées d'emprunt physique et numérique, nombre maximal d'emprunts par membre, délai de retrait des réservations.
- **Salle de lecture** : nombre de places et créneaux horaires (un par ligne, 8 maximum).

---

## 4. Caractéristiques techniques

- **Stack** : Node.js pur (≥ 16), **zéro dépendance npm**, base de données JSON avec migrations automatiques — les mises à jour préservent les données existantes.
- **PWA** installable sur mobile, interface responsive, stratégie réseau-d'abord (les mises à jour s'affichent sans vider le cache).
- **Fichiers** : PDF de livres (30 Mo), images de couvertures et de ressources (3 Mo), médias audio/vidéo/cartes (300 Mo) reçus en flux direct ; streaming par plages HTTP pour l'audio et la vidéo.
- **Déploiement** : `node server.js` en local ou sur un hébergeur (port via `PORT`), utilisable sur le réseau local d'un établissement via l'adresse IP du serveur.
- **Design ancré dans le contexte haïtien** : interface en français, contenus en créole pris en charge (langues : Français, Créole haïtien, Anglais, Espagnol), fonctionnement pensé pour les connexions limitées.

---

## 5. Feuille de route

Prochaines étapes possibles (voir `FEUILLE-DE-ROUTE.md`) : assistant IA Oasis (questions/réponses sur les ouvrages, résumés, quiz, explications simplifiées), traduction instantanée, génération automatique de métadonnées — via une clé API et une connexion Internet ; OCR des documents numérisés, visionneuse EPUB, playlists, discussions en temps réel, diffusion en direct.

---
*Oasis Centre numérique d'apprentissage © 2026 — Documentation v3.1*

## Catalogue public et abonnements PLOP PLOP

Le catalogue est public. Sans abonnement actif, les PDF sont servis comme un nouveau fichier contenant au maximum les cinq premières pages ; le fichier complet reste protégé côté serveur. Le texte dispose d’un extrait limité à cinq segments de 2 500 caractères. Un EPUB n’a pas de pagination fixe : son téléchargement complet exige un abonnement, sans aperçu paginé. Les PDF chiffrés incompatibles avec l’extraction affichent un message explicite.

Tarifs fixes côté serveur : **500 HTG pour un mois**, **5 000 HTG pour une année**. Ce sont des accès à durée déterminée, sans prélèvement automatique. Un renouvellement prolonge l’échéance existante. L’administrateur conserve l’accès complet.

Dans les variables d’environnement Render, renseigner `PLOP_CLIENT_ID` et `PLOP_CLIENT_SECRET` avec les identifiants marchands PLOP PLOP, puis redémarrer le service. `PLOP_HOTE` est facultatif (par défaut `plopplop.solutionip.app`). Ne jamais mettre les secrets dans les fichiers publics. Documentation de la passerelle : https://plopplop.solutionip.app/paiement-doc.

Le paiement s’ouvre dans un onglet/fenêtre distinct. Garder l’onglet OASIS ouvert : il interroge la confirmation serveur toutes les cinq secondes pendant dix minutes et redirige vers **Mon espace** après confirmation. En cas d’interruption, revenir à Abonnement et utiliser « Vérifier mon paiement ». L’URL de retour ou une déclaration du navigateur ne suffit jamais à activer l’abonnement : la vérification PLOP PLOP doit retourner une transaction payée. Les commandes et échéances sont enregistrées dans `data/db.json`, à conserver sur le disque persistant avec les documents existants.

Validation automatisée : catalogue anonyme, aperçu PDF de cinq pages à partir d’un fichier de huit pages, refus d’accès complet sans abonnement, tarifs non modifiables par le client, isolation des commandes et activation idempotente. Les tests du paiement utilisent une passerelle simulée ; effectuer un paiement réel de validation après configuration des identifiants marchands.

## Retrait de Pédagogie & diffusion
Les cinq rubriques, les raccourcis d’accueil et la gestion administrateur ont été retirés. Les anciennes routes Diffusion ne sont plus actives. Les données existantes dans le disque persistant ne sont pas supprimées.

## Lecteur EPUB intégré
Les abonnés et administrateurs peuvent ouvrir un EPUB directement dans le navigateur. Navigation par chapitre et taille de texte réglable. Les chapitres sont affichés dans une iframe isolée ; scripts et accès réseau externes sont bloqués. Les EPUB protégés par DRM ne sont pas pris en charge.
