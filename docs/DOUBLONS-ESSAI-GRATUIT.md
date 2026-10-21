Doublons, classement et essai gratuit — version 1.7.0

DOUBLONS
Ajouter un livre est bloqué lorsque titre, auteur, édition et langue normalisés correspondent à un livre existant, ou lorsque le même ISBN est déjà enregistré. Les accents, espaces et majuscules ne créent pas une nouvelle identité. Des éditions différentes restent distinctes, sauf ISBN identique. Les ressources sont comparées par titre, genre et source ; les médias par titre, type et auteur. Il ne s’agit pas d’une comparaison sémantique. Un nouveau fichier PDF/EPUB identique à un fichier dont l’empreinte a été enregistrée est refusé, même si ses informations ont été changées. Les fichiers anciens sans empreinte restent détectés par leurs métadonnées.

Administration > Catalogue > Détecter les doublons. Le bibliothécaire examine puis fusionne chaque doublon. Les références de lecture, favoris, exemplaires, notes et sélections scolaires sont réaffectées au document conservé. Les lignes redondantes sont archivées dans la base et retirées du catalogue. Les fichiers ne sont pas détruits ; cette opération ne libère donc pas l’espace disque. La fusion est refusée si deux fichiers PDF/EPUB diffèrent, ou si des médias ont des fichiers joints. Examiner alors les versions avant toute suppression manuelle. Faire une sauvegarde avant un nettoyage important.

CLASSEMENT
Catalogue livres, médias et ressources : ordre alphabétique par défaut. Les vues explicitement dédiées aux nouveautés et à la popularité conservent leur classement spécifique.

ESSAI
Un essai gratuit de 30 jours est accordé une seule fois à l’inscription individuelle ou de l’établissement, sans paiement préalable. À la première installation de cette version, les comptes individuels non abonnés et les établissements non abonnés existants reçoivent aussi cet essai. Les comptes d’élèves héritent de l’essai de l’école et ne déclenchent pas des essais individuels successifs. L’essai école utilise la formule et le quota de son espace, par défaut Petite école (100 élèves). Les espaces, lecteurs et suivis sont utilisables pendant l’essai.

Un paiement anticipé est accepté ; sa durée est ajoutée après la fin de l’essai ou après l’échéance payée existante si celle-ci est plus tardive. Une fois l’essai terminé, un paiement confirmé est nécessaire pour continuer l’accès complet ; les comptes et données restent conservés. Un essai ne recommence pas à chaque connexion ou redéploiement.

NOTIFICATIONS
Dans la plateforme : rappel à partir de 7 jours avant la fin, puis message de fin d’essai avec invitation à payer. L’espace école montre aussi cet avertissement. Les clients ayant déjà un abonnement payé actif ne reçoivent pas d’appel à payer.

Courriels Brevo facultatifs, vérifier les paramètres dans Render > Environment :
ESSAI_EMAIL_ACTIVE=true
BREVO_API_KEY=clé API Brevo
BREVO_SENDER_EMAIL=adresse expéditeur vérifiée
SITE_URL=https://votre-site

Les courriels vont au titulaire individuel ou au responsable de l’école, aux étapes 7, 3, 1 jour et expiration. Vérification toutes les heures pendant que le serveur fonctionne, envoi séquentiel limité à 100 courriels par passage. Les étapes manquées ne sont pas toutes envoyées d’un coup ; seul le rappel pertinent est envoyé. Les envois réussis sont enregistrés pour limiter les répétitions. Sans configuration, les notifications internes continuent mais aucun courriel n’est envoyé. Guide API : https://developers.brevo.com/docs/send-a-transactional-email

Les tests utilisent une passerelle et un expéditeur simulés : vérifier les courriels et paiements réels après configuration. Déployer tout le projet sans remplacer data.
