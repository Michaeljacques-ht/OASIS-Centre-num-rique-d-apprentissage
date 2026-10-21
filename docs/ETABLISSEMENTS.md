# OASIS — Espace établissement

## Mise en route

1. Déployer le projet complet puis redémarrer le service Render avec `npm start`.
2. Depuis l’accueil public, cliquer sur « Créer un espace établissement », ou ouvrir `/ecole?inscription=1`.
3. Inscrire l’école et son responsable avec un email distinct des comptes existants. Ce compte a le rôle administrateur établissement, sans droits d’administration globale OASIS.
4. Dans Personnalisation, renseigner l’adresse, la présentation et les coordonnées, puis ajouter un logo et une bannière PNG/JPEG (5 Mo maximum).
5. Dans Abonnement, régler le tarif de la formule choisie par an avec PLOP PLOP. Seul l’administrateur de l’école peut effectuer ce paiement.
6. Après confirmation côté serveur, inscrire les élèves et, si nécessaire, un ou plusieurs bibliothécaires de l’école. Transmettre leurs identifiants par le canal habituel de l’école.
7. Sélectionner des livres du catalogue OASIS et attribuer des lectures à une classe, avec une échéance facultative.

## Accès et renouvellement

La passerelle utilise les mêmes variables `PLOP_CLIENT_ID`, `PLOP_CLIENT_SECRET` et `PLOP_HOTE` que les abonnements individuels. Aucun identifiant marchand n’est fourni dans le projet. Les paiements réels dépendent de la configuration du compte marchand.

L’abonnement établissement est annuel, sans prélèvement automatique. Le serveur fixe le montant selon la formule (50 000 / 100 000 / 150 000 HTG), vérifie la confirmation PLOP PLOP et prolonge l’établissement une seule fois par commande. Avant expiration, la nouvelle année s’ajoute à la durée restante. Après expiration, elle commence à la confirmation.

Les comptes actifs rattachés à une école abonnée bénéficient de l’accès complet à la bibliothèque OASIS. Lorsque l’abonnement expire, la gestion des membres et le suivi sont bloqués, et l’accès complet lié à l’école prend fin. Les comptes et les données sont conservés pour le renouvellement. La personnalisation et la page de paiement restent accessibles. Un abonnement individuel valide conserve ses propres droits de lecture.

## Droits

- Administrateur établissement : personnalisation, abonnement, élèves, comptes bibliothécaires, sélection et consignes, suivi.
- Bibliothécaire d’école : personnalisation, élèves, sélection et consignes, suivi. Il ne crée pas d’autres bibliothécaires et ne règle pas l’abonnement établissement.
- Élève : livres sélectionnés, consignes de sa classe et lecteurs OASIS. Il ne consulte pas la liste des comptes ni le suivi d’autres élèves.
- Bibliothécaire global OASIS : administration globale existante, distincte des responsables d’établissement.

Les opérations d’établissement déduisent l’école du compte connecté. L’identifiant d’école envoyé dans un formulaire ne permet pas d’administrer une autre école. La désactivation d’un membre invalide ses sessions ; les mots de passe sont hachés par le serveur.

## Suivi

Le suivi affiche les livres commencés, les pourcentages, les livres marqués terminés et la position des contenus multimédias. Les PDF enregistrent la progression à chaque page affichée ; les EPUB à chaque chapitre affiché. Les indicateurs décrivent la navigation dans le lecteur et ne prouvent pas la compréhension du document. Les lectures effectuées après téléchargement dans une autre application ne sont pas suivies.

La bibliothèque scolaire est une sélection du catalogue partagé OASIS. Cette version ne fournit pas de dépôt privé de documents propres à une école. Les progressions des élèves et les listes de comptes sont accessibles uniquement aux responsables de leur école via les routes établissement.

## Données et contrôles

Conserver le disque persistant et le dossier `data` existant lors du déploiement. Les établissements, rattachements, consignes et expirations sont enregistrés dans `data/db.json`; les logos et bannières sont dans `data/ecoles`.

`npm test` vérifie le serveur, les abonnements individuels et les établissements : tarifs imposés et plafonds d’élèves actifs, activation, idempotence, expiration, rôles, refus des opérations sur une autre école, sélection et suivi.

## Formules établissement

| Formule | Élèves actifs maximum | Tarif annuel |
|---|---:|---:|
| Petite école | 100 | 50 000 HTG |
| École moyenne | 300 | 100 000 HTG |
| Grande école | 600 | 150 000 HTG |
| Réseau scolaire / université | Plus de 600 | Sur devis |

Les bibliothécaires et l’administrateur ne consomment pas de place. Les comptes élèves désactivés conservent leur historique mais ne consomment plus de place ; leur réactivation respecte le plafond. La vérification s’effectue sur le serveur.

L’augmentation de formule est facturée au tarif annuel complet ; elle active le nouveau plafond et ajoute un an à la durée restante, sans prorata. Le prix est affiché avant l’ouverture de PLOP PLOP. Une baisse de formule est autorisée après expiration avec un effectif compatible. Les anciens établissements conservent au minimum leur effectif actif existant jusqu’à expiration ; leur renouvellement doit couvrir cet effectif. Aucun élève existant n’est supprimé automatiquement.

Les demandes pour plus de 600 élèves sont enregistrées et visibles dans le tableau de bord de l’administration OASIS. Elles n’activent pas automatiquement un abonnement et ne déclenchent pas de message externe. Le devis doit être traité par OASIS. Assistance standard incluse ; formation et personnalisation importante sur devis séparé.
