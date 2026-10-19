/**
 * Circuit des demandes d'AIDE (règles appliquées par MoteurCircuits.gs).
 *
 * Formulaire → Nouveaux dossiers ── Statut ─┬─ Validé ─► Dossiers Validés + Aides (Finance)
 *                                           └─ Refusé ─► Dossiers refusés
 * Dossiers refusés ── Archiver le dossier = Oui ─► Archives › Aides refusées
 * Aides (Finance)  ── Archiver le dossier = Oui (si Status = Clôturé) ─► Archives › Aides validées
 *
 * Syntaxe des règles : voir l'en-tête de MoteurCircuits.gs.
 */
function CIRCUIT_AIDE() {
  return {
    type: 'assistance',

    // Le dossier Drive du matricule est déplacé ici à l'archivage (à côté du fichier des archives,
    // ou désigné par la clé `idKey` du fichier Identifiants).
    documents: { folderName: 'Documents Aides', idKey: 'dossierDocumentsAides' },

    entry: {
      excludedColumns: ['Déclaration du membre'],
      target: { file: 'reponsesAide', sheet: 'Nouveaux dossiers', defaults: { 'Statut': "En cours d'examen" } },
    },

    rules: [
      // Décision de l'analyste
      {
        on: { file: 'reponsesAide', sheet: 'Nouveaux dossiers' },
        column: 'Statut',
        exclusive: true,
        renameColumns: { 'Statut': 'Statut analyse' },
        cases: [
          {
            values: ['Validé'],
            dateHeader: 'Date de validation',
            targets: [
              { file: 'reponsesAide', sheet: 'Dossiers Validés' },
              { file: 'finance', sheet: 'Aides', defaults: { 'Status': 'En Attente', 'Archiver le dossier': 'Pas encore' } },
            ],
          },
          {
            values: ['Refusé'],
            dateHeader: 'Date de refus',
            targets: [{ file: 'reponsesAide', sheet: 'Dossiers refusés', defaults: { 'Archiver le dossier': 'Pas encore' } }],
          },
        ],
      },

      // Archivage des aides refusées
      {
        on: { file: 'reponsesAide', sheet: 'Dossiers refusés' },
        column: 'Archiver le dossier',
        cases: [{
          values: ['Oui'],
          dateHeader: "Date d'archivage",
          targets: [{ file: 'archives', sheet: 'Aides refusées' }],
          removeFrom: [{ file: 'reponsesAide', sheet: 'Nouveaux dossiers' }],
          archiveDocuments: true,
        }],
      },

      // Archivage des aides versées (Finance), seulement si le dossier est clôturé
      {
        on: { file: 'finance', sheet: 'Aides' },
        column: 'Archiver le dossier',
        cases: [{
          values: ['Oui'],
          requires: [{ column: 'Status', equals: 'Clôturé' }],
          resetTo: 'Pas encore',
          dateHeader: "Date d'archivage",
          targets: [{ file: 'archives', sheet: 'Aides validées' }],
          removeFrom: [{ file: 'reponsesAide', sheet: 'Nouveaux dossiers' }],
          archiveDocuments: true,
        }],
      },
    ],
  };
}
