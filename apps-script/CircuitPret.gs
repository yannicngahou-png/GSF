/**
 * Circuit des demandes de PRÊT (règles appliquées par MoteurCircuits.gs).
 *
 * Formulaire ─► ANALYSE › Nouveaux dossiers ── Status Analyse ─┬─ Validé ─► Dossiers validés ── Passer = Oui ─► VÉRIFICATION
 *                                                              └─ Rejeté ─► Dossiers rejetés ── Archiver = Oui ─► Archives › Prêts refusés
 * VÉRIFICATION › Nouveaux dossiers ── Statuts Vérification ─┬─ Validé ─► Dossiers validés ── Passer = Oui ─► FINANCE › Prêts
 *                                                           └─ Rejeté ─► Dossiers rejetés ── Archiver = Oui ─► Archives › Prêts refusés
 * FINANCE › Prêts ── Passer = Oui ─► SUIVI › Nouveaux dossiers ── Archiver = Oui (si date de fin de suivi) ─► Archives › Prêts validés
 *
 * Syntaxe des règles : voir l'en-tête de MoteurCircuits.gs.
 */
function CIRCUIT_PRET() {
  // À l'archivage : le dossier quitte les « Nouveaux dossiers » d'Analyse et de Vérification.
  const nouveauxDossiers = [
    { file: 'analyse', sheet: 'Nouveaux dossiers' },
    { file: 'verification', sheet: 'Nouveaux dossiers' },
  ];

  return {
    type: 'pret',

    // Une colonne ajoutée dans une cellule est recréée (avec son contenu) dans les cellules suivantes.
    propagateNewColumns: true,

    // Le dossier Drive du matricule est déplacé ici à l'archivage (à côté du fichier des archives,
    // ou désigné par la clé `idKey` du fichier Identifiants).
    documents: { folderName: 'Documents Prêts', idKey: 'dossierDocumentsPrets' },

    entry: {
      excludedColumns: ['Déclarations', 'Signature'],
      target: { file: 'analyse', sheet: 'Nouveaux dossiers', defaults: { 'Status Analyse': "En cours d'examen" } },
    },

    rules: [
      // Cellule Analyse : décision
      {
        on: { file: 'analyse', sheet: 'Nouveaux dossiers' },
        column: 'Status Analyse',
        exclusive: true,
        cases: [
          {
            values: ['Validé'],
            // « Date de fin d'analyse » : posée au transfert vers la Vérification (règle suivante).
            targets: [{ file: 'analyse', sheet: 'Dossiers validés', defaults: { 'Passer à la Cellule verification': 'En attente' } }],
          },
          {
            values: ['Rejeté', 'Refusé'],
            // Pas de transfert pour un rejet : l'analyse se termine à la décision.
            dateHeader: "Date de fin d'analyse",
            targets: [{ file: 'analyse', sheet: 'Dossiers rejetés', defaults: { 'Archiver': 'En attente' } }],
          },
        ],
      },

      // Cellule Analyse → Cellule Vérification
      {
        on: { file: 'analyse', sheet: 'Dossiers validés' },
        column: 'Passer à la Cellule verification',
        cases: [{
          values: ['Oui'],
          dateHeader: "Date de fin d'analyse",
          targets: [{ file: 'verification', sheet: 'Nouveaux dossiers', defaults: { 'Statuts Vérification': "En cours d'examen" } }],
        }],
      },

      // Cellule Analyse : archivage des rejets
      {
        on: { file: 'analyse', sheet: 'Dossiers rejetés' },
        column: 'Archiver',
        cases: [{
          values: ['Oui'],
          dateHeader: "Date d'archivage",
          targets: [{ file: 'archives', sheet: 'Prêts refusés' }],
          removeFrom: nouveauxDossiers,
          archiveDocuments: true,
        }],
      },

      // Cellule Vérification : décision
      {
        on: { file: 'verification', sheet: 'Nouveaux dossiers' },
        column: 'Statuts Vérification',
        exclusive: true,
        cases: [
          {
            values: ['Validé'],
            dateHeader: 'Date de fin de vérification',
            targets: [{ file: 'verification', sheet: 'Dossiers validés', defaults: { 'Passer à la cellule finance': 'En attente' } }],
          },
          {
            values: ['Rejeté', 'Refusé'],
            dateHeader: 'Date de fin de vérification',
            targets: [{ file: 'verification', sheet: 'Dossiers rejetés', defaults: { 'Archiver': 'En attente' } }],
          },
        ],
      },

      // Cellule Vérification → Cellule Finance
      {
        on: { file: 'verification', sheet: 'Dossiers validés' },
        column: 'Passer à la cellule finance',
        cases: [{
          values: ['Oui'],
          targets: [{ file: 'finance', sheet: 'Prêts', defaults: { 'Passer à la cellule Suivi': 'En attente' } }],
        }],
      },

      // Cellule Vérification : archivage des rejets
      {
        on: { file: 'verification', sheet: 'Dossiers rejetés' },
        column: 'Archiver',
        cases: [{
          values: ['Oui'],
          dateHeader: "Date d'archivage",
          targets: [{ file: 'archives', sheet: 'Prêts refusés' }],
          removeFrom: nouveauxDossiers,
          archiveDocuments: true,
        }],
      },

      // Cellule Finance → Cellule Suivi
      {
        on: { file: 'finance', sheet: 'Prêts' },
        column: 'Passer à la cellule Suivi',
        cases: [{
          values: ['Oui'],
          targets: [{ file: 'suivi', sheet: 'Nouveaux dossiers', defaults: { 'Archiver': 'En attente' } }],
        }],
      },

      // Cellule Suivi : archivage (date de fin de suivi obligatoire)
      {
        on: { file: 'suivi', sheet: 'Nouveaux dossiers' },
        column: 'Archiver',
        cases: [{
          values: ['Oui'],
          requires: [{ column: 'Date de fin de suivi', notEmpty: true }],
          resetTo: 'En attente',
          dateHeader: "Date d'archivage",
          targets: [{ file: 'archives', sheet: 'Prêts validés' }],
          removeFrom: nouveauxDossiers,
          archiveDocuments: true,
        }],
      },
    ],
  };
}
