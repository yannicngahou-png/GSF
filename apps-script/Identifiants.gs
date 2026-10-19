/**
 * Identifiants de vos fichiers et dossiers Google.
 *  - fichier : partie entre /d/ et /edit dans l'adresse
 *  - dossier : partie après /folders/ dans l'adresse
 *
 * ⚠ Ce fichier est propre à votre installation : NE LE REMPLACEZ PAS lors des mises à jour du code.
 *   Quand une mise à jour ajoute une ligne, ajoutez-la à la main dans votre version.
 */
function IDENTIFIANTS() {
  return {
    // Fichiers de réponses des formulaires
    reponsesAide: '',
    reponsesPret: '',

    // Fichiers des cellules
    analyse: '',        // Cellule analyse (prêts)
    verification: '',   // Cellule vérification (prêts)
    finance: '',        // Cellule finance (aides et prêts)
    suivi: '',          // Cellule suivi (prêts)

    // Fichier des archives (Global Social Funds)
    archives: '',

    // Dossiers Drive qui reçoivent un dossier par matricule
    dossierAide: '1x_f9iSeLb4i9poJJvGpRm3HVbYliI6Pa',
    dossierPret: '19_njNkG5XTA5SkfeuzIfP6hlaoMzgDTl',

    // Facultatif : dossiers d'archives des documents. Vides = cherchés à côté du fichier des archives.
    dossierDocumentsAides: '',
    dossierDocumentsPrets: '',
  };
}
