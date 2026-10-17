/**
 * GSF — Réception des demandes : configuration.
 * Les identifiants de vos fichiers sont dans Identifiants.gs (fichier à ne pas remplacer).
 */
const CONFIG = {
  TYPES: {
    assistance: {
      label: 'Aide',
      prefix: 'GSF',                                  // matricule : GSF_AAAAMMJJ_00001
      folderKey: 'dossierAide',                       // → Identifiants.gs
      responseSheetKey: 'reponsesAide',               // → Identifiants.gs
      // Questions (intitulé exact, 1re ligne) servant à retrouver le dossier.
      contacts: { email: 'Email', telephone: 'Tel (WhatsApp)' },
      // Formulaire rempli par une tierce personne : on utilise alors ses coordonnées à elle.
      thirdParty: {
        question: 'Je fais la demande pour',
        answer: "Un membre de Tontard en tant qu'Ayant droit",
        email: 'E-mail',
        telephone: 'N° Tel',
      },
    },
    pret: {
      label: 'Prêt',
      prefix: 'PAFIS',                                // matricule : PAFIS_AAAAMMJJ_00001
      folderKey: 'dossierPret',                       // → Identifiants.gs
      responseSheetKey: 'reponsesPret',               // → Identifiants.gs
      contacts: { email: 'Adresse email', telephone: 'Votre numéro WhatsApp' },
    },
  },

  // Colonne du fichier de réponses où le script inscrit le matricule (créée si absente).
  MATRICULE_HEADER: 'Matricule du dossier',

  // Dépôt des documents (doit correspondre à web/src/config.js).
  MAX_FILE_MB: 10,
  MAX_FILES: 15,
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'],

  /**
   * Circuit des demandes d'aide (fichier de réponses du formulaire d'aide).
   * Les colonnes sont associées par leur nom : l'ordre des colonnes n'a pas d'importance.
   */
  CIRCUIT_AIDE: {
    // Feuille du fichier de réponses d'aide qui reçoit les nouvelles demandes.
    sheetNewFiles: 'Nouveaux dossiers',

    // Colonnes de « Formulaire » non recopiées dans « Nouveaux dossiers » (début de l'intitulé).
    excludedColumns: ['Déclaration du membre'],

    // Colonnes qui portent un autre nom dans les feuilles de destination :
    // { colonne de destination : [noms possibles dans la feuille d'origine] }
    columnAliases: {
      'Date de réception': ['Timestamp', 'Horodateur'],
    },

    // Colonne de décision des analystes dans « Nouveaux dossiers ».
    statusHeader: 'Statut',
    defaultStatus: "En cours d'examen",

    // Dans les feuilles de destination, la colonne « Statut » s'appelle « Statut analyse ».
    statusHeaderElsewhere: 'Statut analyse',

    /**
     * Que faire quand l'analyste choisit un statut :
     *  - targets : feuilles où copier le dossier. file : 'finance' (fichier Finance), 'archives'
     *    (fichier des archives) ; sans file = fichier de réponses d'aide.
     *    defaults : valeurs posées à l'arrivée du dossier dans la feuille.
     *  - dateHeader : colonne remplie avec la date du jour dans ces feuilles
     */
    statusRules: [
      {
        status: 'Validé',
        dateHeader: 'Date de validation',
        targets: [
          { sheet: 'Dossiers Validés' },
          { file: 'finance', sheet: 'Aides', defaults: { 'Status': 'En Attente', 'Archiver le dossier': 'Pas encore' } },
        ],
      },
      {
        status: 'Refusé',
        dateHeader: 'Date de refus',
        targets: [{ sheet: 'Dossiers refusés', defaults: { 'Archiver le dossier': 'Pas encore' } }],
      },
    ],

    /**
     * Archivage : quand « Archiver le dossier » passe à « Oui » dans l'une des feuilles `sources`,
     * le dossier est copié dans la feuille d'archives associée (`archive`), puis retiré de `removeFrom`.
     * Il reste dans la feuille source.
     * `requires` : condition à remplir pour archiver ; sinon « Archiver le dossier » repasse à `notYet`.
     * `dateHeader` est rempli avec la date du jour, si cette colonne existe dans la feuille d'archives.
     */
    archiving: {
      column: 'Archiver le dossier',
      yes: 'Oui',
      notYet: 'Pas encore',
      sources: [
        { sheet: 'Dossiers refusés', archive: { file: 'archives', sheet: 'Aides refusées' } },
        {
          file: 'finance', sheet: 'Aides', archive: { file: 'archives', sheet: 'Aides validées' },
          requires: { column: 'Status', value: 'Clôturé' },
        },
      ],
      removeFrom: { sheet: 'Nouveaux dossiers' },
      dateHeader: "Date d'archivage",

      // Le dossier Drive du matricule (documents) est déplacé dans ce dossier, cherché à côté du fichier
      // des archives (ou désigné par « dossierDocumentsAides » dans Identifiants).
      documentsFolderName: 'Documents Aides',
    },
  },
};
