# GSF — Réception des demandes de financement

Étape 1 : la réception des informations (Google Forms) et des documents (landing page), regroupés sous un matricule.

```
Landing page (Vercel)                 Google Apps Script                     Google Drive
─────────────────────                 ──────────────────                     ────────────
[Demande d'assistance] ─► Google Form ─► fichier de réponses ─► onFormSubmitHandler :
[Demande de prêt]      ─► Google Form ─┘                         • matricule ──► colonne « Matricule du dossier »
                                                                 • dossier   ──► Dossier aide|prêt / PAFIS_20261016_00001/

[Déposer mes documents] : email + n° WhatsApp ─► matricule affiché ─► documents ──► dossier du matricule
```

## Structure

| Fichier | Rôle |
|---|---|
| [apps-script/Config.gs](apps-script/Config.gs) | Dossiers Drive, fichiers de réponses, préfixes des matricules |
| [apps-script/Installation.gs](apps-script/Installation.gs) | `installer()` : vérifie les accès et pose les déclencheurs |
| [apps-script/Reception.gs](apps-script/Reception.gs) | À l'envoi d'un formulaire : matricule + dossier Drive |
| [apps-script/Depot.gs](apps-script/Depot.gs) | Web app de l'espace de dépôt des documents |
| [web/src/content.js](web/src/content.js) | ✏️ Textes, couleurs, logo de la landing page |
| [web/src/config.js](web/src/config.js) | Liens des formulaires, limites de téléversement |
| [plus-tard/](plus-tard/) | Ébauche du circuit entre cellules (inutilisée pour l'instant) |

## Fonctionnement

1. Le demandeur clique sur **Demande d'assistance** ou **Demande de prêt** et remplit le Google Form.
2. À l'envoi, le script :
   - attribue le matricule `GSF_AAAAMMJJ_00001` (aide) ou `PAFIS_AAAAMMJJ_00001` (prêt), avec la date
     d'envoi du formulaire et un compteur par type qui augmente à chaque souscription ;
   - l'inscrit dans la colonne **« Matricule du dossier »** du fichier de réponses, sur la ligne de la réponse ;
   - crée le dossier **portant le matricule** dans le dossier Drive aide ou prêt.
3. Le message de confirmation du formulaire l'invite à aller dans **Déposer mes documents** sur la landing page.
4. Il s'identifie avec l'**email** et le **numéro WhatsApp** saisis dans le formulaire. Son **matricule s'affiche**,
   puis il dépose ses documents, qui arrivent dans le dossier du matricule.

Aucun email n'est envoyé. Les informations restent dans les fichiers de réponses des formulaires.

## Installation d'Apps Script

1. https://script.google.com → **Nouveau projet** → renommez-le **GSF - Réception**.
2. **Paramètres du projet** (roue dentée) → cochez « Afficher le fichier manifeste "appsscript.json" dans l'éditeur ».
3. Dans l'**Éditeur**, créez les fichiers suivants et collez-y leur contenu. Ne tapez pas l'extension « .gs » :
   Apps Script l'ajoute tout seul.
   - `Code.gs` → renommez-le **Config** → [Config.gs](apps-script/Config.gs)
   - **+** → Script → **Installation** → [Installation.gs](apps-script/Installation.gs)
   - **+** → Script → **Reception** → [Reception.gs](apps-script/Reception.gs)
   - **+** → Script → **Depot** → [Depot.gs](apps-script/Depot.gs)
   - `appsscript.json` → remplacez tout le contenu par [appsscript.json](apps-script/appsscript.json)
4. Dans **Config**, collez l'identifiant de chaque fichier de réponses dans `responseSheetId`. Pour le trouver :
   formulaire → *Réponses* → *Afficher dans Sheets* → c'est la partie entre `/d/` et `/edit` dans l'adresse.
   Enregistrez avec **Ctrl+S**.
5. Choisissez la fonction **`installer`** → **Exécuter** → acceptez les autorisations. Au message « Google n'a pas
   validé cette application » : *Paramètres avancés* → *Accéder à GSF - Réception*.
   Le journal doit afficher vos deux dossiers et vos deux fichiers de réponses, puis « ✅ Installation terminée ».
6. **Test** : envoyez un formulaire de test. Le matricule doit apparaître dans le fichier de réponses, et un dossier
   portant ce matricule doit apparaître dans Drive. En cas d'échec, consultez le menu **Exécutions**.
7. **Déployer** → **Nouveau déploiement** → roue dentée → **Application web** → Exécuter en tant que : **Moi** ·
   Accès : **Tout le monde** → **Déployer** → copiez l'URL qui se termine par `/exec`.

> Après une modification du code de **Depot** : *Déployer → Gérer les déploiements → Modifier → Nouvelle version*.
> Après une modification de `responseSheetId` : relancez `installer`.

## Formulaires

- Supprimez la question « Matricule du dossier ». Sa colonne reste dans le fichier de réponses, et le script y
  écrit le matricule. Si la colonne n'existe pas, le script la crée.
- *Paramètres → Présentation → Message de confirmation*, par exemple : « Merci ! Pour obtenir votre matricule de
  dossier et déposer vos documents, rendez-vous sur https://VOTRE-SITE.vercel.app/?depot avec l'email et le
  numéro WhatsApp saisis dans ce formulaire. »

## Landing page

En local (prérequis : [Node.js](https://nodejs.org) 18 ou plus) :

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Sans `VITE_APPS_SCRIPT_URL`, la page tourne en **mode démo** et rien n'est envoyé. Pour la brancher sur Apps Script,
créez `web/.env.local` contenant `VITE_APPS_SCRIPT_URL=URL_/exec`.

Sur Vercel : importez le dépôt → **Root Directory : `web`** → variable d'environnement `VITE_APPS_SCRIPT_URL` →
*Deploy*.

## Sécurité et limites

- Pour accéder à un dossier, il faut l'email **et** le numéro WhatsApp donnés dans le formulaire. Le numéro est
  comparé sur ses 9 derniers chiffres (`+237`, `00237`, espaces… sont tolérés).
- Limites : 10 Mo par fichier et 15 fichiers par dossier. Pour les changer, modifiez `Config.gs` **et**
  `web/src/config.js`.
- Les dossiers et documents créés occupent l'espace de stockage du compte qui installe le script.
