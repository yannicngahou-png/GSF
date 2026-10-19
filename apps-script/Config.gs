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
  MAX_FILES: 30,
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'],

  // Colonnes qui portent un autre nom dans la feuille de destination :
  // { colonne de destination : [noms possibles dans la feuille d'origine] }
  COLUMN_ALIASES: {
    'Date de réception': ['Timestamp', 'Horodateur'],
    'Date de fin de suivie': ['Date de fin de suivi'],
  },

  // Les circuits entre cellules sont dans CircuitAide.gs et CircuitPret.gs.
};
