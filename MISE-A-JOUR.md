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
