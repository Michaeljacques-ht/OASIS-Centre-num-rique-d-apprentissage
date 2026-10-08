# 📖 Oasis Centre numérique d'apprentissage

Plateforme de bibliothèque **numérique et physique** pour les apprenants haïtiens. Node.js pur — **zéro dépendance npm** — base de données JSON, PWA installable.

## 🚀 Démarrage

```bash
node server.js
```

- Portail apprenant : http://localhost:3000
- Espace bibliothécaire : http://localhost:3000/admin

**Comptes de démonstration**
| Rôle | Email | Mot de passe |
|---|---|---|
| Bibliothécaire | admin@oasis.ht | admin123 |
| Apprenant | emma@oasis.ht | demo123 |

La base `data/db.json` est créée automatiquement au premier lancement avec un catalogue de démonstration (13 titres dont *Gouverneurs de la Rosée* de Jacques Roumain). Supprimez ce fichier pour repartir de zéro.

## ✨ Fonctionnalités

### Portail apprenant (conforme à la maquette)
- Accueil avec bannière « Découvrez un Monde de Savoirs ! », Nouveautés, Catégories populaires
- Panneaux latéraux **Lectures Populaires** et **Ma Liste de Lecture**
- Recherche instantanée (titre, auteur, catégorie)
- **E-books** : lecture en ligne dans un lecteur intégré (contenu Markdown)
- **Livres physiques** : emprunt en un clic si un exemplaire est disponible (14 jours)
- Favoris ❤️, liste de lecture 📋, notation ⭐ (moyenne sur 5)
- Mes Emprunts : suivi des échéances, alerte de retard, prolongation +7 jours (2 max)
- Inscription libre des apprenants, sessions par jeton, mots de passe hachés (scrypt)

### Espace bibliothécaire (gestion physique)
- **Tableau de bord** : titres, exemplaires disponibles, emprunts en cours, retards à relancer
- **Emprunts & retours** : enregistrement au guichet au nom d'un membre, retour (l'exemplaire revient en rayon), prolongation, historique
- **Catalogue** : ajout/suppression de livres (physiques ou e-books avec contenu), gestion des **exemplaires** par cote et état (neuf/bon/usé)
- **Membres** : inscription et suivi des emprunts actifs
- Règles métier : 5 emprunts actifs max par membre, cote unique, suppression bloquée si emprunt en cours


### Nouvelles fonctionnalités (v2)
- **Titres hybrides** : un même livre peut être en rayon ET en version numérique ; les deux disponibilités sont affichées et liées (si tous les exemplaires sont sortis, la version numérique reste signalée comme accessible).
- **Réservation de livres** : file d'attente quand tous les exemplaires sont empruntés ; à chaque retour, le premier de la file est servi (exemplaire mis de côté 3 jours, remise au guichet par le bibliothécaire, expiration automatique).
- **Places de lecture** : réservation d'une place assise en salle par date et créneau (12 places, 4 créneaux), gestion et annulation côté bibliothécaire.
- **Ressources documentaires** : dictionnaire, encyclopédie et bases de données consultables par les apprenants, alimentées par le bibliothécaire.
- **Couvertures réelles** : la première page du PDF devient automatiquement la couverture affichée (générée à l'envoi du PDF via pdf.js, repli sur la couverture stylisée hors ligne).
- **Formulaire complet** : type Physique / E-book / Hybride, nombre d'exemplaires à cotes automatiques, fichier PDF joint directement.

### Technique
- Serveur HTTP natif Node.js (≥ 16), API REST en français
- PWA : `manifest.json` + service worker (cache statique, installable sur mobile)
- Interface responsive (mobile → menu latéral coulissant)
- Prêt pour déploiement sur **Render** : `node server.js`, port via `process.env.PORT`

## 📂 Structure

```
oasis-centre-numerique/
├── server.js          # Serveur + API REST + base JSON
├── data/db.json       # Base de données (créée au 1er lancement)
└── public/
    ├── index.html     # Portail apprenant
    ├── app.js
    ├── admin.html     # Espace bibliothécaire
    ├── admin.js
    ├── styles.css
    ├── manifest.json  # PWA
    ├── sw.js          # Service worker
    └── icone.svg
```

## 🔌 API principale

| Méthode | Route | Description |
|---|---|---|
| POST | /api/inscription, /api/connexion | Authentification |
| GET | /api/livres?q=&categorie=&tri= | Catalogue (recherche, filtres) |
| GET | /api/livres/:id/lire | Lecture d'un e-book |
| POST | /api/livres/:id/note | Noter (1–5 étoiles) |
| POST | /api/emprunts | Emprunter (guichet : + membreId) |
| PUT | /api/emprunts/:id/retour | Enregistrer un retour |
| PUT | /api/emprunts/:id/prolonger | Prolonger +7 jours |
| POST | /api/livres/:id/exemplaires | Ajouter un exemplaire (cote) |
| GET | /api/stats, /api/membres | Gestion (bibliothécaire) |

---
Oasis Centre numérique d'apprentissage © 2026 — Haïti 🇭🇹

## 🔄 Mise à jour depuis « EDUCA Bibliothèque Numérique »

Le projet s'appelle désormais **Oasis Centre numérique d'apprentissage**. Pour mettre à jour une installation existante sans perdre de données :

1. Arrêtez le serveur (Ctrl+C).
2. Copiez le dossier `data/` de l'ancien dossier `educa-bibliotheque` dans le nouveau dossier `oasis-centre-numerique`.
3. Lancez `node server.js` depuis le nouveau dossier.

Au premier démarrage, la migration automatique remplace le nom, le slogan, le pied de page et le texte « À propos » **uniquement s'ils étaient restés aux valeurs EDUCA par défaut** (vos personnalisations sont conservées). Les comptes de démonstration deviennent `admin@oasis.ht` et `emma@oasis.ht` (mots de passe inchangés). Tous les livres, emprunts, réservations, groupes et fichiers sont conservés.
