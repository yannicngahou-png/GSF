/**
 * GSF — Réception des demandes : configuration.
 */
const CONFIG = {
  TYPES: {
    assistance: {
      label: 'Aide',
      prefix: 'GSF',                                  // matricule : GSF_AAAAMMJJ_00001
      folderId: '1x_f9iSeLb4i9poJJvGpRm3HVbYliI6Pa',  // dossier Drive des demandes d'aide
      responseSheetId: '',                            // fichier de réponses du formulaire d'aide
      questions: { email: 'Email', telephone: 'Tel (WhatsApp)' },
    },
    pret: {
      label: 'Prêt',
      prefix: 'PAFIS',                                // matricule : PAFIS_AAAAMMJJ_00001
      folderId: '19_njNkG5XTA5SkfeuzIfP6hlaoMzgDTl',  // dossier Drive des demandes de prêt
      responseSheetId: '',                            // fichier de réponses du formulaire de prêt
      questions: { email: 'Adresse email', telephone: 'Votre numéro WhatsApp' },
    },
  },

  // Colonne du fichier de réponses où le script inscrit le matricule (créée si absente).
  MATRICULE_HEADER: 'Matricule du dossier',

  // Dépôt des documents (doit correspondre à web/src/config.js).
  MAX_FILE_MB: 10,
  MAX_FILES: 15,
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'],
};
