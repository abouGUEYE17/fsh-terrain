# FSH Terrain – application Android et Web

Application de la Fédération Sénégalaise des Habitants pour :

- saisir les **fiches de collecte** (zone, communauté, observations, statut, position GPS, photo) ;
- enregistrer les **séances de sensibilisation** (thème, participants, compte rendu, justificatif) ;
- **déposer les rapports** (PDF, Word, images – 5 Mo max.).

Elle **fonctionne sans connexion** : chaque fiche est d'abord enregistrée sur le téléphone. Dès que le réseau revient, elle est envoyée automatiquement dans le **Google Drive** du compte administrateur (au retour de la connexion, à l'ouverture de l'application, puis toutes les 2 minutes). Il faut seulement que l'application soit ouverte à ce moment-là.

## Ce qui est créé dans Google Drive

```
FSH – Application terrain/
├── FSH – Base de données terrain    Google Sheets : Tableau de bord, Collectes, Séances, Rapports
├── Rapports/                         fichiers déposés
├── Photos et justificatifs/          photos des fiches et des séances
└── Exports Excel/                    FSH_Donnees_terrain_AAAA-MM-JJ.xlsx (mis à jour chaque heure)
```

Le **Tableau de bord** affiche le nombre de collectes, de séances, de participants et de rapports, ainsi que les fiches à compléter. Il présente aussi un tableau par zone, l'évolution sur 12 mois et deux graphiques. Le classeur Google Sheets est mis à jour à chaque fiche reçue. La copie Excel (.xlsx), avec le même tableau de bord, est régénérée chaque heure dès qu'il y a du nouveau.

## Organisation des fichiers

| Dossier | Contenu |
| --- | --- |
| `web/` | L'application (à héberger). Aucune dépendance, aucune compilation. |
| `apps-script/` | Le service qui écrit dans le Drive (à copier dans Google Apps Script). **Ne pas publier ce dossier** : il contient le code d'accès. |

## Installation (une seule fois, environ 15 minutes)

### 1. Créer le service Google Drive

1. Se connecter à Google avec le compte qui recevra les données (gueyeabou17@gmail.com).
2. Ouvrir <https://script.google.com>, puis cliquer sur **Nouveau projet**. Nommer le projet « FSH Terrain ».
3. Remplacer le contenu de `Code.gs` par celui de [`apps-script/Code.gs`](apps-script/Code.gs).
4. En haut du fichier, **changer `CODE_ACCES`** et choisir un code difficile à deviner. Ce code sera donné aux utilisateurs de l'application.
5. *(Facultatif)* Dans **Paramètres du projet**, cocher « Afficher le fichier manifeste », puis coller [`apps-script/appsscript.json`](apps-script/appsscript.json).
6. Choisir la fonction **`installer`** puis cliquer sur **Exécuter**. Accepter les autorisations demandées (Drive, Sheets). Le dossier, le classeur, le tableau de bord et l'export horaire sont créés.
7. Cliquer sur **Déployer → Nouveau déploiement**, type **Application Web** :
   - Exécuter en tant que : **Moi** ;
   - Qui a accès : **Tout le monde**.
8. Copier l'**URL de l'application Web** (elle se termine par `/exec`).

> Après toute modification de `Code.gs`, il faut publier une nouvelle version : **Déployer → Gérer les déploiements → Modifier → Nouvelle version**. L'URL reste la même.

### 2. Mettre l'application en ligne

L'application doit être servie en **HTTPS**, ce qui est indispensable pour le mode hors ligne. La méthode la plus simple et gratuite :

1. Ouvrir <https://app.netlify.com/drop>.
2. Glisser-déposer le dossier **`web/`**, et seulement celui-là.
3. Récupérer l'adresse fournie (par exemple `https://fsh-terrain.netlify.app`).

GitHub Pages, Vercel ou tout autre hébergement statique en HTTPS fonctionne aussi.

### 3. Installer l'application sur les téléphones Android

1. Ouvrir l'adresse de l'application dans **Chrome**.
2. Ouvrir le menu ⋮ puis choisir **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Au premier lancement, ouvrir **Paramètres** :
   - nom, profil (Relais / Coordonnateur / Administrateur), zone ;
   - **adresse du service** : l'URL `/exec` de l'étape 1 ;
   - **code d'accès** : le `CODE_ACCES` choisi ;
   - cliquer sur **Tester la connexion**, puis sur **Enregistrer**.

L'application peut ensuite s'ouvrir et servir sans réseau. Pour obtenir un vrai fichier APK, on peut passer l'adresse de l'application dans <https://www.pwabuilder.com> (option « Android »).

## Utilisation

- **Accueil** : nombre de fiches sur le téléphone, fiches en attente d'envoi, bouton « Envoyer maintenant » et lien vers le tableau de bord Drive.
- **Nouvelle fiche** : collecte, séance ou rapport. Les champs obligatoires sont contrôlés. Pour une séance, le total des participants se calcule à partir des hommes et des femmes.
- **Mes fiches** : recherche, filtres par type et par état, détail de chaque fiche et export CSV pour Excel. Une fiche non envoyée peut être supprimée.
- Les photos sont réduites (1600 px) avant l'enregistrement pour économiser les données mobiles. Une fois envoyée, une pièce jointe est retirée du téléphone pour libérer de la place.

## Sécurité et fiabilité

- Seules les requêtes portant le bon code d'accès sont acceptées. Pour changer le code, modifier `CODE_ACCES`, publier une nouvelle version, puis mettre à jour le code dans chaque téléphone.
- Une fiche renvoyée après une coupure réseau n'est jamais enregistrée deux fois, grâce à son identifiant unique, par exemple `COL-20261029-7K3F9A`.
- Un texte saisi commençant par `=` est enregistré comme du texte, jamais comme une formule.
- Les données restent dans le Drive de la FSH. Les exports Excel quotidiens servent de sauvegarde.

## Mise à jour de l'application

Après modification des fichiers de `web/`, changer `VERSION` dans `web/sw.js` (par exemple `fsh-terrain-v2`), puis republier le dossier. Les téléphones récupèrent la nouvelle version à la prochaine ouverture avec connexion.
