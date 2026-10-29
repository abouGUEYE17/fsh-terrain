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
| `web/` | L'application elle-même (HTML, CSS, JavaScript, sans compilation). |
| `apps-script/` | Le service qui écrit dans le Drive (à copier dans Google Apps Script). **Ne pas publier ce dossier** : il contient le code d'accès. |
| `desktop/` | Lanceur des versions Windows et Mac (Electron). |
| `native/android/` | Icônes et écran de démarrage de l'APK. |
| `scripts/` | Préparation du projet Android (permissions GPS et appareil photo, version, icônes). |
| `.github/workflows/build.yml` | Compilation automatique de l'APK, du .exe et du .dmg sur GitHub. |

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

Le plus simple est d'installer l'**APK** (voir plus bas). Sinon, depuis la version web :


1. Ouvrir l'adresse de l'application dans **Chrome**.
2. Ouvrir le menu ⋮ puis choisir **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Au premier lancement, ouvrir **Paramètres** :
   - nom, profil (Relais / Coordonnateur / Administrateur), zone ;
   - **adresse du service** : l'URL `/exec` de l'étape 1 ;
   - **code d'accès** : le `CODE_ACCES` choisi ;
   - cliquer sur **Tester la connexion**, puis sur **Enregistrer**.

L'application peut ensuite s'ouvrir et servir sans réseau. Les mêmes réglages de **Paramètres** s'appliquent à l'APK et au .exe.

## Télécharger l'APK Android, le .exe Windows et le .dmg Mac

À chaque modification envoyée sur la branche `main`, GitHub compile automatiquement :

| Fichier | Pour qui | Installation |
| --- | --- | --- |
| `FSH-Terrain-1.0.N.apk` | Téléphones et tablettes Android (Android 6 ou plus récent) | Ouvrir le fichier sur le téléphone et autoriser « Installer des applis inconnues » |
| `FSH-Terrain-Installation-1.0.N.exe` | Ordinateurs Windows 10/11 | Double-cliquer ; un raccourci « FSH Terrain » est créé sur le bureau |
| `FSH-Terrain-Portable-1.0.N.exe` | Ordinateurs Windows, sans droits d'installation | Double-cliquer ; l'application se lance directement |
| `FSH-Terrain-1.0.N-Mac.dmg` | Mac (Intel et Apple Silicon M1 à M4), macOS 12 ou plus récent | Ouvrir le .dmg et glisser « FSH Terrain » dans le dossier Applications |

Les fichiers se trouvent dans l'onglet **Releases** du dépôt GitHub (dernière version en haut). Si la compilation échoue, le détail est dans l'onglet **Actions**.

À savoir :

- L'APK, le .exe et le .dmg contiennent toute l'application : ils fonctionnent sans connexion dès l'installation, sans hébergement.
- Windows peut afficher « Windows a protégé votre ordinateur », car le .exe n'est pas signé par un certificat payant. Cliquer sur **Informations complémentaires**, puis sur **Exécuter quand même**.
- Sur Mac, l'application n'est pas certifiée par Apple (certificat payant de 99 $/an). Au premier lancement, macOS indique qu'il ne peut pas vérifier le développeur. Ouvrir **Réglages Système → Confidentialité et sécurité**, puis cliquer sur **Ouvrir quand même** en face de « FSH Terrain ». Si macOS indique que l'application « est endommagée », ouvrir le Terminal et taper `xattr -cr "/Applications/FSH Terrain.app"`, puis relancer l'application.
- **Signature de l'APK** : pour que chaque mise à jour s'installe par-dessus l'ancienne version et conserve les fiches non envoyées, toutes les versions doivent être signées avec la même clé. Cette clé n'est pas dans le dépôt. Elle est lue dans deux secrets GitHub, à créer une fois dans **Settings → Secrets and variables → Actions → New repository secret** :
  - `ANDROID_KEYSTORE_BASE64` : le contenu du fichier `ANDROID_KEYSTORE_BASE64.txt` ;
  - `ANDROID_KEYSTORE_PASSWORD` : le contenu du fichier `ANDROID_KEYSTORE_PASSWORD.txt`.

  Sans ces secrets, GitHub produit un `FSH-Terrain-1.0.N-test.apk`, signé avec une clé temporaire qui change à chaque compilation. Il convient pour essayer l'application, mais pas pour les relais : chaque mise à jour obligerait à désinstaller l'application, et les fiches non envoyées seraient perdues. **Conserver la clé `fsh-terrain.jks` et son mot de passe en lieu sûr** : sans elle, aucune mise à jour de l'APK ne sera possible.
- Sur ordinateur (Windows et Mac), la localisation GPS n'est généralement pas disponible : ce champ est facultatif.

### Compiler soi-même (facultatif)

- **Android** (avec Android Studio et le SDK installés) : `npm install`, puis `npm run android:add` et `npx cap open android`.
- **Windows** : `npm install`, puis `npm run build:windows`. Les fichiers sont créés dans `dist-desktop/`.
- **Mac** (sur un Mac) : `npm install`, puis `npm run build:mac`.

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
