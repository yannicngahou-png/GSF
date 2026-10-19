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
| [apps-script/Identifiants.gs](apps-script/Identifiants.gs) | ⚠ Vos identifiants : fichiers de réponses, fichier Finance, dossiers Drive. **À ne jamais remplacer** |
| [apps-script/Config.gs](apps-script/Config.gs) | Préfixes des matricules, questions du formulaire, circuit des cellules |
| [apps-script/Installation.gs](apps-script/Installation.gs) | `installer()` : vérifie les accès et pose les déclencheurs |
| [apps-script/Reception.gs](apps-script/Reception.gs) | À l'envoi d'un formulaire : matricule + dossier Drive |
| [apps-script/Depot.gs](apps-script/Depot.gs) | Web app de l'espace de dépôt des documents |
| [apps-script/CircuitAide.gs](apps-script/CircuitAide.gs) | Règles du circuit des demandes d'aide |
| [apps-script/CircuitPret.gs](apps-script/CircuitPret.gs) | Règles du circuit des demandes de prêt |
| [apps-script/MoteurCircuits.gs](apps-script/MoteurCircuits.gs) | Moteur commun qui applique les règles des deux circuits |
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

## Circuit des demandes d'aide

```
Fichier de réponses « aide »                                         Fichier Finance
──────────────────────────────────────────────────────────           ───────────────
Formulaire ──(à l'envoi)──► Nouveaux dossiers                        
                            Statut : En cours d'examen ▾
                                     Pièces attendues
                                     Validé ─────────┬──► Dossiers Validés
                                       │             └──────────────────────────► Aides
                                       │               + « Statut analyse » = Validé
                                       │               + « Date de validation » = date du jour
                                     Refusé ──────────► Dossiers refusés
                                                       + « Statut analyse » = Refusé
                                                       + « Date de refus » = date du jour
```

- **À l'arrivée d'une réponse** : la ligne de « Formulaire » est copiée dans « Nouveaux dossiers », sauf la colonne
  « Déclaration du membre… », avec le statut « En cours d'examen ».
- **Quand un analyste choisit « Validé »** : la ligne de « Nouveaux dossiers » est copiée dans « Dossiers Validés »
  et dans la feuille « Aides » du fichier Finance. La colonne « Statut » y devient « Statut analyse », et la date
  de validation est ajoutée automatiquement.
- **Quand un analyste choisit « Refusé »** : la ligne est copiée dans « Dossiers refusés », avec « Statut analyse »
  et la date de refus.
- Les colonnes sont associées **par leur nom**, quel que soit leur ordre. Les colonnes sans équivalent (analystes,
  finance) ne sont jamais écrasées. `installer` affiche dans le journal la liste de ces colonnes.
- Un dossier n'est jamais copié deux fois dans une même feuille (contrôle sur le matricule).
- La ligne reste dans « Nouveaux dossiers » après la décision. Si l'analyste passe de « Validé » à « Refusé », ou
  l'inverse, le dossier est **retiré** des feuilles de l'ancienne décision (y compris « Aides » côté Finance) et copié
  dans celles de la nouvelle, avec une nouvelle date. Un retour à « En cours d'examen » ou « Pièces attendues »
  ne retire rien.
- **Archivage** : quand « Archiver le dossier » passe à **« Oui »**, le dossier est copié dans le **fichier des
  Archives**, puis retiré de « Nouveaux dossiers ». Il reste dans la feuille où « Oui » a été choisi.
  - « Dossiers refusés » → feuille **« Aides refusées »** des Archives ;
  - « Aides » (Finance) → feuille **« Aides validées »** des Archives, **seulement si « Status » = « Clôturé »**.
    Sinon, « Archiver le dossier » repasse à « Pas encore », avec une note qui explique pourquoi.

  La date d'archivage est notée si la colonne « Date d'archivage » existe dans la feuille d'archives.
  Le **dossier Drive du matricule** (les documents) est **déplacé** dans le dossier « Documents Aides », placé
  dans le même dossier que le fichier des Archives (ou désigné par `dossierDocumentsAides` dans Identifiants).
  Ses liens restent valides après le déplacement.
- **Valeurs par défaut** à l'arrivée d'un dossier : « Archiver le dossier » = « Pas encore » (Dossiers refusés,
  Aides Finance) et « Status » = « En Attente » (Aides Finance).
- **« Date de réception »** reprend le « Timestamp » de « Formulaire » (réglage `COLUMN_ALIASES`). Les accents et
  les majuscules ne comptent pas dans les noms de colonnes.

Réglages : [CircuitAide.gs](apps-script/CircuitAide.gs).

## Circuit des demandes de prêt

```
Demande de prêts › Formulaire ──(à l'envoi)──► ANALYSE › Nouveaux dossiers (Status Analyse = En cours d'examen)

ANALYSE › Nouveaux dossiers ── Status Analyse ─┬─ Validé ─► Dossiers validés ── Passer à la Cellule verification = Oui ─► VÉRIFICATION › Nouveaux dossiers
                                               └─ Rejeté ─► Dossiers rejetés ── Archiver = Oui ─► ARCHIVES › Prêts refusés

VÉRIFICATION › Nouveaux dossiers ── Statuts Vérification ─┬─ Validé ─► Dossiers validés ── Passer à la cellule finance = Oui ─► FINANCE › Prêts
                                                          └─ Rejeté ─► Dossiers rejetés ── Archiver = Oui ─► ARCHIVES › Prêts refusés

FINANCE › Prêts ── Passer à la cellule Suivi = Oui ─► SUIVI › Nouveaux dossiers ── Archiver = Oui ─► ARCHIVES › Prêts validés
                                                                                   (« Date de fin de suivi » obligatoire)
```

- **Décisions** (« Status Analyse », « Statuts Vérification ») : « Validé » ou « Rejeté » (« Refusé » est aussi accepté).
  La date de décision est notée dans « Date de fin d'analyse » / « Date de fin de vérification » si la colonne existe.
  Changer de décision retire le dossier de la feuille de l'ancienne décision.
- **Passages** (« Passer à… » = Oui) : copie dans la cellule suivante, sans condition. À l'arrivée, les colonnes
  « Passer à… » et « Archiver » valent « En attente », et les décisions « En cours d'examen ».
- **Archivage** (« Archiver » = Oui) : copie dans les Archives avec la date d'archivage, retrait de « Nouveaux dossiers »
  d'Analyse **et** de Vérification, et déplacement du dossier Drive `PAFIS_…` dans « Documents Prêts ». Le dossier
  reste dans la feuille où « Oui » a été choisi. Depuis Suivi, « Date de fin de suivi » doit être remplie : sinon
  « Archiver » repasse à « En attente » avec une note.
- « Date de fin de suivi » (Suivi) est reportée dans « Date de fin de suivie » (Archives).
- **« Date de fin d'analyse »** est remplie automatiquement quand l'analyste choisit « Passer à la Cellule
  verification » = Oui. Pour un dossier rejeté, c'est la date du rejet.
- **Nouvelles colonnes** : une colonne ajoutée dans une feuille d'une cellule est **recréée automatiquement**, avec
  son contenu, dans chaque feuille où le dossier passe ensuite, jusqu'aux Archives. Elle est ajoutée à droite du
  tableau. La colonne qui déclenche le passage (« Passer à… ») n'est pas recréée dans la cellule suivante. Un dossier
  déjà transmis avant l'ajout de la colonne n'est pas mis à jour.

Réglages : [CircuitPret.gs](apps-script/CircuitPret.gs). Identifiants des fichiers : `analyse`,
`verification`, `finance`, `suivi`, `archives` dans [Identifiants.gs](apps-script/Identifiants.gs).

## Installation d'Apps Script

1. https://script.google.com → **Nouveau projet** → renommez-le **GSF - Réception**.
2. **Paramètres du projet** (roue dentée) → cochez « Afficher le fichier manifeste "appsscript.json" dans l'éditeur ».
3. Dans l'**Éditeur**, créez les fichiers suivants et collez-y leur contenu. Ne tapez pas l'extension « .gs » :
   Apps Script l'ajoute tout seul.
   - `Code.gs` → renommez-le **Identifiants** → [Identifiants.gs](apps-script/Identifiants.gs)
     (⚠ à remplir une fois, puis **à ne jamais remplacer** lors des mises à jour)
   - **+** → Script → **Config** → [Config.gs](apps-script/Config.gs)
   - **+** → Script → **Installation** → [Installation.gs](apps-script/Installation.gs)
   - **+** → Script → **Reception** → [Reception.gs](apps-script/Reception.gs)
   - **+** → Script → **Depot** → [Depot.gs](apps-script/Depot.gs)
   - **+** → Script → **CircuitAide** → [CircuitAide.gs](apps-script/CircuitAide.gs)
   - **+** → Script → **CircuitPret** → [CircuitPret.gs](apps-script/CircuitPret.gs)
   - **+** → Script → **MoteurCircuits** → [MoteurCircuits.gs](apps-script/MoteurCircuits.gs)
   - `appsscript.json` → remplacez tout le contenu par [appsscript.json](apps-script/appsscript.json)
4. Dans **Identifiants**, collez les identifiants des 2 fichiers de réponses et du fichier Finance. L'identifiant
   est la partie entre `/d/` et `/edit` dans l'adresse du fichier. Enregistrez avec **Ctrl+S**.
5. Choisissez la fonction **`installer`** → **Exécuter** → acceptez les autorisations. Au message « Google n'a pas
   validé cette application » : *Paramètres avancés* → *Accéder à GSF - Réception*.
   Le journal doit afficher vos deux dossiers et vos deux fichiers de réponses, puis « ✅ Installation terminée ».
6. **Test** : envoyez un formulaire de test. Le matricule doit apparaître dans le fichier de réponses, et un dossier
   portant ce matricule doit apparaître dans Drive. En cas d'échec, consultez le menu **Exécutions**.
7. **Déployer** → **Nouveau déploiement** → roue dentée → **Application web** → Exécuter en tant que : **Moi** ·
   Accès : **Tout le monde** → **Déployer** → copiez l'URL qui se termine par `/exec`.

> Après une modification du code de **Depot** : *Déployer → Gérer les déploiements → Modifier → Nouvelle version*.
> Après une modification de **Identifiants** : relancez `installer`.

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
